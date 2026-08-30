using Lychee.Api.Content;
using Lychee.Data;
using Lychee.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record LearnerSentenceResponse(Guid Id, int Index, string Text, TimeSpan StartTime, TimeSpan EndTime);

public record LearnerTrackResponse(
    Guid Id, Guid UnitId, Guid ExerciseId, string Level, TimeSpan Duration,
    string AudioUrl, List<LearnerSentenceResponse> Sentences, Guid? NextTrackId);

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
            .Include(t => t.Unit)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (track is null) return NotFound();

        var siblingTracks = await _db.Tracks
            .Where(t => t.Unit.ExerciseId == track.Unit.ExerciseId)
            .Select(t => new { t.Id, t.UnitId, UnitOrder = t.Unit.Order, t.CreatedAt })
            .ToListAsync();

        var nextTrackId = NextTrackResolver.FindNextTrackId(
            id,
            siblingTracks.Select(t => (t.UnitId, t.UnitOrder, t.Id, t.CreatedAt)).ToList());

        var audioParts = track.AudioFileUrl.Split('/', 2);
        var audioUrl = await _blobStorageService.GetReadUrlAsync(audioParts[0], audioParts[1], TimeSpan.FromHours(2));

        var sentences = track.Sentences
            .OrderBy(s => s.Index)
            .Select(s => new LearnerSentenceResponse(s.Id, s.Index, s.Text, s.StartTime, s.EndTime))
            .ToList();

        return Ok(new LearnerTrackResponse(
            track.Id, track.UnitId, track.Unit.ExerciseId, track.Level, track.Duration, audioUrl, sentences, nextTrackId));
    }
}
