using Lychee.Api.Auth;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Lychee.Api.Controllers;

public record RegisterRequest(string Email, string Password);
public record LoginRequest(string Email, string Password);
public record LoginResponse(string Token, DateTime ExpiresAtUtc);

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtTokenService _jwtTokenService;

    public AuthController(UserManager<ApplicationUser> userManager, IJwtTokenService jwtTokenService)
    {
        _userManager = userManager;
        _jwtTokenService = jwtTokenService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = request.Email,
            Email = request.Email
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        await _userManager.AddToRoleAsync(user, "User");
        return Created(string.Empty, new { user.Id, user.Email });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null || !await _userManager.CheckPasswordAsync(user, request.Password))
        {
            return Unauthorized();
        }

        var roles = await _userManager.GetRolesAsync(user);
        var (token, expiresAtUtc) = _jwtTokenService.CreateToken(user, roles);
        return Ok(new LoginResponse(token, expiresAtUtc));
    }
}
