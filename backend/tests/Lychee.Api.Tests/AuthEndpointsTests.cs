using System.Net;
using System.Net.Http.Headers;
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

    [Fact]
    public async Task ChangePassword_WithCorrectCurrentPassword_AllowsLoginWithNewPassword()
    {
        var client = _factory.CreateClient();
        var email = $"user-{Guid.NewGuid():N}@example.test";
        await client.PostAsJsonAsync("/api/auth/register", new { email, password = "CorrectHorse123!" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "CorrectHorse123!" });
        var token = (await loginResponse.Content.ReadFromJsonAsync<LoginResponse>())!.Token;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var changeResponse = await client.PostAsJsonAsync("/api/auth/change-password",
            new { currentPassword = "CorrectHorse123!", newPassword = "NewCorrectHorse456!" });

        Assert.Equal(HttpStatusCode.NoContent, changeResponse.StatusCode);

        var newLoginResponse = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login",
            new { email, password = "NewCorrectHorse456!" });
        Assert.Equal(HttpStatusCode.OK, newLoginResponse.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_Returns400AndLeavesPasswordUnchanged()
    {
        var client = _factory.CreateClient();
        var email = $"user-{Guid.NewGuid():N}@example.test";
        await client.PostAsJsonAsync("/api/auth/register", new { email, password = "CorrectHorse123!" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "CorrectHorse123!" });
        var token = (await loginResponse.Content.ReadFromJsonAsync<LoginResponse>())!.Token;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var changeResponse = await client.PostAsJsonAsync("/api/auth/change-password",
            new { currentPassword = "WrongPassword123!", newPassword = "NewCorrectHorse456!" });

        Assert.Equal(HttpStatusCode.BadRequest, changeResponse.StatusCode);

        var stillWorksResponse = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login",
            new { email, password = "CorrectHorse123!" });
        Assert.Equal(HttpStatusCode.OK, stillWorksResponse.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WithWeakNewPassword_Returns400()
    {
        var client = _factory.CreateClient();
        var email = $"user-{Guid.NewGuid():N}@example.test";
        await client.PostAsJsonAsync("/api/auth/register", new { email, password = "CorrectHorse123!" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "CorrectHorse123!" });
        var token = (await loginResponse.Content.ReadFromJsonAsync<LoginResponse>())!.Token;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var changeResponse = await client.PostAsJsonAsync("/api/auth/change-password",
            new { currentPassword = "CorrectHorse123!", newPassword = "weak" });

        Assert.Equal(HttpStatusCode.BadRequest, changeResponse.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_Unauthenticated_Returns401()
    {
        var client = _factory.CreateClient();

        var changeResponse = await client.PostAsJsonAsync("/api/auth/change-password",
            new { currentPassword = "CorrectHorse123!", newPassword = "NewCorrectHorse456!" });

        Assert.Equal(HttpStatusCode.Unauthorized, changeResponse.StatusCode);
    }

    private record LoginResponse(string Token, DateTime ExpiresAtUtc);
}
