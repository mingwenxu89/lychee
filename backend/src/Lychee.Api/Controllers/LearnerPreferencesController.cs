using Lychee.Api.Auth;
using Lychee.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lychee.Api.Controllers;

public record TranslationLanguagePreferenceResponse(string? LanguageCode);
public record SetTranslationLanguageRequest(string? LanguageCode);

[ApiController]
[Authorize]
public class LearnerPreferencesController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public LearnerPreferencesController(LycheeDbContext db) => _db = db;

    [HttpGet("api/learner/preferences/translation-language")]
    public async Task<IActionResult> GetTranslationLanguage()
    {
        var userId = User.GetUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new TranslationLanguagePreferenceResponse(user.PreferredTranslationLanguageCode));
    }

    [HttpPut("api/learner/preferences/translation-language")]
    public async Task<IActionResult> SetTranslationLanguage(SetTranslationLanguageRequest request)
    {
        var userId = User.GetUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        user.PreferredTranslationLanguageCode = string.IsNullOrEmpty(request.LanguageCode) ? null : request.LanguageCode;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
