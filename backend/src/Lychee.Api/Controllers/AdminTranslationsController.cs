using Lychee.Api.Translation;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record GenerateTranslationsRequest(string LanguageCode, bool OverwriteManualEdits = false);
public record UpdateSentenceTranslationRequest(string TranslatedText);
public record SentenceTranslationResponse(Guid SentenceId, string LanguageCode, string TranslatedText, bool IsManuallyEdited);

[ApiController]
[Authorize(Roles = "Admin")]
public class AdminTranslationsController : ControllerBase
{
    private readonly LycheeDbContext _db;
    private readonly ITranslationProvider _translationProvider;

    public AdminTranslationsController(LycheeDbContext db, ITranslationProvider translationProvider)
    {
        _db = db;
        _translationProvider = translationProvider;
    }

    private static SentenceTranslationResponse ToResponse(SentenceTranslation t) =>
        new(t.SentenceId, t.LanguageCode, t.TranslatedText, t.IsManuallyEdited);

    [HttpGet("api/admin/tracks/{trackId}/translations")]
    public async Task<IActionResult> ListForTrack(Guid trackId, [FromQuery] string languageCode)
    {
        var translations = await _db.SentenceTranslations
            .Where(t => t.LanguageCode == languageCode && t.Sentence.TrackId == trackId)
            .ToListAsync();
        return Ok(translations.Select(ToResponse));
    }

    [HttpPost("api/admin/tracks/{trackId}/translations")]
    public async Task<IActionResult> GenerateForTrack(Guid trackId, GenerateTranslationsRequest request)
    {
        var sentences = await _db.Sentences
            .Where(s => s.TrackId == trackId)
            .OrderBy(s => s.Index)
            .ToListAsync();
        if (sentences.Count == 0) return NotFound();

        var sentenceIds = sentences.Select(s => s.Id).ToList();
        var existingBySentenceId = await _db.SentenceTranslations
            .Where(t => t.LanguageCode == request.LanguageCode && sentenceIds.Contains(t.SentenceId))
            .ToDictionaryAsync(t => t.SentenceId);

        var toTranslate = request.OverwriteManualEdits
            ? sentences
            : sentences.Where(s => !existingBySentenceId.TryGetValue(s.Id, out var t) || !t.IsManuallyEdited).ToList();

        if (toTranslate.Count > 0)
        {
            IReadOnlyList<string> translations;
            try
            {
                translations = await _translationProvider.TranslateBatchAsync(
                    toTranslate.Select(s => s.Text).ToList(), request.LanguageCode);
            }
            catch (TranslationProviderException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            if (translations.Count != toTranslate.Count)
            {
                return BadRequest(new { message = $"Translation provider returned {translations.Count} results for {toTranslate.Count} sentences." });
            }

            var now = DateTime.UtcNow;
            for (var i = 0; i < toTranslate.Count; i++)
            {
                var sentence = toTranslate[i];
                if (existingBySentenceId.TryGetValue(sentence.Id, out var row))
                {
                    row.TranslatedText = translations[i];
                    row.IsManuallyEdited = false;
                    row.Provider = _translationProvider.Name;
                    row.UpdatedAt = now;
                }
                else
                {
                    _db.SentenceTranslations.Add(new SentenceTranslation
                    {
                        Id = Guid.NewGuid(),
                        SentenceId = sentence.Id,
                        LanguageCode = request.LanguageCode,
                        TranslatedText = translations[i],
                        IsManuallyEdited = false,
                        Provider = _translationProvider.Name,
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                }
            }
            await _db.SaveChangesAsync();
        }

        var all = await _db.SentenceTranslations
            .Where(t => t.LanguageCode == request.LanguageCode && sentenceIds.Contains(t.SentenceId))
            .ToListAsync();
        return Ok(all.Select(ToResponse));
    }

    [HttpPut("api/admin/sentences/{sentenceId}/translations/{languageCode}")]
    public async Task<IActionResult> UpdateTranslation(Guid sentenceId, string languageCode, UpdateSentenceTranslationRequest request)
    {
        var sentenceExists = await _db.Sentences.AnyAsync(s => s.Id == sentenceId);
        if (!sentenceExists) return NotFound();

        var translation = await _db.SentenceTranslations
            .FirstOrDefaultAsync(t => t.SentenceId == sentenceId && t.LanguageCode == languageCode);
        var now = DateTime.UtcNow;
        if (translation is null)
        {
            translation = new SentenceTranslation
            {
                Id = Guid.NewGuid(),
                SentenceId = sentenceId,
                LanguageCode = languageCode,
                Provider = "manual",
                CreatedAt = now
            };
            _db.SentenceTranslations.Add(translation);
        }

        translation.TranslatedText = request.TranslatedText;
        translation.IsManuallyEdited = true;
        translation.UpdatedAt = now;
        await _db.SaveChangesAsync();

        return Ok(ToResponse(translation));
    }
}
