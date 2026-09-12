using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Lychee.Api.Auth;
using Lychee.Data;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class LearnerPreferencesControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public LearnerPreferencesControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private async Task<HttpClient> LearnerClientAsync()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LycheeDbContext>();
        var token = await TestTokens.ForRoleAsync(jwtTokenService, db, "User");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task GetThenSet_TranslationLanguage_RoundTrips()
    {
        var learner = await LearnerClientAsync();

        var initial = await (await learner.GetAsync("/api/learner/preferences/translation-language"))
            .Content.ReadFromJsonAsync<TranslationLanguagePreference>();
        Assert.Null(initial!.LanguageCode);

        var setResponse = await learner.PutAsJsonAsync("/api/learner/preferences/translation-language",
            new { languageCode = "zh" });
        Assert.Equal(HttpStatusCode.NoContent, setResponse.StatusCode);

        var afterSet = await (await learner.GetAsync("/api/learner/preferences/translation-language"))
            .Content.ReadFromJsonAsync<TranslationLanguagePreference>();
        Assert.Equal("zh", afterSet!.LanguageCode);

        await learner.PutAsJsonAsync("/api/learner/preferences/translation-language", new { languageCode = (string?)null });
        var afterClear = await (await learner.GetAsync("/api/learner/preferences/translation-language"))
            .Content.ReadFromJsonAsync<TranslationLanguagePreference>();
        Assert.Null(afterClear!.LanguageCode);
    }

    [Fact]
    public async Task Get_WithoutAuthentication_Returns401()
    {
        var response = await _factory.CreateClient().GetAsync("/api/learner/preferences/translation-language");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private record TranslationLanguagePreference(string? LanguageCode);
}
