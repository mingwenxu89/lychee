using Lychee.Api.Auth;
using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record FavoriteTrackResponse(
    Guid Id, string Title, string? Description, Guid ExerciseId, string ExerciseTitle,
    string Level, TimeSpan Duration, int SentenceCount, DateTime FavoritedAt);

[ApiController]
[Authorize]
public class LearnerFavoritesController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public LearnerFavoritesController(LycheeDbContext db) => _db = db;

    [HttpPut("api/learner/tracks/{trackId}/favorite")]
    public async Task<IActionResult> FavoriteTrack(Guid trackId)
    {
        var userId = User.GetUserId();
        var trackExists = await _db.Tracks.AnyAsync(t =>
            t.Id == trackId && t.IsPublished && t.Unit.IsPublished && t.Unit.Exercise.IsPublished);
        if (!trackExists) return NotFound();

        var alreadyFavorited = await _db.TrackFavorites.AnyAsync(f => f.UserId == userId && f.TrackId == trackId);
        if (!alreadyFavorited)
        {
            _db.TrackFavorites.Add(new TrackFavorite { UserId = userId, TrackId = trackId, CreatedAt = DateTime.UtcNow });
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpDelete("api/learner/tracks/{trackId}/favorite")]
    public async Task<IActionResult> UnfavoriteTrack(Guid trackId)
    {
        var userId = User.GetUserId();
        var favorite = await _db.TrackFavorites.FindAsync(userId, trackId);
        if (favorite is not null)
        {
            _db.TrackFavorites.Remove(favorite);
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpGet("api/learner/favorites/tracks")]
    public async Task<IActionResult> ListFavoriteTracks(int page = 1, int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var userId = User.GetUserId();

        var query = _db.TrackFavorites.Where(f => f.UserId == userId);
        var totalCount = await query.CountAsync();
        var favorites = await query
            .Include(f => f.Track).ThenInclude(t => t.Sentences)
            .Include(f => f.Track).ThenInclude(t => t.Unit).ThenInclude(u => u.Exercise)
            .OrderByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = favorites.Select(f => new FavoriteTrackResponse(
            f.Track.Id, f.Track.Title, f.Track.Description, f.Track.Unit.ExerciseId, f.Track.Unit.Exercise.Title,
            f.Track.Level, f.Track.Duration, f.Track.Sentences.Count, f.CreatedAt)).ToList();

        return Ok(new PagedResponse<FavoriteTrackResponse>(response, totalCount, page, pageSize));
    }
}
