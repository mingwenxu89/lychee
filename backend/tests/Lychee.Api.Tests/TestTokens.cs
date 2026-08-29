using Lychee.Api.Auth;
using Lychee.Data.Entities;

namespace Lychee.Api.Tests;

public static class TestTokens
{
    public static string ForRole(IJwtTokenService jwtTokenService, string role)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.test",
            Email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.test"
        };
        var (token, _) = jwtTokenService.CreateToken(user, new[] { role });
        return token;
    }
}
