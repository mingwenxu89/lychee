using Lychee.Api.Auth;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

// SubmittedTexts (sentence id -> what the learner typed for it, as of the most recent submit)
// lets a resumed session pre-fill an upcoming sentence with what was typed for it last round,
// not just which sentence ids were correct.
public record FullDictationSessionResponse(
    Guid Id, Guid TrackId, string Status, int CurrentSentenceIndex,
    List<Guid> CorrectSentenceIds, Dictionary<Guid, string> SubmittedTexts, DateTime? CompletedAt);
public record FullDictationSubmitRequest(Guid SentenceId, bool IsCorrect, string SubmittedText);
public record CompleteResponse(double Score, List<Guid> FinalCorrectSentenceIds);

[ApiController]
[Authorize]
public class FullDictationSessionsController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public FullDictationSessionsController(LycheeDbContext db) => _db = db;

    private async Task<FullDictationSessionResponse> ToResponseAsync(PracticeSession s)
    {
        var results = await _db.FullDictationSentenceResults
            .Where(r => r.SessionId == s.Id)
            .ToListAsync();
        var correctIds = results.Where(r => r.IsCorrect).Select(r => r.SentenceId).ToList();
        var submittedTexts = results.ToDictionary(r => r.SentenceId, r => r.SubmittedText);
        return new(s.Id, s.TrackId, s.Status.ToString(), s.CurrentSentenceIndex, correctIds, submittedTexts, s.CompletedAt);
    }

    [HttpPost("api/learner/tracks/{trackId}/full-dictation-session/start")]
    public async Task<IActionResult> Start(Guid trackId)
    {
        var trackExists = await _db.Tracks.AnyAsync(t => t.Id == trackId);
        if (!trackExists) return NotFound();

        var userId = User.GetUserId();
        var session = await _db.PracticeSessions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TrackId == trackId && s.Mode == PracticeMode.FullDictation);

        if (session is null)
        {
            session = new PracticeSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TrackId = trackId,
                Mode = PracticeMode.FullDictation,
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
                // erroring, mirroring PracticeSessionsController.Start.
                _db.Entry(session).State = EntityState.Detached;
                session = await _db.PracticeSessions
                    .FirstAsync(s => s.UserId == userId && s.TrackId == trackId && s.Mode == PracticeMode.FullDictation);
            }

            return Ok(await ToResponseAsync(session));
        }

        if (session.Status == PracticeSessionStatus.Completed)
        {
            var oldResults = await _db.FullDictationSentenceResults
                .Where(r => r.SessionId == session.Id)
                .ToListAsync();
            _db.FullDictationSentenceResults.RemoveRange(oldResults);

            session.Status = PracticeSessionStatus.InProgress;
            session.CurrentSentenceIndex = 0;
            session.CompletedAt = null;
            session.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(await ToResponseAsync(session));
    }

    // Called once per sentence, immediately after the learner submits it (correct or not) —
    // unlike the old round-batched checkpoint, this lands right away so a mid-round close and
    // resume never loses progress within the round that was interrupted.
    [HttpPost("api/learner/full-dictation-sessions/{sessionId}/submit")]
    public async Task<IActionResult> Submit(Guid sessionId, FullDictationSubmitRequest request)
    {
        var userId = User.GetUserId();
        var session = await _db.PracticeSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId && s.Mode == PracticeMode.FullDictation);
        if (session is null) return NotFound();

        var sentence = await _db.Sentences.FirstOrDefaultAsync(s => s.Id == request.SentenceId && s.TrackId == session.TrackId);
        if (sentence is null) return NotFound();

        var existing = await _db.FullDictationSentenceResults
            .FirstOrDefaultAsync(r => r.SessionId == session.Id && r.SentenceId == request.SentenceId);
        if (existing is null)
        {
            _db.FullDictationSentenceResults.Add(new FullDictationSentenceResult
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                SentenceId = request.SentenceId,
                IsCorrect = request.IsCorrect,
                SubmittedText = request.SubmittedText
            });
        }
        else
        {
            existing.IsCorrect = request.IsCorrect;
            existing.SubmittedText = request.SubmittedText;
        }

        session.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // Pure position bookkeeping — the learner's own client tracks the current round's queue
    // (whichever sentences aren't correct yet) and decides when a round ends; this just persists
    // wherever they are so a resume lands on the same sentence, matching Sentence Dictation's
    // CurrentSentenceIndex. Passing 0 signals "starting a fresh round from its first sentence".
    [HttpPost("api/learner/full-dictation-sessions/{sessionId}/advance")]
    public async Task<IActionResult> Advance(Guid sessionId, AdvanceSessionRequest request)
    {
        var userId = User.GetUserId();
        var session = await _db.PracticeSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId && s.Mode == PracticeMode.FullDictation);
        if (session is null) return NotFound();

        session.CurrentSentenceIndex = request.ToIndex;
        session.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // Ends the session — either every sentence is finally correct, or the learner chose to stop
    // early ("Finish Now") with whatever's correct so far. Every sentence's correctness was
    // already persisted by Submit, so there's nothing left to record here beyond the final tally.
    [HttpPost("api/learner/full-dictation-sessions/{sessionId}/complete")]
    public async Task<IActionResult> Complete(Guid sessionId)
    {
        var userId = User.GetUserId();
        var session = await _db.PracticeSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId && s.Mode == PracticeMode.FullDictation);
        if (session is null) return NotFound();

        session.Status = PracticeSessionStatus.Completed;
        session.CompletedAt = DateTime.UtcNow;
        session.CurrentSentenceIndex = 0;
        session.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var totalSentences = await _db.Sentences.CountAsync(s => s.TrackId == session.TrackId);
        var finalCorrectIds = await _db.FullDictationSentenceResults
            .Where(r => r.SessionId == session.Id && r.IsCorrect)
            .Select(r => r.SentenceId)
            .ToListAsync();
        var score = totalSentences == 0 ? 0.0 : (double)finalCorrectIds.Count / totalSentences;

        return Ok(new CompleteResponse(score, finalCorrectIds));
    }
}
