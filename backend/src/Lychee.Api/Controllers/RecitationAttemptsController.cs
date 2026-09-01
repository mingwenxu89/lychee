using System.Text.Json;
using Lychee.Api.Auth;
using Lychee.Api.Content;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

// The frontend computes the whole-track comparison and per-sentence qualification itself (see
// frontend/src/lib/recitationScoring.ts) and sends the result here purely to be recorded — every
// recitation attempt is a permanent one-shot history entry regardless of score, so unlike
// dictation's Submit this is called for every attempt, not only high-scoring ones.
public record RecitationSubmitRequest(string SubmittedText, double Score, List<WordDiffResponse> Words, List<Guid> QualifiedSentenceIds);
public record RecitationAttemptResponse(Guid Id, DateTime CreatedAt);

[ApiController]
[Authorize]
public class RecitationAttemptsController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public RecitationAttemptsController(LycheeDbContext db) => _db = db;

    [HttpPost("api/learner/tracks/{trackId}/recitation-attempts")]
    public async Task<IActionResult> Submit(Guid trackId, RecitationSubmitRequest request)
    {
        var trackExists = await _db.Tracks.AnyAsync(t => t.Id == trackId);
        if (!trackExists) return NotFound();

        var userId = User.GetUserId();
        var attempt = new RecitationAttempt
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TrackId = trackId,
            SubmittedText = request.SubmittedText,
            Score = request.Score,
            DiffDetail = JsonSerializer.Serialize(request.Words),
            QualifiedSentenceIds = request.QualifiedSentenceIds,
            CreatedAt = DateTime.UtcNow
        };
        _db.RecitationAttempts.Add(attempt);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        foreach (var sentenceId in request.QualifiedSentenceIds)
        {
            var alreadyLoggedToday = await _db.DailyPracticeLogs.AnyAsync(l =>
                l.UserId == userId && l.Date == today && l.SentenceId == sentenceId && l.PracticeType == PracticeLogType.Recitation);
            if (!alreadyLoggedToday)
            {
                _db.DailyPracticeLogs.Add(new DailyPracticeLog
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Date = today,
                    SentenceId = sentenceId,
                    PracticeType = PracticeLogType.Recitation
                });
            }
        }

        // This call can add MULTIPLE DailyPracticeLog rows (one per qualified sentence) in the
        // same SaveChanges as the RecitationAttempt above. Concurrent identical attempts racing
        // on the same rows can surface as either a unique-violation or, because of the multi-row
        // batch, a Postgres deadlock — see DbErrorHelpers for why both need recovering so the
        // RecitationAttempt still commits.
        await DbErrorHelpers.SaveChangesRecoveringDailyPracticeLogRaceAsync(_db);

        return Ok(new RecitationAttemptResponse(attempt.Id, attempt.CreatedAt));
    }
}
