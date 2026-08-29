using System.Security.Claims;
using Lychee.Api.Auth;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class ExternalLoginServiceTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public ExternalLoginServiceTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private static ClaimsPrincipal GoogleClaimsFor(string email) => new(new ClaimsIdentity(new[]
    {
        new Claim(ClaimTypes.Email, email),
        new Claim(ClaimTypes.NameIdentifier, $"google-{Guid.NewGuid():N}")
    }, "Google"));

    [Fact]
    public async Task FindOrCreateUserAsync_CreatesNewUser_WhenEmailUnknown()
    {
        using var scope = _factory.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<ExternalLoginService>();
        var email = $"google-user-{Guid.NewGuid():N}@example.test";

        var user = await service.FindOrCreateUserAsync(GoogleClaimsFor(email));

        Assert.Equal(email, user.Email);
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = await userManager.GetRolesAsync(user);
        Assert.Contains("User", roles);
    }

    [Fact]
    public async Task FindOrCreateUserAsync_ReusesExistingUser_WhenEmailAlreadyRegistered()
    {
        using var scope = _factory.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<ExternalLoginService>();
        var email = $"existing-{Guid.NewGuid():N}@example.test";

        var first = await service.FindOrCreateUserAsync(GoogleClaimsFor(email));
        var second = await service.FindOrCreateUserAsync(GoogleClaimsFor(email));

        Assert.Equal(first.Id, second.Id);
    }
}
