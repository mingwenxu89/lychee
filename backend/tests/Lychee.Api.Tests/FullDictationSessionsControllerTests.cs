using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Lychee.Api.Auth;
using Lychee.Api.Controllers;
using Lychee.Data;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class FullDictationSessionsControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public FullDictationSessionsControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    // Favoriting writes a row with a real FK to AspNetUsers, so the backing ApplicationUser
    // must actually exist — ForRole alone mints a JWT for a user that isn't in the database.
    private async Task<HttpClient> LearnerClientAsync()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LycheeDbContext>();
        var token = await TestTokens.ForRoleAsync(jwtTokenService, db, "User");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<(Guid TrackId, Guid FirstSentenceId, Guid SecondSentenceId)> CreateTrackAsync(
        HttpClient adminClient, string firstSentenceText = "Hello there.", string secondSentenceText = "Good morning.")
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await adminClient.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<IdOnly>();

        var unitResponse = await adminClient.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<IdOnly>();

        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        form.Add(new StringContent(
            "1\n00:00:00,000 --> 00:00:02,000\n{first}\n\n2\n00:00:02,000 --> 00:00:04,000\n{second}\n"
                .Replace("{first}", firstSentenceText).Replace("{second}", secondSentenceText)),
            "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");
        var trackResponse = await adminClient.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();

        var sentencesResponse = await adminClient.GetAsync($"/api/admin/tracks/{track!.Id}/sentences");
        var sentences = await sentencesResponse.Content.ReadFromJsonAsync<List<IdOnly>>();

        return (track.Id, sentences![0].Id, sentences[1].Id);
    }

    [Fact]
    public async Task Start_NewTrack_CreatesInProgressSessionAtIndexZero()
    {
        var admin = AdminClient();
        var (trackId, _, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();

        var response = await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal("InProgress", session!.Status);
        Assert.Equal(0, session.CurrentSentenceIndex);
        Assert.Empty(session.CorrectSentenceIds);
    }

    [Fact]
    public async Task Start_CalledTwice_ReturnsTheSameSession()
    {
        var admin = AdminClient();
        var (trackId, _, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();

        var first = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        var second = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        Assert.Equal(first!.Id, second!.Id);
    }

    [Fact]
    public async Task Submit_RecordsCorrectSentence_AndAdvancePersistsPosition()
    {
        var admin = AdminClient();
        var (trackId, firstSentenceId, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        var submitResponse = await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = true, submittedText = "Hello there." });
        Assert.Equal(HttpStatusCode.NoContent, submitResponse.StatusCode);

        var advanceResponse = await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/advance", new { toIndex = 1 });
        Assert.Equal(HttpStatusCode.NoContent, advanceResponse.StatusCode);

        // A resumed session (a fresh page load, not just a still-open tab) must land back at the
        // exact sentence position it left off at, and know which sentences are already correct.
        var resumed = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal(1, resumed!.CurrentSentenceIndex);
        Assert.Equal(new[] { firstSentenceId }, resumed.CorrectSentenceIds);
    }

    [Fact]
    public async Task Advance_WithZero_ResetsPositionForANewRound()
    {
        var admin = AdminClient();
        var (trackId, _, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        await learner.PostAsJsonAsync($"/api/learner/full-dictation-sessions/{session!.Id}/advance", new { toIndex = 2 });
        await learner.PostAsJsonAsync($"/api/learner/full-dictation-sessions/{session.Id}/advance", new { toIndex = 0 });

        var resumed = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal(0, resumed!.CurrentSentenceIndex);
    }

    [Fact]
    public async Task Submit_PersistsSubmittedTextForBothCorrectAndIncorrectSentences_SoAResumeCanShowTheSameReview()
    {
        var admin = AdminClient();
        var (trackId, firstSentenceId, secondSentenceId) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = true, submittedText = "Hello there." });
        var secondResponse = await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/submit",
            new { sentenceId = secondSentenceId, isCorrect = false, submittedText = "good afternoon" });
        Assert.Equal(HttpStatusCode.NoContent, secondResponse.StatusCode);

        // A fresh resume (a new request, simulating the browser having been closed and reopened)
        // must be able to reconstruct what was typed for every graded sentence, including the
        // wrong one — not just which ids were correct.
        var resumed = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal("Hello there.", resumed!.SubmittedTexts[firstSentenceId]);
        Assert.Equal("good afternoon", resumed.SubmittedTexts[secondSentenceId]);
        Assert.Equal(new[] { firstSentenceId }, resumed.CorrectSentenceIds);
    }

    [Fact]
    public async Task Submit_CalledTwiceForSameSentence_UpdatesRatherThanDuplicates()
    {
        var admin = AdminClient();
        var (trackId, firstSentenceId, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = true, submittedText = "Hello there." });
        var secondResponse = await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = true, submittedText = "Hello there." });
        Assert.Equal(HttpStatusCode.NoContent, secondResponse.StatusCode);

        var resumed = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal(new[] { firstSentenceId }, resumed!.CorrectSentenceIds);
    }

    [Fact]
    public async Task Submit_WithIncorrectAfterPreviouslyCorrect_FlipsItBack()
    {
        var admin = AdminClient();
        var (trackId, firstSentenceId, secondSentenceId) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        // Round 2 marks both sentences correct.
        await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = true, submittedText = "Hello there." });
        await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/submit",
            new { sentenceId = secondSentenceId, isCorrect = true, submittedText = "Good morning." });

        // Round 3 re-grades: the learner edited the first sentence and now got it wrong.
        var submitResponse = await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = false, submittedText = "wrong now" });
        Assert.Equal(HttpStatusCode.NoContent, submitResponse.StatusCode);

        var resumed = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal(new[] { secondSentenceId }, resumed!.CorrectSentenceIds);
    }

    [Fact]
    public async Task Complete_MarksSessionCompletedAndReturnsScore()
    {
        var admin = AdminClient();
        var (trackId, firstSentenceId, secondSentenceId) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = true, submittedText = "Hello there." });
        await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/submit",
            new { sentenceId = secondSentenceId, isCorrect = true, submittedText = "Good morning." });

        var completeResponse = await learner.PostAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/complete", null);

        Assert.Equal(HttpStatusCode.OK, completeResponse.StatusCode);
        var result = await completeResponse.Content.ReadFromJsonAsync<CompleteResponse>();
        Assert.Equal(1.0, result!.Score);
        Assert.Equal(2, result.FinalCorrectSentenceIds.Count);

        // Starting again after Completed resets to a fresh index / no correct sentences.
        var restarted = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal(0, restarted!.CurrentSentenceIndex);
        Assert.Empty(restarted.CorrectSentenceIds);
    }

    [Fact]
    public async Task Complete_BeforeEverythingIsCorrect_ReportsAPartialScore_ForFinishNow()
    {
        var admin = AdminClient();
        var (trackId, firstSentenceId, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = true, submittedText = "Hello there." });

        var completeResponse = await learner.PostAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/complete", null);

        var result = await completeResponse.Content.ReadFromJsonAsync<CompleteResponse>();
        Assert.Equal(0.5, result!.Score);
        Assert.Equal(new[] { firstSentenceId }, result.FinalCorrectSentenceIds);
    }

    [Fact]
    public async Task Start_NonExistentTrack_Returns404()
    {
        var response = await (await LearnerClientAsync())
            .PostAsync($"/api/learner/tracks/{Guid.NewGuid()}/full-dictation-session/start", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Start_WithoutAuthentication_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync($"/api/learner/tracks/{Guid.NewGuid()}/full-dictation-session/start", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Submit_WithSentenceIdFromAnotherTrack_Returns404()
    {
        var admin = AdminClient();
        var (trackId, _, _) = await CreateTrackAsync(admin);
        var (_, otherTrackSentenceId, _) = await CreateTrackAsync(admin, "Other track sentence one.", "Other track sentence two.");
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        var submitResponse = await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/submit",
            new { sentenceId = otherTrackSentenceId, isCorrect = true, submittedText = "Other track sentence one." });

        Assert.Equal(HttpStatusCode.NotFound, submitResponse.StatusCode);

        var resumed = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Empty(resumed!.CorrectSentenceIds);
    }

    [Fact]
    public async Task Submit_ForAnotherUsersSession_Returns404()
    {
        var admin = AdminClient();
        var (trackId, firstSentenceId, _) = await CreateTrackAsync(admin);
        var owner = await LearnerClientAsync();
        var session = await (await owner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        var otherUser = await LearnerClientAsync();
        var response = await otherUser.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentenceId, isCorrect = true, submittedText = "Hello there." });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Complete_ForAnotherUsersSession_Returns404()
    {
        var admin = AdminClient();
        var (trackId, _, _) = await CreateTrackAsync(admin);
        var owner = await LearnerClientAsync();
        var session = await (await owner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        var otherUser = await LearnerClientAsync();
        var response = await otherUser.PostAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/complete", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private record FullDictationSessionResponse(
        Guid Id, Guid TrackId, string Status, int CurrentSentenceIndex,
        List<Guid> CorrectSentenceIds, Dictionary<Guid, string> SubmittedTexts, DateTime? CompletedAt);
    private record CompleteResponse(double Score, List<Guid> FinalCorrectSentenceIds);
    private record IdOnly(Guid Id);
}
