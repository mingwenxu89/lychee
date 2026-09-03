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

public class LearnerFavoritesControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public LearnerFavoritesControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

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

    private static async Task<(Guid TrackId, Guid SentenceId, Guid ExerciseId)> CreateTrackAsync(
        HttpClient adminClient, string sentenceText = "Hello there.")
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
        form.Add(new StringContent($"1\n00:00:00,000 --> 00:00:02,000\n{sentenceText}\n"), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");
        var trackResponse = await adminClient.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();

        var sentencesResponse = await adminClient.GetAsync($"/api/admin/tracks/{track!.Id}/sentences");
        var sentences = await sentencesResponse.Content.ReadFromJsonAsync<List<IdOnly>>();

        return (track.Id, sentences![0].Id, exercise.Id);
    }

    [Fact]
    public async Task FavoriteTrack_ThenUnfavorite_TogglesCorrectlyAndIsIdempotent()
    {
        var admin = AdminClient();
        var (trackId, _, _) = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();

        var favoriteOnce = await learner.PutAsync($"/api/learner/tracks/{trackId}/favorite", null);
        Assert.Equal(HttpStatusCode.NoContent, favoriteOnce.StatusCode);
        var favoriteTwice = await learner.PutAsync($"/api/learner/tracks/{trackId}/favorite", null);
        Assert.Equal(HttpStatusCode.NoContent, favoriteTwice.StatusCode);

        var listResponse = await learner.GetAsync("/api/learner/favorites/tracks");
        var list = await listResponse.Content.ReadFromJsonAsync<List<FavoriteTrackResponse>>();
        Assert.Contains(list!, t => t.Id == trackId);

        var trackDetail = await (await learner.GetAsync($"/api/learner/tracks/{trackId}")).Content.ReadFromJsonAsync<LearnerTrackResponse>();
        Assert.True(trackDetail!.IsFavorited);

        var unfavoriteOnce = await learner.DeleteAsync($"/api/learner/tracks/{trackId}/favorite");
        Assert.Equal(HttpStatusCode.NoContent, unfavoriteOnce.StatusCode);
        var unfavoriteTwice = await learner.DeleteAsync($"/api/learner/tracks/{trackId}/favorite");
        Assert.Equal(HttpStatusCode.NoContent, unfavoriteTwice.StatusCode);

        var listAfter = await (await learner.GetAsync("/api/learner/favorites/tracks")).Content.ReadFromJsonAsync<List<FavoriteTrackResponse>>();
        Assert.DoesNotContain(listAfter!, t => t.Id == trackId);
    }

    [Fact]
    public async Task FavoriteSentence_ThenUnfavorite_TogglesCorrectlyAndIsIdempotent()
    {
        var admin = AdminClient();
        var (trackId, sentenceId, exerciseId) = await CreateTrackAsync(admin, "A gentle sentence.");
        var learner = await LearnerClientAsync();

        var favoriteOnce = await learner.PutAsync($"/api/learner/sentences/{sentenceId}/favorite", null);
        Assert.Equal(HttpStatusCode.NoContent, favoriteOnce.StatusCode);
        var favoriteTwice = await learner.PutAsync($"/api/learner/sentences/{sentenceId}/favorite", null);
        Assert.Equal(HttpStatusCode.NoContent, favoriteTwice.StatusCode);

        var listResponse = await learner.GetAsync("/api/learner/favorites/sentences");
        var list = await listResponse.Content.ReadFromJsonAsync<List<FavoriteSentenceResponse>>();
        var favorited = Assert.Single(list!, s => s.Id == sentenceId);
        Assert.Equal("A gentle sentence.", favorited.Text);
        Assert.Equal(trackId, favorited.TrackId);
        Assert.Equal("Test Track", favorited.TrackTitle);
        Assert.False(string.IsNullOrEmpty(favorited.AudioUrl));

        var trackDetail = await (await learner.GetAsync($"/api/learner/tracks/{trackId}")).Content.ReadFromJsonAsync<LearnerTrackResponse>();
        Assert.True(trackDetail!.Sentences.Single(s => s.Id == sentenceId).IsFavorited);

        var unfavoriteOnce = await learner.DeleteAsync($"/api/learner/sentences/{sentenceId}/favorite");
        Assert.Equal(HttpStatusCode.NoContent, unfavoriteOnce.StatusCode);
        var unfavoriteTwice = await learner.DeleteAsync($"/api/learner/sentences/{sentenceId}/favorite");
        Assert.Equal(HttpStatusCode.NoContent, unfavoriteTwice.StatusCode);

        var listAfter = await (await learner.GetAsync("/api/learner/favorites/sentences")).Content.ReadFromJsonAsync<List<FavoriteSentenceResponse>>();
        Assert.DoesNotContain(listAfter!, s => s.Id == sentenceId);
    }

    [Fact]
    public async Task ListFavoriteTracks_OrderedByMostRecentlyFavoritedFirst()
    {
        var admin = AdminClient();
        var (firstTrackId, _, _) = await CreateTrackAsync(admin, "First.");
        var (secondTrackId, _, _) = await CreateTrackAsync(admin, "Second.");
        var learner = await LearnerClientAsync();

        await learner.PutAsync($"/api/learner/tracks/{firstTrackId}/favorite", null);
        await learner.PutAsync($"/api/learner/tracks/{secondTrackId}/favorite", null);

        var list = await (await learner.GetAsync("/api/learner/favorites/tracks")).Content.ReadFromJsonAsync<List<FavoriteTrackResponse>>();
        Assert.Equal(secondTrackId, list![0].Id);
        Assert.Equal(firstTrackId, list[1].Id);
    }

    [Fact]
    public async Task FavoriteTrack_NonExistentTrack_Returns404()
    {
        var response = await (await LearnerClientAsync()).PutAsync($"/api/learner/tracks/{Guid.NewGuid()}/favorite", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task FavoriteSentence_NonExistentSentence_Returns404()
    {
        var response = await (await LearnerClientAsync()).PutAsync($"/api/learner/sentences/{Guid.NewGuid()}/favorite", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task FavoriteTrack_WithoutAuthentication_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PutAsync($"/api/learner/tracks/{Guid.NewGuid()}/favorite", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private record IdOnly(Guid Id);
}
