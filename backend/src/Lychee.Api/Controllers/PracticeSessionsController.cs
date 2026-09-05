using Lychee.Api.Auth;
using Lychee.Api.Content;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record PracticeSessionResponse(Guid Id, Guid TrackId, int CurrentSentenceIndex, string Status, DateTime? CompletedAt);
public record WordDiffResponse(string Word, string Status);
public record SubmitAnswerRequest(Guid SentenceId);
public record AdvanceSessionRequest(int ToIndex);
public record AdvanceSessionResponse(int CurrentSentenceIndex, bool IsCompleted);

[ApiController]
[Authorize]
public class PracticeSessionsController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public PracticeSessionsController(LycheeDbContext db) => _db = db;

    private static PracticeSessionResponse ToResponse(PracticeSession s) =>
        new(s.Id, s.TrackId, s.CurrentSentenceIndex, s.Status.ToString(), s.CompletedAt);

    [HttpPost("api/learner/tracks/{trackId}/practice-session/start")]
    public async Task<IActionResult> Start(Guid trackId)
    {
        var trackExists = await _db.Tracks.AnyAsync(t => t.Id == trackId);
        if (!trackExists) return NotFound();

        var userId = User.GetUserId();
        var session = await _db.PracticeSessions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TrackId == trackId && s.Mode == PracticeMode.Sentence);

        if (session is null)
        {
            session = new PracticeSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TrackId = trackId,
                Mode = PracticeMode.Sentence,
                Status = PracticeSessionStatus.InProgress,
                CurrentSentenceIndex = 0,
                UpdatedAt = DateTime.UtcNow
            };
            _db.PracticeSessions.Add(session);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Another concurrent request for this (user, track, mode) won the insert race
                // against the unique index — return the session it just created instead of
                // erroring. React StrictMode's double-invoked effects trigger this reliably in
                // dev; genuine concurrent requests (double-click, multiple tabs) can too.
                _db.Entry(session).State = EntityState.Detached;
                session = await _db.PracticeSessions
                    .FirstAsync(s => s.UserId == userId && s.TrackId == trackId && s.Mode == PracticeMode.Sentence);
            }

            return Ok(ToResponse(session));
        }

        if (session.Status == PracticeSessionStatus.Completed)
        {
            session.Status = PracticeSessionStatus.InProgress;
            session.CurrentSentenceIndex = 0;
            session.CompletedAt = null;
            session.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(ToResponse(session));
    }

    // The frontend computes correctness itself (see frontend/src/lib/textComparer.ts) and only
    // ever calls this endpoint for a correct answer — a wrong attempt never reaches the backend
    // at all. The only lasting effect is the DailyPracticeLog entry below, for the activity-streak
    // feature; nothing about this specific submission (its text, or that it happened) is kept.
    [HttpPost("api/learner/practice-sessions/{sessionId}/submit")]
    public async Task<IActionResult> Submit(Guid sessionId, SubmitAnswerRequest request)
    {
        var userId = User.GetUserId();
        var session = await _db.PracticeSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId && s.Mode == PracticeMode.Sentence);
        if (session is null) return NotFound();

        var sentence = await _db.Sentences.FirstOrDefaultAsync(s => s.Id == request.SentenceId && s.TrackId == session.TrackId);
        if (sentence is null) return NotFound();

        // Logged for future activity-streak tracking (see spec §9); DailyPracticeLog's own unique
        // index (UserId, Date, SentenceId, PracticeType) makes retries same-day a no-op insert, not a duplicate.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var alreadyLoggedToday = await _db.DailyPracticeLogs.AnyAsync(l =>
            l.UserId == userId && l.Date == today && l.SentenceId == sentence.Id && l.PracticeType == PracticeLogType.Practice);
        if (!alreadyLoggedToday)
        {
            _db.DailyPracticeLogs.Add(new DailyPracticeLog
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Date = today,
                SentenceId = sentence.Id,
                PracticeType = PracticeLogType.Practice
            });
        }

        // See DbErrorHelpers for why this needs to recover from both a unique-violation and a
        // deadlock: two concurrent Submit calls for the same (user, date, sentence, type) can hit
        // either, and either one should not cost us the PracticeRecord added above.
        await DbErrorHelpers.SaveChangesRecoveringDailyPracticeLogRaceAsync(_db);

        return NoContent();
    }

    [HttpPost("api/learner/practice-sessions/{sessionId}/advance")]
    public async Task<IActionResult> Advance(Guid sessionId, AdvanceSessionRequest request)
    {
        var userId = User.GetUserId();
        var session = await _db.PracticeSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId && s.Mode == PracticeMode.Sentence);
        if (session is null) return NotFound();

        var sentenceCount = await _db.Sentences.CountAsync(s => s.TrackId == session.TrackId);
        var isCompleted = request.ToIndex >= sentenceCount;

        session.CurrentSentenceIndex = request.ToIndex;
        session.UpdatedAt = DateTime.UtcNow;

        if (isCompleted)
        {
            session.Status = PracticeSessionStatus.Completed;
            session.CompletedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new AdvanceSessionResponse(session.CurrentSentenceIndex, isCompleted));
    }
}
