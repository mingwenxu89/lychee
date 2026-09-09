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

public class ExercisesControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public ExercisesControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    [Fact]
    public async Task Create_AsUser_Returns403()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "User"));

        var response = await client.PostAsJsonAsync("/api/admin/exercises", new { title = "Should Fail" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/admin/exercises", new { title = "Should Fail" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateGetListUpdate_AsAdmin_AllSucceed()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var createResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Short Stories {suffix}", description = "A test exercise", coverImageUrl = (string?)null, order = 1 });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ExerciseResponse>();
        Assert.NotNull(created);
        Assert.True(created!.IsPublished);
        Assert.Equal(1, created.Order);

        var getResponse = await client.GetAsync($"/api/admin/exercises/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var listResponse = await client.GetAsync("/api/admin/exercises");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await listResponse.Content.ReadFromJsonAsync<List<ExerciseResponse>>();
        Assert.Contains(list!, e => e.Id == created.Id);

        var updateResponse = await client.PutAsJsonAsync($"/api/admin/exercises/{created.Id}",
            new { title = $"Updated {suffix}", description = "Updated", coverImageUrl = (string?)null, order = 2 });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<ExerciseResponse>();
        Assert.Equal($"Updated {suffix}", updated!.Title);
        Assert.Equal("Updated", updated.Description);
        Assert.Equal(2, updated.Order);
    }

    [Fact]
    public async Task List_IsOrderedByOrderField()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var laterResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Later {suffix}", description = (string?)null, coverImageUrl = (string?)null, order = 20 });
        var later = await laterResponse.Content.ReadFromJsonAsync<ExerciseResponse>();
        var earlierResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Earlier {suffix}", description = (string?)null, coverImageUrl = (string?)null, order = 10 });
        var earlier = await earlierResponse.Content.ReadFromJsonAsync<ExerciseResponse>();

        var list = await (await client.GetAsync("/api/admin/exercises")).Content.ReadFromJsonAsync<List<ExerciseResponse>>();

        var earlierIndex = list!.FindIndex(e => e.Id == earlier!.Id);
        var laterIndex = list.FindIndex(e => e.Id == later!.Id);
        Assert.True(earlierIndex < laterIndex);
    }

    [Fact]
    public async Task Delete_AnExistingExercise_CascadesToUnitsAndTracksAndDeletesTheirBlobFiles()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var exerciseResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null, order = 1 });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<ExerciseResponse>();

        var unitResponse = await client.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<UnitIdOnly>();

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

        var deleteResponse = await client.DeleteAsync($"/api/admin/exercises/{exercise.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        Assert.False(File.Exists(audioPath));
        Assert.False(File.Exists(srtPath));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/admin/units/{unit.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/admin/tracks/{track.Id}")).StatusCode);
    }

    [Fact]
    public async Task Delete_NonExistentExercise_Returns404()
    {
        var client = AdminClient();

        var response = await client.DeleteAsync($"/api/admin/exercises/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private record ExerciseResponse(Guid Id, string Title, string? Description, string? CoverImageUrl, int Order, bool IsPublished);
    private record UnitIdOnly(Guid Id);
    private record TrackIdAndUrls(Guid Id, string AudioUrl, string SrtUrl);
}
