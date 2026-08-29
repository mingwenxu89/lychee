using Lychee.Data.Entities;
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

    public static async Task SeedDefaultAdminAsync(UserManager<ApplicationUser> userManager, string email, string password)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            if (!await userManager.IsInRoleAsync(existing, "Admin"))
            {
                await userManager.AddToRoleAsync(existing, "Admin");
            }
            return;
        }

        var admin = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(admin, password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                "Failed to seed default admin user: " + string.Join(", ", result.Errors.Select(e => e.Description)));
        }

        await userManager.AddToRoleAsync(admin, "Admin");
    }
}
