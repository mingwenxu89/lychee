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

    private static async Task<Guid> CreateTrackAsync(HttpClient adminClient, string sentenceText = "Hello there.")
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

        return track!.Id;
    }

    [Fact]
    public async Task FavoriteTrack_ThenUnfavorite_TogglesCorrectlyAndIsIdempotent()
    {
        var admin = AdminClient();
        var trackId = await CreateTrackAsync(admin);
        var learner = await LearnerClientAsync();

        var favoriteOnce = await learner.PutAsync($"/api/learner/tracks/{trackId}/favorite", null);
        Assert.Equal(HttpStatusCode.NoContent, favoriteOnce.StatusCode);
        var favoriteTwice = await learner.PutAsync($"/api/learner/tracks/{trackId}/favorite", null);
        Assert.Equal(HttpStatusCode.NoContent, favoriteTwice.StatusCode);

        var listResponse = await learner.GetAsync("/api/learner/favorites/tracks");
        var list = await listResponse.Content.ReadFromJsonAsync<PagedResponse<FavoriteTrackResponse>>();
        Assert.Contains(list!.Items, t => t.Id == trackId);

        var trackDetail = await (await learner.GetAsync($"/api/learner/tracks/{trackId}")).Content.ReadFromJsonAsync<LearnerTrackResponse>();
        Assert.True(trackDetail!.IsFavorited);

        var unfavoriteOnce = await learner.DeleteAsync($"/api/learner/tracks/{trackId}/favorite");
        Assert.Equal(HttpStatusCode.NoContent, unfavoriteOnce.StatusCode);
        var unfavoriteTwice = await learner.DeleteAsync($"/api/learner/tracks/{trackId}/favorite");
        Assert.Equal(HttpStatusCode.NoContent, unfavoriteTwice.StatusCode);

        var listAfter = await (await learner.GetAsync("/api/learner/favorites/tracks")).Content.ReadFromJsonAsync<PagedResponse<FavoriteTrackResponse>>();
        Assert.DoesNotContain(listAfter!.Items, t => t.Id == trackId);
    }

    [Fact]
    public async Task ListFavoriteTracks_OrderedByMostRecentlyFavoritedFirst()
    {
        var admin = AdminClient();
        var firstTrackId = await CreateTrackAsync(admin, "First.");
        var secondTrackId = await CreateTrackAsync(admin, "Second.");
        var learner = await LearnerClientAsync();

        await learner.PutAsync($"/api/learner/tracks/{firstTrackId}/favorite", null);
        await learner.PutAsync($"/api/learner/tracks/{secondTrackId}/favorite", null);

        var list = await (await learner.GetAsync("/api/learner/favorites/tracks")).Content.ReadFromJsonAsync<PagedResponse<FavoriteTrackResponse>>();
        Assert.Equal(secondTrackId, list!.Items[0].Id);
        Assert.Equal(firstTrackId, list.Items[1].Id);
    }

    [Fact]
    public async Task ListFavoriteTracks_RespectsPageAndPageSize()
    {
        var admin = AdminClient();
        var firstTrackId = await CreateTrackAsync(admin, "First.");
        var secondTrackId = await CreateTrackAsync(admin, "Second.");
        var thirdTrackId = await CreateTrackAsync(admin, "Third.");
        var learner = await LearnerClientAsync();

        await learner.PutAsync($"/api/learner/tracks/{firstTrackId}/favorite", null);
        await learner.PutAsync($"/api/learner/tracks/{secondTrackId}/favorite", null);
        await learner.PutAsync($"/api/learner/tracks/{thirdTrackId}/favorite", null);

        var page1 = await (await learner.GetAsync("/api/learner/favorites/tracks?page=1&pageSize=2"))
            .Content.ReadFromJsonAsync<PagedResponse<FavoriteTrackResponse>>();
        var page2 = await (await learner.GetAsync("/api/learner/favorites/tracks?page=2&pageSize=2"))
            .Content.ReadFromJsonAsync<PagedResponse<FavoriteTrackResponse>>();

        Assert.Equal(3, page1!.TotalCount);
        Assert.Equal(2, page1.Items.Count);
        Assert.Equal(thirdTrackId, page1.Items[0].Id);
        Assert.Equal(secondTrackId, page1.Items[1].Id);

        Assert.Equal(3, page2!.TotalCount);
        Assert.Single(page2.Items);
        Assert.Equal(firstTrackId, page2.Items[0].Id);
    }

    [Fact]
    public async Task FavoriteTrack_NonExistentTrack_Returns404()
    {
        var response = await (await LearnerClientAsync()).PutAsync($"/api/learner/tracks/{Guid.NewGuid()}/favorite", null);

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
