using Lychee.Api.Auth;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record FullDictationSessionResponse(
    Guid Id, Guid TrackId, string Status, int CurrentRound, string CurrentPhase,
    List<Guid> CorrectSentenceIds, DateTime? CompletedAt);
public record CheckpointRequest(int CurrentRound, string CurrentPhase, List<Guid> NewlyCorrectSentenceIds);
public record CompleteRequest(List<Guid> NewlyCorrectSentenceIds);
public record CompleteResponse(double Score, List<Guid> FinalCorrectSentenceIds);

[ApiController]
[Authorize]
public class FullDictationSessionsController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public FullDictationSessionsController(LycheeDbContext db) => _db = db;

    private async Task<FullDictationSessionResponse> ToResponseAsync(FullDictationSession s)
    {
        var correctIds = await _db.FullDictationSentenceResults
            .Where(r => r.SessionId == s.Id && r.IsCorrect)
            .Select(r => r.SentenceId)
            .ToListAsync();
        return new(s.Id, s.TrackId, s.Status.ToString(), s.CurrentRound, s.CurrentPhase.ToString(), correctIds, s.CompletedAt);
    }

    [HttpPost("api/learner/tracks/{trackId}/full-dictation-session/start")]
    public async Task<IActionResult> Start(Guid trackId)
    {
        var trackExists = await _db.Tracks.AnyAsync(t => t.Id == trackId);
        if (!trackExists) return NotFound();

        var userId = User.GetUserId();
        var session = await _db.FullDictationSessions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TrackId == trackId);

        if (session is null)
        {
            session = new FullDictationSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TrackId = trackId,
                Status = FullDictationSessionStatus.InProgress,
                CurrentRound = 1,
                CurrentPhase = FullDictationPhase.Blind,
                UpdatedAt = DateTime.UtcNow
            };
            _db.FullDictationSessions.Add(session);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Another concurrent request for this (user, track) won the insert race against
                // the unique (UserId, TrackId) index — return the session it just created instead
                // of erroring, mirroring PracticeSessionsController.Start.
                _db.Entry(session).State = EntityState.Detached;
                session = await _db.FullDictationSessions
                    .FirstAsync(s => s.UserId == userId && s.TrackId == trackId);
            }

            return Ok(await ToResponseAsync(session));
        }

        if (session.Status == FullDictationSessionStatus.Completed)
        {
            var oldResults = await _db.FullDictationSentenceResults
                .Where(r => r.SessionId == session.Id)
                .ToListAsync();
            _db.FullDictationSentenceResults.RemoveRange(oldResults);

            session.Status = FullDictationSessionStatus.InProgress;
            session.CurrentRound = 1;
            session.CurrentPhase = FullDictationPhase.Blind;
            session.CompletedAt = null;
            session.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(await ToResponseAsync(session));
    }

    [HttpPost("api/learner/full-dictation-sessions/{sessionId}/checkpoint")]
    public async Task<IActionResult> Checkpoint(Guid sessionId, CheckpointRequest request)
    {
        var userId = User.GetUserId();
        var session = await _db.FullDictationSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        if (session is null) return NotFound();

        if (!Enum.TryParse<FullDictationPhase>(request.CurrentPhase, out var currentPhase))
            return BadRequest($"Unrecognized phase '{request.CurrentPhase}'.");

        await UpsertCorrectResultsAsync(session, request.NewlyCorrectSentenceIds);

        session.CurrentRound = request.CurrentRound;
        session.CurrentPhase = currentPhase;
        session.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("api/learner/full-dictation-sessions/{sessionId}/complete")]
    public async Task<IActionResult> Complete(Guid sessionId, CompleteRequest request)
    {
        var userId = User.GetUserId();
        var session = await _db.FullDictationSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        if (session is null) return NotFound();

        await UpsertCorrectResultsAsync(session, request.NewlyCorrectSentenceIds);

        session.Status = FullDictationSessionStatus.Completed;
        session.CompletedAt = DateTime.UtcNow;
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

    private async Task UpsertCorrectResultsAsync(FullDictationSession session, List<Guid> newlyCorrectSentenceIds)
    {
        if (newlyCorrectSentenceIds.Count == 0) return;

        // Constrain to sentence ids that actually belong to this session's track — a client
        // could otherwise submit ids from an unrelated track, inflating its score and creating
        // FullDictationSentenceResult rows that point outside the track. Grading itself is
        // client-side by design, so this is a data-integrity guard, not a security boundary.
        var validSentenceIds = await _db.Sentences
            .Where(s => s.TrackId == session.TrackId && newlyCorrectSentenceIds.Contains(s.Id))
            .Select(s => s.Id)
            .ToListAsync();

        if (validSentenceIds.Count == 0) return;

        var existing = await _db.FullDictationSentenceResults
            .Where(r => r.SessionId == session.Id && validSentenceIds.Contains(r.SentenceId))
            .ToListAsync();
        var existingSentenceIds = existing.Select(r => r.SentenceId).ToHashSet();

        foreach (var result in existing)
        {
            result.IsCorrect = true;
        }

        foreach (var sentenceId in validSentenceIds.Distinct().Where(id => !existingSentenceIds.Contains(id)))
        {
            _db.FullDictationSentenceResults.Add(new FullDictationSentenceResult
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                SentenceId = sentenceId,
                IsCorrect = true
            });
        }
    }
}
