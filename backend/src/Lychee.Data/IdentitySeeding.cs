using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Data;

public static class IdentitySeeding
{
    public static readonly string[] RoleNames = { "Admin", "User" };

    public static async Task SeedRolesAsync(LycheeDbContext context, CancellationToken ct = default)
    {
        foreach (var roleName in RoleNames)
        {
            var normalizedName = roleName.ToUpperInvariant();
            var exists = await context.Roles.AnyAsync(r => r.NormalizedName == normalizedName, ct);
            if (!exists)
            {
                context.Roles.Add(new IdentityRole<Guid>(roleName) { NormalizedName = normalizedName });
            }
        }
        await context.SaveChangesAsync(ct);
    }
}
