using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Lychee.Api.Auth;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class EncouragementQuotesControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public EncouragementQuotesControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    [Fact]
    public async Task CreateListUpdateDelete_AllSucceed()
    {
        var client = AdminClient();

        var createResponse = await client.PostAsJsonAsync("/api/admin/encouragement-quotes",
            new { text = "Great job — keep going!" });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<QuoteResponse>();
        Assert.True(created!.IsActive);

        var listResponse = await client.GetAsync("/api/admin/encouragement-quotes");
        var list = await listResponse.Content.ReadFromJsonAsync<List<QuoteResponse>>();
        Assert.Contains(list!, q => q.Id == created.Id);

        var updateResponse = await client.PutAsJsonAsync($"/api/admin/encouragement-quotes/{created.Id}",
            new { text = "Updated quote", isActive = false });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<QuoteResponse>();
        Assert.False(updated!.IsActive);

        var deleteResponse = await client.DeleteAsync($"/api/admin/encouragement-quotes/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    private record QuoteResponse(Guid Id, string Text, bool IsActive);
}
