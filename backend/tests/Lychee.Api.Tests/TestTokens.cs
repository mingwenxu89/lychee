using Lychee.Api.Auth;
using Lychee.Data;
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

    /// <summary>
    /// Like <see cref="ForRole"/>, but persists the backing ApplicationUser row first.
    /// Required for tests that exercise endpoints writing rows with a real FK to
    /// AspNetUsers (e.g. PracticeSession.UserId) — ForRole alone mints a JWT for a
    /// user that doesn't exist in the database, which trips the FK constraint.
    /// </summary>
    public static async Task<string> ForRoleAsync(IJwtTokenService jwtTokenService, LycheeDbContext db, string role)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.test",
            Email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.test"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var (token, _) = jwtTokenService.CreateToken(user, new[] { role });
        return token;
    }
}
