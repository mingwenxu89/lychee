using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Lychee.Api.Auth;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class TracksControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public TracksControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    private async Task<Guid> CreateUnitAsync(HttpClient client)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<IdOnly>();

        var unitResponse = await client.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<IdOnly>();
        return unit!.Id;
    }

    [Fact]
    public async Task Create_WithTitle_ReturnsTitleInResponse()
    {
        var client = AdminClient();
        var unitId = await CreateUnitAsync(client);

        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("The First Snowfall"), "Title");

        var response = await client.PostAsync($"/api/admin/units/{unitId}/tracks", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var track = await response.Content.ReadFromJsonAsync<TrackResponse>();
        Assert.Equal("The First Snowfall", track!.Title);
    }

    [Fact]
    public async Task Create_WithDescription_ReturnsDescriptionInResponse()
    {
        var client = AdminClient();
        var unitId = await CreateUnitAsync(client);

        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio")), "AudioFile", "track.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("The First Snowfall"), "Title");
        form.Add(new StringContent("A quiet story about an early winter morning."), "Description");

        var response = await client.PostAsync($"/api/admin/units/{unitId}/tracks", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var track = await response.Content.ReadFromJsonAsync<TrackResponse>();
        Assert.Equal("A quiet story about an early winter morning.", track!.Description);
    }

    [Fact]
    public async Task Create_WithoutDescription_ReturnsNullDescription()
    {
        var client = AdminClient();
        var unitId = await CreateUnitAsync(client);

        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio")), "AudioFile", "track.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("No Description Track"), "Title");

        var response = await client.PostAsync($"/api/admin/units/{unitId}/tracks", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var track = await response.Content.ReadFromJsonAsync<TrackResponse>();
        Assert.Null(track!.Description);
    }

    [Fact]
    public async Task Update_ChangesDescription()
    {
        var client = AdminClient();
        var unitId = await CreateUnitAsync(client);

        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("audio")), "AudioFile", "a.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "a.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Original Title"), "Title");
        var createResponse = await client.PostAsync($"/api/admin/units/{unitId}/tracks", form);
        var track = await createResponse.Content.ReadFromJsonAsync<TrackResponse>();

        var updateResponse = await client.PutAsJsonAsync($"/api/admin/tracks/{track!.Id}",
            new { title = "Updated Title", level = "B1", description = "A new description." });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<TrackResponse>();
        Assert.Equal("A new description.", updated!.Description);
    }

    [Fact]
    public async Task Update_ChangesTitleAndLevel()
    {
        var client = AdminClient();
        var unitId = await CreateUnitAsync(client);

        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("audio")), "AudioFile", "a.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "a.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Original Title"), "Title");
        var createResponse = await client.PostAsync($"/api/admin/units/{unitId}/tracks", form);
        var track = await createResponse.Content.ReadFromJsonAsync<TrackResponse>();

        var updateResponse = await client.PutAsJsonAsync($"/api/admin/tracks/{track!.Id}",
            new { title = "Updated Title", level = "B1" });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<TrackResponse>();
        Assert.Equal("Updated Title", updated!.Title);
        Assert.Equal("B1", updated.Level);
    }

    [Fact]
    public async Task Create_WithAudioAndSrt_GeneratesSentencesAndComputesDuration()
    {
        var client = AdminClient();
        var unitId = await CreateUnitAsync(client);

        const string srt = "1\n00:00:00,000 --> 00:00:02,000\nI saw the first snowfall.\n\n2\n00:00:02,500 --> 00:00:05,000\nIt was magical.\n";

        using var form = new MultipartFormDataContent();
        var audioBytes = Encoding.UTF8.GetBytes("fake-audio-bytes-for-testing");
        var audioContent = new ByteArrayContent(audioBytes);
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");

        var srtContent = new StringContent(srt, Encoding.UTF8, "text/plain");
        form.Add(srtContent, "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");

        var response = await client.PostAsync($"/api/admin/units/{unitId}/tracks", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var track = await response.Content.ReadFromJsonAsync<TrackResponse>();
        Assert.Equal("A1", track!.Level);
        Assert.Equal(2, track.SentenceCount);
        Assert.Equal(TimeSpan.FromSeconds(5), track.Duration);
        Assert.False(string.IsNullOrEmpty(track.AudioUrl));
        Assert.False(string.IsNullOrEmpty(track.SrtUrl));
    }

    [Fact]
    public async Task Get_AnExistingTrack_ReturnsIt()
    {
        var client = AdminClient();
        var unitId = await CreateUnitAsync(client);

        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("audio")), "AudioFile", "a.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "a.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");
        var createResponse = await client.PostAsync($"/api/admin/units/{unitId}/tracks", form);
        var track = await createResponse.Content.ReadFromJsonAsync<TrackResponse>();

        var getResponse = await client.GetAsync($"/api/admin/tracks/{track!.Id}");

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var fetched = await getResponse.Content.ReadFromJsonAsync<TrackResponse>();
        Assert.Equal("Test Track", fetched!.Title);
    }

    [Fact]
    public async Task Get_NonExistentTrack_Returns404()
    {
        var client = AdminClient();

        var response = await client.GetAsync($"/api/admin/tracks/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_UnderNonExistentUnit_Returns404()
    {
        var client = AdminClient();
        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("x")), "AudioFile", "a.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "a.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");

        var response = await client.PostAsync($"/api/admin/units/{Guid.NewGuid()}/tracks", form);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateThenDelete_AnExistingTrack_BothSucceed()
    {
        var client = AdminClient();
        var unitId = await CreateUnitAsync(client);

        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("audio")), "AudioFile", "a.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "a.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");
        var createResponse = await client.PostAsync($"/api/admin/units/{unitId}/tracks", form);
        var track = await createResponse.Content.ReadFromJsonAsync<TrackResponse>();

        var updateResponse = await client.PutAsJsonAsync($"/api/admin/tracks/{track!.Id}",
            new { title = "Renamed Track", level = "B1" });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<TrackResponse>();
        Assert.Equal("Renamed Track", updated!.Title);
        Assert.Equal("B1", updated.Level);

        var deleteResponse = await client.DeleteAsync($"/api/admin/tracks/{track.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var listAfterDelete = await client.GetAsync($"/api/admin/units/{unitId}/tracks");
        var listAfter = await listAfterDelete.Content.ReadFromJsonAsync<List<TrackResponse>>();
        Assert.DoesNotContain(listAfter!, t => t.Id == track.Id);
    }

    private record IdOnly(Guid Id);
    private record TrackResponse(Guid Id, Guid UnitId, string Title, string? Description, string AudioUrl, string SrtUrl, TimeSpan Duration, string Level, bool IsPublished, int SentenceCount);
}
