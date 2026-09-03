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
    public async Task Start_NewTrack_CreatesInProgressSessionAtRoundOnePhaseBlind()
    {
        var admin = AdminClient();
        var (trackId, _, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();

        var response = await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal("InProgress", session!.Status);
        Assert.Equal(1, session.CurrentRound);
        Assert.Equal("Blind", session.CurrentPhase);
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
    public async Task Checkpoint_RecordsCorrectSentencesAndAdvancesRoundAndPhase()
    {
        var admin = AdminClient();
        var (trackId, firstSentenceId, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();
        var session = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();

        var checkpointResponse = await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session!.Id}/checkpoint",
            new { currentRound = 2, currentPhase = "Blind", newlyCorrectSentenceIds = new[] { firstSentenceId } });
        Assert.Equal(HttpStatusCode.NoContent, checkpointResponse.StatusCode);

        var resumed = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal(2, resumed!.CurrentRound);
        Assert.Equal("Blind", resumed.CurrentPhase);
        Assert.Equal(new[] { firstSentenceId }, resumed.CorrectSentenceIds);
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
            $"/api/learner/full-dictation-sessions/{session!.Id}/checkpoint",
            new { currentRound = 2, currentPhase = "Blind", newlyCorrectSentenceIds = new[] { firstSentenceId } });

        var completeResponse = await learner.PostAsJsonAsync(
            $"/api/learner/full-dictation-sessions/{session.Id}/complete",
            new { newlyCorrectSentenceIds = new[] { secondSentenceId } });

        Assert.Equal(HttpStatusCode.OK, completeResponse.StatusCode);
        var result = await completeResponse.Content.ReadFromJsonAsync<CompleteResponse>();
        Assert.Equal(1.0, result!.Score);
        Assert.Equal(2, result.FinalCorrectSentenceIds.Count);

        // Starting again after Completed resets to a fresh Round 1 / Blind / no correct sentences.
        var restarted = await (await learner.PostAsync($"/api/learner/tracks/{trackId}/full-dictation-session/start", null))
            .Content.ReadFromJsonAsync<FullDictationSessionResponse>();
        Assert.Equal(1, restarted!.CurrentRound);
        Assert.Equal("Blind", restarted.CurrentPhase);
        Assert.Empty(restarted.CorrectSentenceIds);
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

    private record FullDictationSessionResponse(
        Guid Id, Guid TrackId, string Status, int CurrentRound, string CurrentPhase,
        List<Guid> CorrectSentenceIds, DateTime? CompletedAt);
    private record CompleteResponse(double Score, List<Guid> FinalCorrectSentenceIds);
    private record IdOnly(Guid Id);
}
