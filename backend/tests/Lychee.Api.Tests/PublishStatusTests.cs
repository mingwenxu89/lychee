using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Lychee.Api.Auth;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class PublishStatusTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public PublishStatusTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    [Fact]
    public async Task Exercise_TogglePublishStatus_Persists()
    {
        var client = AdminClient();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var createResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var exercise = await createResponse.Content.ReadFromJsonAsync<ExerciseResponse>();
        Assert.True(exercise!.IsPublished);

        var patchResponse = await client.PatchAsJsonAsync($"/api/admin/exercises/{exercise.Id}/publish-status",
            new { isPublished = false });

        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);
        var updated = await patchResponse.Content.ReadFromJsonAsync<ExerciseResponse>();
        Assert.False(updated!.IsPublished);

        var getResponse = await client.GetAsync($"/api/admin/exercises/{exercise.Id}");
        var reloaded = await getResponse.Content.ReadFromJsonAsync<ExerciseResponse>();
        Assert.False(reloaded!.IsPublished);
    }

    private record ExerciseResponse(Guid Id, string Title, string? Description, string? CoverImageUrl, bool IsPublished);
}
