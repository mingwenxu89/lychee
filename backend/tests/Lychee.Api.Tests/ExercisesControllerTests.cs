using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Lychee.Api.Auth;
using Microsoft.Extensions.DependencyInjection;
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
    public async Task NoDeleteEndpoint_Exists()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var createResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var created = await createResponse.Content.ReadFromJsonAsync<ExerciseResponse>();

        var deleteResponse = await client.DeleteAsync($"/api/admin/exercises/{created!.Id}");

        Assert.Equal(HttpStatusCode.MethodNotAllowed, deleteResponse.StatusCode);
    }

    private record ExerciseResponse(Guid Id, string Title, string? Description, string? CoverImageUrl, int Order, bool IsPublished);
}
