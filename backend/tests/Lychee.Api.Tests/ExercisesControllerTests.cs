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

        var response = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = "Should Fail", category = "Short Stories" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = "Should Fail", category = "Short Stories" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateGetListUpdateDelete_AsAdmin_AllSucceed()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var createResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Short Stories {suffix}", description = "A test exercise", coverImageUrl = (string?)null, category = "Short Stories" });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ExerciseResponse>();
        Assert.NotNull(created);
        Assert.True(created!.IsPublished);

        var getResponse = await client.GetAsync($"/api/admin/exercises/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var listResponse = await client.GetAsync("/api/admin/exercises");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var list = await listResponse.Content.ReadFromJsonAsync<List<ExerciseResponse>>();
        Assert.Contains(list!, e => e.Id == created.Id);

        var updateResponse = await client.PutAsJsonAsync($"/api/admin/exercises/{created.Id}",
            new { title = $"Updated {suffix}", description = "Updated", coverImageUrl = (string?)null, category = "Conversations" });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<ExerciseResponse>();
        Assert.Equal("Conversations", updated!.Category);

        var deleteResponse = await client.DeleteAsync($"/api/admin/exercises/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getAfterDelete = await client.GetAsync($"/api/admin/exercises/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAfterDelete.StatusCode);
    }

    private record ExerciseResponse(Guid Id, string Title, string? Description, string? CoverImageUrl, string Category, bool IsPublished);
}
