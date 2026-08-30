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

public class PracticeSessionsControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public PracticeSessionsControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    private async Task<HttpClient> LearnerClientAsync(string? userToken = null)
    {
        var client = _factory.CreateClient();
        var token = userToken ?? await CreateLearnerTokenAsync();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<string> CreateLearnerTokenAsync()
    {
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LycheeDbContext>();
        return await TestTokens.ForRoleAsync(jwtTokenService, db, "User");
    }

    private static async Task<Guid> CreateTrackWithTwoSentencesAsync(HttpClient adminClient)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await adminClient.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null, category = "Short Stories" });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<IdOnly>();

        var unitResponse = await adminClient.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<IdOnly>();

        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        const string srt = "1\n00:00:00,000 --> 00:00:02,000\nFirst sentence.\n\n2\n00:00:02,000 --> 00:00:04,000\nSecond sentence.\n";
        form.Add(new StringContent(srt), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        var trackResponse = await adminClient.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();
        return track!.Id;
    }

    [Fact]
    public async Task Start_NoExistingSession_CreatesInProgressAtIndexZero()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);

        var learner = await LearnerClientAsync();
        var response = await learner.PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<PracticeSessionResponse>();
        Assert.Equal(0, session!.CurrentSentenceIndex);
        Assert.Equal("InProgress", session.Status);
        Assert.Null(session.CompletedAt);
    }

    [Fact(Skip = "Enabled in Task 6 once /advance exists")]
    public async Task Start_ExistingInProgressSession_ResumesAtCurrentIndex_SameSessionId()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var userToken = await CreateLearnerTokenAsync();

        var firstStart = await (await LearnerClientAsync(userToken)).PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        var firstSession = await firstStart.Content.ReadFromJsonAsync<PracticeSessionResponse>();

        await (await LearnerClientAsync(userToken)).PostAsJsonAsync(
            $"/api/learner/practice-sessions/{firstSession!.Id}/advance", new { toIndex = 1 });

        var secondStart = await (await LearnerClientAsync(userToken)).PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        var secondSession = await secondStart.Content.ReadFromJsonAsync<PracticeSessionResponse>();

        Assert.Equal(firstSession.Id, secondSession!.Id);
        Assert.Equal(1, secondSession.CurrentSentenceIndex);
    }

    [Fact]
    public async Task Start_TrackDoesNotExist_Returns404()
    {
        var learner = await LearnerClientAsync();
        var response = await learner.PostAsync($"/api/learner/tracks/{Guid.NewGuid()}/practice-session/start", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Submit_CorrectAnswer_ReturnsFullAccuracyAndPersistsRecord()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();

        var startResponse = await learner.PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        var session = await startResponse.Content.ReadFromJsonAsync<PracticeSessionResponse>();

        var trackResponse = await learner.GetAsync($"/api/learner/tracks/{trackId}");
        var track = await trackResponse.Content.ReadFromJsonAsync<LearnerTrackResponse>();
        var firstSentence = track!.Sentences[0];

        var submitResponse = await learner.PostAsJsonAsync($"/api/learner/practice-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentence.Id, submittedText = firstSentence.Text });

        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);
        var result = await submitResponse.Content.ReadFromJsonAsync<SubmitAnswerResponse>();
        Assert.True(result!.IsCorrect);
        Assert.Equal(1.0, result.AccuracyScore);
        Assert.All(result.Words, w => Assert.Equal("Correct", w.Status));
    }

    [Fact]
    public async Task Submit_WrongAnswer_ReturnsPartialAccuracy()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();

        var startResponse = await learner.PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        var session = await startResponse.Content.ReadFromJsonAsync<PracticeSessionResponse>();
        var trackResponse = await learner.GetAsync($"/api/learner/tracks/{trackId}");
        var track = await trackResponse.Content.ReadFromJsonAsync<LearnerTrackResponse>();
        var firstSentence = track!.Sentences[0];

        var submitResponse = await learner.PostAsJsonAsync($"/api/learner/practice-sessions/{session!.Id}/submit",
            new { sentenceId = firstSentence.Id, submittedText = "completely wrong text" });

        var result = await submitResponse.Content.ReadFromJsonAsync<SubmitAnswerResponse>();
        Assert.False(result!.IsCorrect);
        Assert.True(result.AccuracyScore < 1.0);
    }

    [Fact]
    public async Task Submit_SessionBelongingToAnotherUser_Returns404()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var ownerStart = await (await LearnerClientAsync()).PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        var session = await ownerStart.Content.ReadFromJsonAsync<PracticeSessionResponse>();

        var otherUser = await LearnerClientAsync();
        var response = await otherUser.PostAsJsonAsync($"/api/learner/practice-sessions/{session!.Id}/submit",
            new { sentenceId = Guid.NewGuid(), submittedText = "anything" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private record IdOnly(Guid Id);
}
