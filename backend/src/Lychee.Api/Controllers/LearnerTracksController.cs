using Lychee.Api.Auth;
using Lychee.Api.Content;
using Lychee.Data;
using Lychee.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record LearnerSentenceResponse(Guid Id, int Index, string Text, TimeSpan StartTime, TimeSpan EndTime, string? Translation);

public record LearnerTrackResponse(
    Guid Id, Guid UnitId, Guid ExerciseId, string Title, string? Description, string ExerciseTitle, string Level,
    int WordsPerMinute, TimeSpan Duration, string AudioUrl, List<LearnerSentenceResponse> Sentences, Guid? NextTrackId,
    bool IsFavorited);

[ApiController]
[Authorize]
public class LearnerTracksController : ControllerBase
{
    private readonly LycheeDbContext _db;
    private readonly IBlobStorageService _blobStorageService;

    public LearnerTracksController(LycheeDbContext db, IBlobStorageService blobStorageService)
    {
        _db = db;
        _blobStorageService = blobStorageService;
    }

    [HttpGet("api/learner/tracks/{id}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var track = await _db.Tracks
            .Include(t => t.Sentences)
            .Include(t => t.Unit).ThenInclude(u => u.Exercise)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (track is null) return NotFound();

        var siblingTracks = await _db.Tracks
            .Where(t => t.Unit.ExerciseId == track.Unit.ExerciseId)
            .Select(t => new { t.Id, t.UnitId, UnitOrder = t.Unit.Order, t.Order })
            .ToListAsync();

        var nextTrackId = NextTrackResolver.FindNextTrackId(
            id,
            siblingTracks.Select(t => (t.UnitId, t.UnitOrder, t.Id, t.Order)).ToList());

        var audioParts = track.AudioFileUrl.Split('/', 2);
        var audioUrl = await _blobStorageService.GetReadUrlAsync(audioParts[0], audioParts[1], TimeSpan.FromHours(2));

        var userId = User.GetUserId();
        var isTrackFavorited = await _db.TrackFavorites.AnyAsync(f => f.UserId == userId && f.TrackId == track.Id);

        var user = await _db.Users.FindAsync(userId);
        var translationBySentenceId = new Dictionary<Guid, string>();
        if (!string.IsNullOrEmpty(user?.PreferredTranslationLanguageCode))
        {
            translationBySentenceId = await _db.SentenceTranslations
                .Where(t => t.LanguageCode == user.PreferredTranslationLanguageCode && t.Sentence.TrackId == track.Id)
                .ToDictionaryAsync(t => t.SentenceId, t => t.TranslatedText);
        }

        var sentences = track.Sentences
            .OrderBy(s => s.Index)
            .Select(s => new LearnerSentenceResponse(
                s.Id, s.Index, s.Text, s.StartTime, s.EndTime,
                translationBySentenceId.TryGetValue(s.Id, out var translated) ? translated : null))
            .ToList();

        return Ok(new LearnerTrackResponse(
            track.Id, track.UnitId, track.Unit.ExerciseId, track.Title, track.Description, track.Unit.Exercise.Title,
            track.Level, TrackMetrics.ComputeWordsPerMinute(track), track.Duration, audioUrl, sentences, nextTrackId,
            isTrackFavorited));
    }
}
