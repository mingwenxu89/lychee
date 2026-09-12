using Lychee.Api.Auth;
using Lychee.Data;
using Lychee.Data.Entities;
using Lychee.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record FavoriteTrackResponse(
    Guid Id, string Title, string? Description, Guid ExerciseId, string ExerciseTitle,
    string Level, TimeSpan Duration, int SentenceCount, DateTime FavoritedAt);

public record FavoriteSentenceResponse(
    Guid Id, int Index, string Text, TimeSpan StartTime, TimeSpan EndTime,
    Guid TrackId, string TrackTitle, string ExerciseTitle, string AudioUrl, DateTime FavoritedAt);

[ApiController]
[Authorize]
public class LearnerFavoritesController : ControllerBase
{
    private readonly LycheeDbContext _db;
    private readonly IBlobStorageService _blobStorageService;

    public LearnerFavoritesController(LycheeDbContext db, IBlobStorageService blobStorageService)
    {
        _db = db;
        _blobStorageService = blobStorageService;
    }

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

    [HttpPut("api/learner/sentences/{sentenceId}/favorite")]
    public async Task<IActionResult> FavoriteSentence(Guid sentenceId)
    {
        var userId = User.GetUserId();
        var sentenceExists = await _db.Sentences.AnyAsync(s =>
            s.Id == sentenceId && s.Track.IsPublished && s.Track.Unit.IsPublished && s.Track.Unit.Exercise.IsPublished);
        if (!sentenceExists) return NotFound();

        var alreadyFavorited = await _db.SentenceFavorites.AnyAsync(f => f.UserId == userId && f.SentenceId == sentenceId);
        if (!alreadyFavorited)
        {
            _db.SentenceFavorites.Add(new SentenceFavorite { UserId = userId, SentenceId = sentenceId, CreatedAt = DateTime.UtcNow });
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpDelete("api/learner/sentences/{sentenceId}/favorite")]
    public async Task<IActionResult> UnfavoriteSentence(Guid sentenceId)
    {
        var userId = User.GetUserId();
        var favorite = await _db.SentenceFavorites.FindAsync(userId, sentenceId);
        if (favorite is not null)
        {
            _db.SentenceFavorites.Remove(favorite);
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpGet("api/learner/favorites/sentences")]
    public async Task<IActionResult> ListFavoriteSentences(int page = 1, int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var userId = User.GetUserId();

        var query = _db.SentenceFavorites.Where(f => f.UserId == userId);
        var totalCount = await query.CountAsync();
        var favorites = await query
            .Include(f => f.Sentence).ThenInclude(s => s.Track).ThenInclude(t => t.Unit).ThenInclude(u => u.Exercise)
            .OrderByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var audioUrlByTrackId = new Dictionary<Guid, string>();
        foreach (var trackId in favorites.Select(f => f.Sentence.Track.Id).Distinct())
        {
            var track = favorites.First(f => f.Sentence.Track.Id == trackId).Sentence.Track;
            var parts = track.AudioFileUrl.Split('/', 2);
            audioUrlByTrackId[trackId] = await _blobStorageService.GetReadUrlAsync(parts[0], parts[1], TimeSpan.FromHours(2));
        }

        var response = favorites.Select(f => new FavoriteSentenceResponse(
            f.Sentence.Id, f.Sentence.Index, f.Sentence.Text, f.Sentence.StartTime, f.Sentence.EndTime,
            f.Sentence.Track.Id, f.Sentence.Track.Title, f.Sentence.Track.Unit.Exercise.Title,
            audioUrlByTrackId[f.Sentence.Track.Id], f.CreatedAt)).ToList();

        return Ok(new PagedResponse<FavoriteSentenceResponse>(response, totalCount, page, pageSize));
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
