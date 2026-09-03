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

public class LearnerHistoryControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public LearnerHistoryControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

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

    private async Task<Guid> CreateTrackWithTwoSentencesAsync(HttpClient admin) =>
        (await CreateExerciseWithTrackWithTwoSentencesAsync(admin)).TrackId;

    private async Task<(Guid ExerciseId, Guid TrackId)> CreateExerciseWithTrackWithTwoSentencesAsync(HttpClient admin)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await admin.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<IdOnly>();
        var unitResponse = await admin.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<IdOnly>();

        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        const string srt = "1\n00:00:00,000 --> 00:00:02,000\nFirst sentence.\n\n2\n00:00:02,000 --> 00:00:04,000\nSecond sentence.\n";
        form.Add(new StringContent(srt), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("The First Snowfall"), "Title");
        var trackResponse = await admin.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();
        return (exercise.Id, track!.Id);
    }

    private record IdOnly(Guid Id);

    [Fact]
    public async Task List_IncludesInProgressPracticeSession()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();
        var startResponse = await learner.PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        await startResponse.Content.ReadFromJsonAsync<PracticeSessionResponse>();

        var response = await learner.GetAsync("/api/learner/history");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entries = await response.Content.ReadFromJsonAsync<List<HistoryEntryResponse>>();
        var entry = entries!.Single(e => e.TrackId == trackId);
        Assert.Equal("Practice", entry.PracticeType);
        Assert.Equal("InProgress", entry.Status);
        Assert.Equal("The First Snowfall", entry.TrackTitle);
        Assert.Equal(0, entry.CurrentSentenceIndex);
        Assert.Equal(2, entry.TotalSentences);
        Assert.Null(entry.Accuracy);
    }

    [Fact]
    public async Task List_CompletedPracticeSession_IncludesComputedAccuracy()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        var userToken = await CreateLearnerTokenAsync();
        var learner = await LearnerClientAsync(userToken);

        var startResponse = await learner.PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        var session = await startResponse.Content.ReadFromJsonAsync<PracticeSessionResponse>();
        var trackResponse = await learner.GetAsync($"/api/learner/tracks/{trackId}");
        var track = await trackResponse.Content.ReadFromJsonAsync<LearnerTrackResponse>();
        foreach (var sentence in track!.Sentences)
        {
            await learner.PostAsJsonAsync($"/api/learner/practice-sessions/{session!.Id}/submit",
                new { sentenceId = sentence.Id, submittedText = sentence.Text });
        }
        await learner.PostAsJsonAsync($"/api/learner/practice-sessions/{session!.Id}/advance", new { toIndex = 2 });

        var response = await learner.GetAsync("/api/learner/history");

        var entries = await response.Content.ReadFromJsonAsync<List<HistoryEntryResponse>>();
        var entry = entries!.Single(e => e.TrackId == trackId);
        Assert.Equal("Completed", entry.Status);
        Assert.Equal(1.0, entry.Accuracy);
    }

    [Fact]
    public async Task List_RecitationAttempt_IsAlwaysCompletedWithNoSentenceProgress()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();

        await learner.PostAsJsonAsync($"/api/learner/tracks/{trackId}/recitation-attempts",
            new { submittedText = "First sentence Second sentence", score = 1.0, words = new List<object>(), qualifiedSentenceIds = new List<Guid>() });

        var response = await learner.GetAsync("/api/learner/history");

        var entries = await response.Content.ReadFromJsonAsync<List<HistoryEntryResponse>>();
        var entry = entries!.Single(e => e.TrackId == trackId && e.PracticeType == "Recitation");
        Assert.Equal("Completed", entry.Status);
        Assert.Equal(1.0, entry.Accuracy);
        Assert.Null(entry.CurrentSentenceIndex);
        Assert.Null(entry.TotalSentences);
    }

    [Fact]
    public async Task List_ExcludesEntryWhenExerciseIsUnpublished()
    {
        var admin = AdminClient();
        var (exerciseId, trackId) = await CreateExerciseWithTrackWithTwoSentencesAsync(admin);
        var learner = await LearnerClientAsync();
        await learner.PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        await learner.PostAsJsonAsync($"/api/learner/tracks/{trackId}/recitation-attempts",
            new { submittedText = "First sentence Second sentence", score = 1.0, words = new List<object>(), qualifiedSentenceIds = new List<Guid>() });

        var beforeResponse = await learner.GetAsync("/api/learner/history");
        var beforeEntries = await beforeResponse.Content.ReadFromJsonAsync<List<HistoryEntryResponse>>();
        Assert.Contains(beforeEntries!, e => e.TrackId == trackId && e.PracticeType == "Practice");
        Assert.Contains(beforeEntries!, e => e.TrackId == trackId && e.PracticeType == "Recitation");

        await admin.PatchAsJsonAsync($"/api/admin/exercises/{exerciseId}/publish-status", new { isPublished = false });

        var afterResponse = await learner.GetAsync("/api/learner/history");
        var afterEntries = await afterResponse.Content.ReadFromJsonAsync<List<HistoryEntryResponse>>();
        Assert.DoesNotContain(afterEntries!, e => e.TrackId == trackId);
    }

    [Fact]
    public async Task List_SortedByTimestampDescending()
    {
        var admin = AdminClient();
        var firstTrackId = await CreateTrackWithTwoSentencesAsync(admin);
        var secondTrackId = await CreateTrackWithTwoSentencesAsync(admin);
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        var userToken = await CreateLearnerTokenAsync();
        var learner = await LearnerClientAsync(userToken);

        await learner.PostAsync($"/api/learner/tracks/{firstTrackId}/practice-session/start", null);
        await learner.PostAsync($"/api/learner/tracks/{secondTrackId}/practice-session/start", null);

        var response = await learner.GetAsync("/api/learner/history");

        var entries = await response.Content.ReadFromJsonAsync<List<HistoryEntryResponse>>();
        var relevant = entries!.Where(e => e.TrackId == firstTrackId || e.TrackId == secondTrackId).ToList();
        Assert.Equal(secondTrackId, relevant[0].TrackId); // started later, sorts first
        Assert.Equal(firstTrackId, relevant[1].TrackId);
    }
}
