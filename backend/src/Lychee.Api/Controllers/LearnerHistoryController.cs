using Lychee.Api.Auth;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record HistoryEntryResponse(
    Guid TrackId, string TrackTitle, string ExerciseTitle, string PracticeType,
    string Status, double? Accuracy, int? CurrentSentenceIndex, int? TotalSentences,
    DateTime Timestamp);

[ApiController]
[Authorize]
public class LearnerHistoryController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public LearnerHistoryController(LycheeDbContext db) => _db = db;

    [HttpGet("api/learner/history")]
    public async Task<IActionResult> List()
    {
        var userId = User.GetUserId();

        var sessions = await _db.PracticeSessions
            .Where(s => s.UserId == userId
                && s.Track.IsPublished && s.Track.Unit.IsPublished && s.Track.Unit.Exercise.IsPublished)
            .Include(s => s.Track).ThenInclude(t => t.Unit).ThenInclude(u => u.Exercise)
            .Include(s => s.Track).ThenInclude(t => t.Sentences)
            .ToListAsync();

        var attempts = await _db.RecitationAttempts
            .Where(a => a.UserId == userId
                && a.Track.IsPublished && a.Track.Unit.IsPublished && a.Track.Unit.Exercise.IsPublished)
            .Include(a => a.Track).ThenInclude(t => t.Unit).ThenInclude(u => u.Exercise)
            .ToListAsync();

        var entries = new List<HistoryEntryResponse>();

        foreach (var session in sessions)
        {
            // Sentence Dictation has no completion score — see PracticeSessionsController.Advance.
            entries.Add(new HistoryEntryResponse(
                session.TrackId, session.Track.Title, session.Track.Unit.Exercise.Title, "Practice",
                session.Status.ToString(), null,
                session.Status == PracticeSessionStatus.Completed ? null : session.CurrentSentenceIndex,
                session.Status == PracticeSessionStatus.Completed ? null : session.Track.Sentences.Count,
                session.UpdatedAt));
        }

        foreach (var attempt in attempts)
        {
            entries.Add(new HistoryEntryResponse(
                attempt.TrackId, attempt.Track.Title, attempt.Track.Unit.Exercise.Title, "Recitation",
                "Completed", attempt.Score, null, null, attempt.CreatedAt));
        }

        return Ok(entries.OrderByDescending(e => e.Timestamp).ToList());
    }
}
