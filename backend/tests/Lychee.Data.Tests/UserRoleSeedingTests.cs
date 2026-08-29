using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Lychee.Data.Tests;

public class UserRoleSeedingTests
{
    private const string TestConnectionString =
        "Host=localhost;Port=5433;Database=lychee_test;Username=lychee;Password=lychee_dev_password";

    private static LycheeDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<LycheeDbContext>()
            .UseNpgsql(TestConnectionString)
            .Options;
        var context = new LycheeDbContext(options);
        context.Database.Migrate();
        return context;
    }

    [Fact]
    public async Task NewApplicationUser_DefaultsTotalCompletedSentencesToZero()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = $"user-{Guid.NewGuid():N}@example.test",
            Email = $"user-{Guid.NewGuid():N}@example.test"
        };

        context.Users.Add(user);
        await context.SaveChangesAsync();

        await using var reloadContext = CreateContext();
        var reloaded = await reloadContext.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(0, reloaded.TotalCompletedSentences);
    }

    [Fact]
    public async Task Roles_AdminAndUser_ExistAfterStartupSeed()
    {
        await using var context = CreateContext();

        await IdentitySeeding.SeedRolesAsync(context);

        var roleNames = await context.Roles.Select(r => r.Name).ToListAsync();
        Assert.Contains("Admin", roleNames);
        Assert.Contains("User", roleNames);
    }
}
