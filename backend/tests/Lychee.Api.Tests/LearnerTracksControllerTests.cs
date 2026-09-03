using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Lychee.Api.Auth;
using Lychee.Api.Controllers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class LearnerTracksControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public LearnerTracksControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    private HttpClient LearnerClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "User"));
        return client;
    }

    private static async Task<Guid> CreateTrackAsync(HttpClient adminClient, Guid unitId, string sentenceText = "Hello there.")
    {
        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        form.Add(new StringContent($"1\n00:00:00,000 --> 00:00:02,000\n{sentenceText}\n"), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");

        var response = await adminClient.PostAsync($"/api/admin/units/{unitId}/tracks", form);
        var track = await response.Content.ReadFromJsonAsync<IdOnly>();
        return track!.Id;
    }

    private static async Task<Guid> CreateUnitAsync(HttpClient adminClient, Guid exerciseId, int order)
    {
        var response = await adminClient.PostAsJsonAsync($"/api/admin/exercises/{exerciseId}/units",
            new { title = $"Unit {order}", order });
        var unit = await response.Content.ReadFromJsonAsync<IdOnly>();
        return unit!.Id;
    }

    private static async Task<Guid> CreateExerciseAsync(HttpClient adminClient)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var response = await adminClient.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var exercise = await response.Content.ReadFromJsonAsync<IdOnly>();
        return exercise!.Id;
    }

    [Fact]
    public async Task Get_ReturnsSentencesAndResolvedAudioUrl_ForAnyAuthenticatedUser()
    {
        var admin = AdminClient();
        var exerciseId = await CreateExerciseAsync(admin);
        var unitId = await CreateUnitAsync(admin, exerciseId, 1);
        var trackId = await CreateTrackAsync(admin, unitId);

        var response = await LearnerClient().GetAsync($"/api/learner/tracks/{trackId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var track = await response.Content.ReadFromJsonAsync<LearnerTrackResponse>();
        Assert.Equal(trackId, track!.Id);
        Assert.Equal(unitId, track.UnitId);
        Assert.Equal(exerciseId, track.ExerciseId);
        Assert.Single(track.Sentences);
        Assert.Equal("Hello there.", track.Sentences[0].Text);
        Assert.False(string.IsNullOrEmpty(track.AudioUrl));
        Assert.Null(track.NextTrackId);
    }

    [Fact]
    public async Task Get_ReturnsTrackTitleAndExerciseTitle()
    {
        var admin = AdminClient();
        var exerciseId = await CreateExerciseAsync(admin);
        var unitId = await CreateUnitAsync(admin, exerciseId, 1);

        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:02,000\nHello there.\n"), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("The First Snowfall"), "Title");
        var createResponse = await admin.PostAsync($"/api/admin/units/{unitId}/tracks", form);
        var trackId = (await createResponse.Content.ReadFromJsonAsync<IdOnly>())!.Id;

        var exerciseResponse = await admin.GetAsync($"/api/admin/exercises/{exerciseId}");
        var exerciseTitle = (await exerciseResponse.Content.ReadFromJsonAsync<ExerciseTitleOnly>())!.Title;

        var response = await LearnerClient().GetAsync($"/api/learner/tracks/{trackId}");

        var track = await response.Content.ReadFromJsonAsync<LearnerTrackResponse>();
        Assert.Equal("The First Snowfall", track!.Title);
        Assert.Equal(exerciseTitle, track.ExerciseTitle);
    }

    private record ExerciseTitleOnly(string Title);

    [Fact]
    public async Task Get_ComputesNextTrackId_AcrossUnitsInSameExercise()
    {
        var admin = AdminClient();
        var exerciseId = await CreateExerciseAsync(admin);
        var unit1 = await CreateUnitAsync(admin, exerciseId, 1);
        var unit2 = await CreateUnitAsync(admin, exerciseId, 2);
        var firstTrack = await CreateTrackAsync(admin, unit1, "First track.");
        var secondTrack = await CreateTrackAsync(admin, unit2, "Second track.");

        var response = await LearnerClient().GetAsync($"/api/learner/tracks/{firstTrack}");

        var track = await response.Content.ReadFromJsonAsync<LearnerTrackResponse>();
        Assert.Equal(secondTrack, track!.NextTrackId);
    }

    [Fact]
    public async Task Get_NonExistentTrack_Returns404()
    {
        var response = await LearnerClient().GetAsync($"/api/learner/tracks/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Get_WithoutAuthentication_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/learner/tracks/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private record IdOnly(Guid Id);
}
