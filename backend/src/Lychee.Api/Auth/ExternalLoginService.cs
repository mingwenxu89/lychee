using System.Security.Claims;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Identity;

namespace Lychee.Api.Auth;

public class ExternalLoginService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public ExternalLoginService(UserManager<ApplicationUser> userManager) => _userManager = userManager;

    public async Task<ApplicationUser> FindOrCreateUserAsync(ClaimsPrincipal externalPrincipal)
    {
        var email = externalPrincipal.FindFirstValue(ClaimTypes.Email)
            ?? throw new InvalidOperationException("External login did not provide an email claim.");

        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            return existing;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                "Failed to create user from external login: " +
                string.Join(", ", result.Errors.Select(e => e.Description)));
        }

        await _userManager.AddToRoleAsync(user, "User");
        return user;
    }
}
