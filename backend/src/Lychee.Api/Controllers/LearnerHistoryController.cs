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
    public async Task<IActionResult> List(int page = 1, int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var userId = User.GetUserId();

        var sessionKeysQuery = _db.PracticeSessions
            .Where(s => s.UserId == userId
                && s.Track.IsPublished && s.Track.Unit.IsPublished && s.Track.Unit.Exercise.IsPublished);
        var attemptKeysQuery = _db.RecitationAttempts
            .Where(a => a.UserId == userId
                && a.Track.IsPublished && a.Track.Unit.IsPublished && a.Track.Unit.Exercise.IsPublished);

        var totalCount = await sessionKeysQuery.CountAsync() + await attemptKeysQuery.CountAsync();

        // Lightweight anonymous-type projection used only to sort/page the two heterogeneous
        // sources together (EF Core translates a Concat of matching anonymous projections into a
        // SQL UNION ALL, unlike a projection to a named record, which forces client evaluation and
        // breaks the set operation) — full entity data for just the current page's rows is fetched
        // afterward below, so a large history never pulls more than pageSize rows' worth of joins.
        var sessionKeys = sessionKeysQuery.Select(s => new { s.Id, IsRecitation = false, Timestamp = s.UpdatedAt });
        var attemptKeys = attemptKeysQuery.Select(a => new { a.Id, IsRecitation = true, Timestamp = a.CreatedAt });

        var pageKeys = await sessionKeys.Concat(attemptKeys)
            .OrderByDescending(k => k.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var sessionIds = pageKeys.Where(k => !k.IsRecitation).Select(k => k.Id).ToList();
        var attemptIds = pageKeys.Where(k => k.IsRecitation).Select(k => k.Id).ToList();

        var sessions = await _db.PracticeSessions
            .Where(s => sessionIds.Contains(s.Id))
            .Include(s => s.Track).ThenInclude(t => t.Unit).ThenInclude(u => u.Exercise)
            .Include(s => s.Track).ThenInclude(t => t.Sentences)
            .ToListAsync();

        var attempts = await _db.RecitationAttempts
            .Where(a => attemptIds.Contains(a.Id))
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

        var ordered = entries.OrderByDescending(e => e.Timestamp).ToList();
        return Ok(new PagedResponse<HistoryEntryResponse>(ordered, totalCount, page, pageSize));
    }
}
