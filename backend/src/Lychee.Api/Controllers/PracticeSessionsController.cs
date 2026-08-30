using Lychee.Api.Auth;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record PracticeSessionResponse(Guid Id, Guid TrackId, int CurrentSentenceIndex, string Status, DateTime? CompletedAt);

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
            .FirstOrDefaultAsync(s => s.UserId == userId && s.TrackId == trackId);

        if (session is null)
        {
            session = new PracticeSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TrackId = trackId,
                Status = PracticeSessionStatus.InProgress,
                CurrentSentenceIndex = 0,
                UpdatedAt = DateTime.UtcNow
            };
            _db.PracticeSessions.Add(session);
        }
        else if (session.Status == PracticeSessionStatus.Completed)
        {
            session.Status = PracticeSessionStatus.InProgress;
            session.CurrentSentenceIndex = 0;
            session.CompletedAt = null;
            session.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(ToResponse(session));
    }
}
