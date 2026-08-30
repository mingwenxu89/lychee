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

public class LearnerExercisesControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public LearnerExercisesControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

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

    private async Task<(Guid ExerciseId, Guid TrackId)> CreatePublishedExerciseWithOneTrackAsync(HttpClient admin, string level)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await admin.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null, category = "Short Stories" });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<IdOnly>();

        var unitResponse = await admin.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<IdOnly>();

        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "track.srt");
        form.Add(new StringContent(level), "Level");
        form.Add(new StringContent("Track One"), "Title");
        var trackResponse = await admin.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();

        return (exercise.Id, track!.Id);
    }

    private async Task<(Guid ExerciseId, Guid UnitId)> CreatePublishedExerciseWithUnitAsync(HttpClient admin)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await admin.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null, category = "Short Stories" });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<IdOnly>();

        var unitResponse = await admin.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<IdOnly>();

        return (exercise.Id, unit!.Id);
    }

    private async Task<Guid> AddTrackAsync(HttpClient admin, Guid unitId, string title, string level = "A1")
    {
        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "track.srt");
        form.Add(new StringContent(level), "Level");
        form.Add(new StringContent(title), "Title");
        var trackResponse = await admin.PostAsync($"/api/admin/units/{unitId}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();
        return track!.Id;
    }

    private record IdOnly(Guid Id);

    [Fact]
    public async Task List_ReturnsPublishedExerciseWithTrackCountAndDifficultyRange()
    {
        var admin = AdminClient();
        var (exerciseId, _) = await CreatePublishedExerciseWithOneTrackAsync(admin, "A1");

        var response = await (await LearnerClientAsync()).GetAsync("/api/learner/exercises");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var exercises = await response.Content.ReadFromJsonAsync<List<LearnerExerciseResponse>>();
        var found = exercises!.Single(e => e.Id == exerciseId);
        Assert.Equal(1, found.TrackCount);
        Assert.Equal("A1", found.DifficultyRangeLabel);
        Assert.Equal(0, found.CompletedTrackCount);
        Assert.Null(found.LastPracticedAt);
    }

    [Fact]
    public async Task List_ExcludesUnpublishedExercise()
    {
        var admin = AdminClient();
        var (exerciseId, _) = await CreatePublishedExerciseWithOneTrackAsync(admin, "A1");
        await admin.PatchAsJsonAsync($"/api/admin/exercises/{exerciseId}/publish-status", new { isPublished = false });

        var response = await (await LearnerClientAsync()).GetAsync("/api/learner/exercises");

        var exercises = await response.Content.ReadFromJsonAsync<List<LearnerExerciseResponse>>();
        Assert.DoesNotContain(exercises!, e => e.Id == exerciseId);
    }

    [Fact]
    public async Task List_AfterCompletingATrack_ReflectsProgressAndLastPracticedAt()
    {
        var admin = AdminClient();
        var (exerciseId, trackId) = await CreatePublishedExerciseWithOneTrackAsync(admin, "B1");
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        var userToken = await CreateLearnerTokenAsync();
        var learner = await LearnerClientAsync(userToken);

        var startResponse = await learner.PostAsync($"/api/learner/tracks/{trackId}/practice-session/start", null);
        var session = await startResponse.Content.ReadFromJsonAsync<PracticeSessionResponse>();
        await learner.PostAsJsonAsync($"/api/learner/practice-sessions/{session!.Id}/advance", new { toIndex = 1 });

        var response = await learner.GetAsync("/api/learner/exercises");

        var exercises = await response.Content.ReadFromJsonAsync<List<LearnerExerciseResponse>>();
        var found = exercises!.Single(e => e.Id == exerciseId);
        Assert.Equal(1, found.CompletedTrackCount);
        Assert.NotNull(found.LastPracticedAt);
    }

    [Fact]
    public async Task Get_ReturnsUnitsAndTracksInOrder()
    {
        var admin = AdminClient();
        var (exerciseId, _) = await CreatePublishedExerciseWithOneTrackAsync(admin, "A1");

        var response = await (await LearnerClientAsync()).GetAsync($"/api/learner/exercises/{exerciseId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await response.Content.ReadFromJsonAsync<LearnerExerciseDetailResponse>();
        Assert.Single(detail!.Units);
        Assert.Single(detail.Units[0].Tracks);
        Assert.Equal("Track One", detail.Units[0].Tracks[0].Title);
        Assert.False(detail.Units[0].Tracks[0].IsCompletedByUser);
    }

    [Fact]
    public async Task Get_ReturnsTracksWithinUnitInCreationOrder()
    {
        var admin = AdminClient();
        var (exerciseId, unitId) = await CreatePublishedExerciseWithUnitAsync(admin);
        var firstTrackId = await AddTrackAsync(admin, unitId, "First Track");
        var secondTrackId = await AddTrackAsync(admin, unitId, "Second Track");
        var thirdTrackId = await AddTrackAsync(admin, unitId, "Third Track");

        var response = await (await LearnerClientAsync()).GetAsync($"/api/learner/exercises/{exerciseId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await response.Content.ReadFromJsonAsync<LearnerExerciseDetailResponse>();
        var tracks = detail!.Units.Single().Tracks;
        Assert.Equal(new[] { firstTrackId, secondTrackId, thirdTrackId }, tracks.Select(t => t.Id));
        Assert.Equal(new[] { "First Track", "Second Track", "Third Track" }, tracks.Select(t => t.Title));
    }

    [Fact]
    public async Task Get_UnpublishedExercise_Returns404()
    {
        var admin = AdminClient();
        var (exerciseId, _) = await CreatePublishedExerciseWithOneTrackAsync(admin, "A1");
        await admin.PatchAsJsonAsync($"/api/admin/exercises/{exerciseId}/publish-status", new { isPublished = false });

        var response = await (await LearnerClientAsync()).GetAsync($"/api/learner/exercises/{exerciseId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Get_NonExistentExercise_Returns404()
    {
        var response = await (await LearnerClientAsync()).GetAsync($"/api/learner/exercises/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
