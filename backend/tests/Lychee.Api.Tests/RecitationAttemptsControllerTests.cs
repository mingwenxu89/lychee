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

public class RecitationAttemptsControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public RecitationAttemptsControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

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
        const string srt = "1\n00:00:00,000 --> 00:00:02,000\nI saw the snowfall\n\n2\n00:00:02,000 --> 00:00:04,000\nIt was magical\n";
        form.Add(new StringContent(srt), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");
        var trackResponse = await adminClient.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();
        return track!.Id;
    }

    private static object BuildRequest(double score, List<Guid> qualifiedSentenceIds, string submittedText = "recited text") =>
        new
        {
            submittedText,
            score,
            words = new List<object> { new { word = "I", status = "Correct" } },
            qualifiedSentenceIds
        };

    [Fact]
    public async Task Submit_RecordsThePrecomputedScoreAndQualifiedSentences()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();
        var trackResponse = await learner.GetAsync($"/api/learner/tracks/{trackId}");
        var track = await trackResponse.Content.ReadFromJsonAsync<LearnerTrackResponse>();
        var qualifiedIds = track!.Sentences.Select(s => s.Id).ToList();

        var response = await learner.PostAsJsonAsync($"/api/learner/tracks/{trackId}/recitation-attempts",
            BuildRequest(1.0, qualifiedIds, "I saw the snowfall It was magical"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<RecitationAttemptResponse>();
        Assert.NotEqual(Guid.Empty, result!.Id);
    }

    [Fact]
    public async Task Submit_LowScoringAttempt_IsStillRecorded()
    {
        // Unlike dictation's Submit, recitation has no retry-until-correct concept — every
        // attempt is a permanent one-shot history entry, so a low score must still be accepted.
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();

        var response = await learner.PostAsJsonAsync($"/api/learner/tracks/{trackId}/recitation-attempts",
            BuildRequest(0.2, new List<Guid>(), "completely different words"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Submit_AllowsMultipleAttempts_NoSessionState()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();

        var first = await learner.PostAsJsonAsync($"/api/learner/tracks/{trackId}/recitation-attempts",
            BuildRequest(0.2, new List<Guid>(), "wrong"));
        var second = await learner.PostAsJsonAsync($"/api/learner/tracks/{trackId}/recitation-attempts",
            BuildRequest(1.0, new List<Guid>(), "I saw the snowfall It was magical"));

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var firstResult = await first.Content.ReadFromJsonAsync<RecitationAttemptResponse>();
        var secondResult = await second.Content.ReadFromJsonAsync<RecitationAttemptResponse>();
        Assert.NotEqual(firstResult!.Id, secondResult!.Id);
    }

    [Fact]
    public async Task Submit_ConcurrentIdenticalAttempts_BothSucceed()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();
        var trackResponse = await learner.GetAsync($"/api/learner/tracks/{trackId}");
        var track = await trackResponse.Content.ReadFromJsonAsync<LearnerTrackResponse>();
        var qualifiedIds = track!.Sentences.Select(s => s.Id).ToList();
        var userToken = await CreateLearnerTokenAsync();

        var firstClient = await LearnerClientAsync(userToken);
        var secondClient = await LearnerClientAsync(userToken);

        var firstCallTask = firstClient.PostAsJsonAsync($"/api/learner/tracks/{trackId}/recitation-attempts",
            BuildRequest(1.0, qualifiedIds, "I saw the snowfall It was magical"));
        var secondCallTask = secondClient.PostAsJsonAsync($"/api/learner/tracks/{trackId}/recitation-attempts",
            BuildRequest(1.0, qualifiedIds, "I saw the snowfall It was magical"));
        var responses = await Task.WhenAll(firstCallTask, secondCallTask);

        Assert.Equal(HttpStatusCode.OK, responses[0].StatusCode);
        Assert.Equal(HttpStatusCode.OK, responses[1].StatusCode);
    }

    [Fact]
    public async Task Submit_NonExistentTrack_Returns404()
    {
        var response = await (await LearnerClientAsync()).PostAsJsonAsync($"/api/learner/tracks/{Guid.NewGuid()}/recitation-attempts",
            BuildRequest(0.0, new List<Guid>(), "anything"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private record IdOnly(Guid Id);
}
