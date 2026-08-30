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
        var learner = LearnerClient();

        // Record pre-existing active quotes
        var preexistingResponse = await admin.GetAsync("/api/admin/encouragement-quotes");
        var preexistingQuotes = await preexistingResponse.Content.ReadFromJsonAsync<List<QuoteResponse>>();
        var preexistingActiveTexts = (preexistingQuotes ?? [])
            .Where(q => q.IsActive)
            .Select(q => q.Text)
            .ToHashSet();

        // Create one new active quote
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var newActiveText = $"Great job {suffix}!";
        var activeResponse = await admin.PostAsJsonAsync("/api/admin/encouragement-quotes", new { text = newActiveText });
        var active = await activeResponse.Content.ReadFromJsonAsync<IdOnly>();

        // Create one new inactive quote
        var newInactiveText = $"Never shown {suffix}!";
        var inactiveResponse = await admin.PostAsJsonAsync("/api/admin/encouragement-quotes", new { text = newInactiveText });
        var inactive = await inactiveResponse.Content.ReadFromJsonAsync<IdOnly>();
        await admin.PutAsJsonAsync($"/api/admin/encouragement-quotes/{inactive!.Id}", new { text = newInactiveText, isActive = false });

        // Build the set of expected active texts: pre-existing active + new active
        var expectedActiveTexts = new HashSet<string>(preexistingActiveTexts) { newActiveText };

        // Call the learner endpoint 10 times and verify only active quotes are returned
        for (var i = 0; i < 10; i++)
        {
            var response = await learner.GetAsync("/api/learner/encouragement-quotes/random");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var quote = await response.Content.ReadFromJsonAsync<RandomQuoteResponse>();

            // Assert: returned text is in the set of expected active texts
            Assert.Contains(quote!.Text, expectedActiveTexts);

            // Assert: returned text is never the inactive quote
            Assert.NotEqual(newInactiveText, quote.Text);
        }
    }
}
