using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Lychee.Api.Auth;
using Microsoft.Extensions.DependencyInjection;
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
    public async Task CreateListUpdateDelete_UnderAnExercise_AllSucceed()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var exerciseResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null, category = "Short Stories" });
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

        var deleteResponse = await client.DeleteAsync($"/api/admin/units/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
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
}
