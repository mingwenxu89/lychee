using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Lychee.Api.Auth;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class LearnerEncouragementQuotesControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public LearnerEncouragementQuotesControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private record IdOnly(Guid Id);
    private record RandomQuoteResponse(string Text);
    private record QuoteResponse(Guid Id, string Text, bool IsActive);

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    private HttpClient LearnerClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "User"));
        return client;
    }

    [Fact]
    public async Task GetRandom_OnlyEverReturnsAnActiveQuote()
    {
        var admin = AdminClient();

        // Clear all encouragement quotes to start fresh
        var allQuotes = await admin.GetAsync("/api/admin/encouragement-quotes");
        var quotes = await allQuotes.Content.ReadFromJsonAsync<List<QuoteResponse>>();
        foreach (var q in quotes ?? [])
        {
            await admin.DeleteAsync($"/api/admin/encouragement-quotes/{q.Id}");
        }

        var suffix = Guid.NewGuid().ToString("N")[..8];
        var activeResponse = await admin.PostAsJsonAsync("/api/admin/encouragement-quotes", new { text = $"Great job {suffix}!" });
        var active = await activeResponse.Content.ReadFromJsonAsync<IdOnly>();
        var inactiveResponse = await admin.PostAsJsonAsync("/api/admin/encouragement-quotes", new { text = $"Never shown {suffix}!" });
        var inactive = await inactiveResponse.Content.ReadFromJsonAsync<IdOnly>();
        await admin.PutAsJsonAsync($"/api/admin/encouragement-quotes/{inactive!.Id}", new { text = $"Never shown {suffix}!", isActive = false });

        try
        {
            for (var i = 0; i < 10; i++)
            {
                var response = await LearnerClient().GetAsync("/api/learner/encouragement-quotes/random");
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                var quote = await response.Content.ReadFromJsonAsync<RandomQuoteResponse>();
                Assert.Equal($"Great job {suffix}!", quote!.Text);
            }
        }
        finally
        {
            // Clean up after the test
            var finalQuotes = await admin.GetAsync("/api/admin/encouragement-quotes");
            var finalList = await finalQuotes.Content.ReadFromJsonAsync<List<QuoteResponse>>();
            foreach (var q in finalList ?? [])
            {
                await admin.DeleteAsync($"/api/admin/encouragement-quotes/{q.Id}");
            }
        }
    }
}
