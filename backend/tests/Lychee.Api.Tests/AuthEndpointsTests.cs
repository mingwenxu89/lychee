using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Lychee.Api.Tests;

public class AuthEndpointsTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public AuthEndpointsTests(LycheeWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task Register_ThenLogin_ReturnsToken()
    {
        var client = _factory.CreateClient();
        var email = $"user-{Guid.NewGuid():N}@example.test";

        var registerResponse = await client.PostAsJsonAsync("/api/auth/register",
            new { email, password = "CorrectHorse123!" });
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login",
            new { email, password = "CorrectHorse123!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var body = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.False(string.IsNullOrEmpty(body!.Token));
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var client = _factory.CreateClient();
        var email = $"user-{Guid.NewGuid():N}@example.test";
        await client.PostAsJsonAsync("/api/auth/register", new { email, password = "CorrectHorse123!" });

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login",
            new { email, password = "WrongPassword123!" });

        Assert.Equal(HttpStatusCode.Unauthorized, loginResponse.StatusCode);
    }

    private record LoginResponse(string Token, DateTime ExpiresAtUtc);
}
