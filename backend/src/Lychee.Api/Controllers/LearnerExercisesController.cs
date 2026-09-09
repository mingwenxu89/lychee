using Lychee.Api.Auth;
using Lychee.Api.Content;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record LearnerExerciseResponse(
    Guid Id, string Title, string? DifficultyRangeLabel,
    int TrackCount, int CompletedTrackCount, DateTime? LastPracticedAt);

public record LearnerExerciseTrackResponse(
    Guid Id, string Title, string? Description, string Level, TimeSpan Duration,
    int SentenceCount, int WordsPerMinute, bool IsCompletedByUser);
public record LearnerExerciseUnitResponse(Guid Id, string Title, int Order, List<LearnerExerciseTrackResponse> Tracks);
public record LearnerExerciseDetailResponse(Guid Id, string Title, string? Description, List<LearnerExerciseUnitResponse> Units);

[ApiController]
[Authorize]
public class LearnerExercisesController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public LearnerExercisesController(LycheeDbContext db) => _db = db;

    [HttpGet("api/learner/exercises")]
    public async Task<IActionResult> List()
    {
        var exercises = await _db.Exercises
            .Where(e => e.IsPublished)
            .OrderBy(e => e.Order)
            .Include(e => e.Units.Where(u => u.IsPublished))
                .ThenInclude(u => u.Tracks.Where(t => t.IsPublished))
            .ToListAsync();

        var userId = User.GetUserId();
        var allTrackIds = exercises
            .SelectMany(e => e.Units)
            .SelectMany(u => u.Tracks)
            .Select(t => t.Id)
            .ToList();

        var sessions = await _db.PracticeSessions
            .Where(s => s.UserId == userId && allTrackIds.Contains(s.TrackId))
            .Select(s => new { s.TrackId, s.Status, s.UpdatedAt })
            .ToListAsync();

        var attempts = await _db.RecitationAttempts
            .Where(a => a.UserId == userId && allTrackIds.Contains(a.TrackId))
            .Select(a => new { a.TrackId, a.CreatedAt })
            .ToListAsync();

        var responses = new List<LearnerExerciseResponse>();
        foreach (var exercise in exercises)
        {
            var tracks = exercise.Units.SelectMany(u => u.Tracks).ToList();
            var trackIds = tracks.Select(t => t.Id).ToHashSet();

            var completedTrackCount = sessions.Count(s => trackIds.Contains(s.TrackId) && s.Status == PracticeSessionStatus.Completed);

            var sessionTimes = sessions.Where(s => trackIds.Contains(s.TrackId)).Select(s => (DateTime?)s.UpdatedAt);
            var attemptTimes = attempts.Where(a => trackIds.Contains(a.TrackId)).Select(a => (DateTime?)a.CreatedAt);
            var lastPracticedAt = sessionTimes.Concat(attemptTimes).DefaultIfEmpty(null).Max();

            string? difficultyRangeLabel = null;
            if (tracks.Count > 0)
            {
                var levels = tracks.Select(t => t.Level).Distinct().OrderBy(l => l).ToList();
                difficultyRangeLabel = levels.Count == 1 ? levels[0] : $"{levels.First()}-{levels.Last()}";
            }

            responses.Add(new LearnerExerciseResponse(
                exercise.Id, exercise.Title, difficultyRangeLabel,
                tracks.Count, completedTrackCount, lastPracticedAt));
        }

        return Ok(responses);
    }

    [HttpGet("api/learner/exercises/{id}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var exercise = await _db.Exercises
            .Where(e => e.Id == id && e.IsPublished)
            .Include(e => e.Units.Where(u => u.IsPublished))
                .ThenInclude(u => u.Tracks.Where(t => t.IsPublished))
                    .ThenInclude(t => t.Sentences)
            .FirstOrDefaultAsync();
        if (exercise is null) return NotFound();

        var userId = User.GetUserId();
        var trackIds = exercise.Units.SelectMany(u => u.Tracks).Select(t => t.Id).ToList();
        var completedTrackIds = await _db.PracticeSessions
            .Where(s => s.UserId == userId && trackIds.Contains(s.TrackId) && s.Status == PracticeSessionStatus.Completed)
            .Select(s => s.TrackId)
            .ToListAsync();
        var completedSet = completedTrackIds.ToHashSet();

        var units = exercise.Units
            .OrderBy(u => u.Order)
            .Select(u => new LearnerExerciseUnitResponse(
                u.Id, u.Title, u.Order,
                u.Tracks.OrderBy(t => t.Order).Select(t => new LearnerExerciseTrackResponse(
                    t.Id, t.Title, t.Description, t.Level, t.Duration,
                    t.Sentences.Count, TrackMetrics.ComputeWordsPerMinute(t), completedSet.Contains(t.Id))).ToList()))
            .ToList();

        return Ok(new LearnerExerciseDetailResponse(exercise.Id, exercise.Title, exercise.Description, units));
    }
}
