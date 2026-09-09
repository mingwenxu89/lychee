using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Lychee.Api.Auth;
using Lychee.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace Lychee.Api.Tests;

public class UnitsControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public UnitsControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    [Fact]
    public async Task CreateListUpdate_UnderAnExercise_AllSucceed()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var exerciseResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<ExerciseIdOnly>();

        var createResponse = await client.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<UnitResponse>();
        Assert.Equal(exercise.Id, created!.ExerciseId);

        var listResponse = await client.GetAsync($"/api/admin/exercises/{exercise.Id}/units");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await listResponse.Content.ReadFromJsonAsync<List<UnitResponse>>();
        Assert.Contains(list!, u => u.Id == created.Id);

        var updateResponse = await client.PutAsJsonAsync($"/api/admin/units/{created.Id}",
            new { title = "Unit 1 Renamed", order = 2 });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<UnitResponse>();
        Assert.Equal(2, updated!.Order);
    }

    [Fact]
    public async Task Delete_AnExistingUnit_CascadesToTracksAndDeletesTheirBlobFiles()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<ExerciseIdOnly>();
        var createResponse = await client.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await createResponse.Content.ReadFromJsonAsync<UnitResponse>();

        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("audio")), "AudioFile", "a.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:01,000\nHi.\n"), "SrtFile", "a.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");
        var trackResponse = await client.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<TrackIdAndUrls>();

        var storageOptions = _factory.Services.GetRequiredService<IOptions<StorageOptions>>().Value;
        var audioPath = TestBlobPaths.FromReadUrl(storageOptions, track!.AudioUrl);
        var srtPath = TestBlobPaths.FromReadUrl(storageOptions, track.SrtUrl);
        Assert.True(File.Exists(audioPath));
        Assert.True(File.Exists(srtPath));

        var deleteResponse = await client.DeleteAsync($"/api/admin/units/{unit.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        Assert.False(File.Exists(audioPath));
        Assert.False(File.Exists(srtPath));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/admin/tracks/{track.Id}")).StatusCode);
    }

    [Fact]
    public async Task Delete_NonExistentUnit_Returns404()
    {
        var client = AdminClient();

        var response = await client.DeleteAsync($"/api/admin/units/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_UnderNonExistentExercise_Returns404()
    {
        var client = AdminClient();

        var response = await client.PostAsJsonAsync($"/api/admin/exercises/{Guid.NewGuid()}/units",
            new { title = "Orphan", order = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private record ExerciseIdOnly(Guid Id);
    private record UnitResponse(Guid Id, Guid ExerciseId, string Title, int Order, bool IsPublished);
    private record TrackIdAndUrls(Guid Id, string AudioUrl, string SrtUrl);
}
