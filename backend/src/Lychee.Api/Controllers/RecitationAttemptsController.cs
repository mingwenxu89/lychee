using System.Text.Json;
using Lychee.Api.Auth;
using Lychee.Api.Content;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record RecitationSubmitRequest(string SubmittedText);
public record RecitationAttemptResponse(Guid Id, double Score, List<WordDiffResponse> Words, List<Guid> QualifiedSentenceIds, DateTime CreatedAt);

[ApiController]
[Authorize]
public class RecitationAttemptsController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public RecitationAttemptsController(LycheeDbContext db) => _db = db;

    [HttpPost("api/learner/tracks/{trackId}/recitation-attempts")]
    public async Task<IActionResult> Submit(Guid trackId, RecitationSubmitRequest request)
    {
        var sentences = await _db.Sentences
            .Where(s => s.TrackId == trackId)
            .OrderBy(s => s.Index)
            .ToListAsync();
        var trackExists = sentences.Count > 0 || await _db.Tracks.AnyAsync(t => t.Id == trackId);
        if (!trackExists) return NotFound();

        var referenceText = string.Join(' ', sentences.Select(s => s.Text));
        var comparison = TextComparer.Compare(referenceText, request.SubmittedText);

        var qualifiedSentenceIds = new List<Guid>();
        var wordCursor = 0;
        var sentenceIndex = 0;
        var sentenceCorrectCount = 0;
        var sentenceWordCounts = sentences.Select(s => TextComparer.CountWords(s.Text)).ToList();
        var currentSentenceWordTarget = sentenceIndex < sentenceWordCounts.Count ? sentenceWordCounts[sentenceIndex] : 0;

        foreach (var word in comparison.Words)
        {
            if (word.Status == WordDiffStatus.Extra) continue;
            if (word.Status == WordDiffStatus.Correct) sentenceCorrectCount++;
            wordCursor++;

            if (sentenceIndex < sentenceWordCounts.Count && wordCursor == currentSentenceWordTarget)
            {
                if (sentenceWordCounts[sentenceIndex] > 0 && sentenceCorrectCount == sentenceWordCounts[sentenceIndex])
                {
                    qualifiedSentenceIds.Add(sentences[sentenceIndex].Id);
                }
                sentenceIndex++;
                sentenceCorrectCount = 0;
                if (sentenceIndex < sentenceWordCounts.Count) currentSentenceWordTarget += sentenceWordCounts[sentenceIndex];
            }
        }

        var userId = User.GetUserId();
        var attempt = new RecitationAttempt
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TrackId = trackId,
            SubmittedText = request.SubmittedText,
            Score = comparison.AccuracyScore,
            DiffDetail = JsonSerializer.Serialize(comparison.Words),
            QualifiedSentenceIds = qualifiedSentenceIds,
            CreatedAt = DateTime.UtcNow
        };
        _db.RecitationAttempts.Add(attempt);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        foreach (var sentenceId in qualifiedSentenceIds)
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

        await _db.SaveChangesAsync();

        return Ok(new RecitationAttemptResponse(
            attempt.Id,
            attempt.Score,
            comparison.Words.Select(w => new WordDiffResponse(w.Word, w.Status.ToString())).ToList(),
            qualifiedSentenceIds,
            attempt.CreatedAt));
    }
}
