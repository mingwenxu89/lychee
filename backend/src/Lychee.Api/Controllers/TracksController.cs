using Lychee.Api.Content;
using Lychee.Data;
using Lychee.Data.Entities;
using Lychee.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public class CreateTrackRequest
{
    public IFormFile AudioFile { get; set; } = null!;
    public IFormFile SrtFile { get; set; } = null!;
    public string Level { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
}

public record TrackResponse(Guid Id, Guid UnitId, string Title, string? Description, string AudioUrl, string SrtUrl, TimeSpan Duration, string Level, bool IsPublished, int SentenceCount);

public record UpdateTrackRequest(string Title, string Level, string? Description);
// UpdatePublishStatusRequest is defined in ExercisesController.cs and shared (same namespace).

[ApiController]
[Authorize(Roles = "Admin")]
public class TracksController : ControllerBase
{
    private readonly LycheeDbContext _db;
    private readonly IBlobStorageService _blobStorageService;

    public TracksController(LycheeDbContext db, IBlobStorageService blobStorageService)
    {
        _db = db;
        _blobStorageService = blobStorageService;
    }

    private async Task<TrackResponse> ToResponseAsync(Track t, int sentenceCount)
    {
        var audioUrl = await ResolveReadUrlAsync(t.AudioFileUrl);
        var srtUrl = await ResolveReadUrlAsync(t.SrtFileUrl);
        return new TrackResponse(t.Id, t.UnitId, t.Title, t.Description, audioUrl, srtUrl, t.Duration, t.Level, t.IsPublished, sentenceCount);
    }

    private Task<string> ResolveReadUrlAsync(string storedPath)
    {
        // Stored as "{containerName}/{blobName}" per IBlobStorageService.UploadAsync's
        // return contract — never a resolved URL, since an Azure SAS URL would expire.
        var parts = storedPath.Split('/', 2);
        return _blobStorageService.GetReadUrlAsync(parts[0], parts[1], TimeSpan.FromHours(1));
    }

    [HttpGet("api/admin/units/{unitId}/tracks")]
    public async Task<IActionResult> ListForUnit(Guid unitId)
    {
        var tracks = await _db.Tracks
            .Where(t => t.UnitId == unitId)
            .Include(t => t.Sentences)
            .ToListAsync();
        var responses = new List<TrackResponse>();
        foreach (var track in tracks)
        {
            responses.Add(await ToResponseAsync(track, track.Sentences.Count));
        }
        return Ok(responses);
    }

    [HttpPost("api/admin/units/{unitId}/tracks")]
    public async Task<IActionResult> Create(Guid unitId, [FromForm] CreateTrackRequest request)
    {
        var unitExists = await _db.Units.AnyAsync(u => u.Id == unitId);
        if (!unitExists) return NotFound();

        string srtText;
        using (var reader = new StreamReader(request.SrtFile.OpenReadStream()))
        {
            srtText = await reader.ReadToEndAsync();
        }
        var cues = SrtParser.Parse(srtText);

        var audioBlobName = $"{Guid.NewGuid()}{Path.GetExtension(request.AudioFile.FileName)}";
        await using var audioStream = request.AudioFile.OpenReadStream();
        var audioPath = await _blobStorageService.UploadAsync("audio", audioBlobName, audioStream, request.AudioFile.ContentType);

        var srtBlobName = $"{Guid.NewGuid()}.srt";
        var srtBytes = System.Text.Encoding.UTF8.GetBytes(srtText);
        await using var srtStream = new MemoryStream(srtBytes);
        var srtPath = await _blobStorageService.UploadAsync("srt", srtBlobName, srtStream, "text/plain");

        var duration = cues.Count > 0 ? cues.Max(c => c.End) : TimeSpan.Zero;

        var track = new Track
        {
            Id = Guid.NewGuid(),
            UnitId = unitId,
            AudioFileUrl = audioPath,
            SrtFileUrl = srtPath,
            Duration = duration,
            Level = request.Level,
            Title = request.Title,
            Description = request.Description,
            Sentences = cues.Select(c => new Sentence
            {
                Id = Guid.NewGuid(),
                Index = c.Index,
                Text = c.Text,
                StartTime = c.Start,
                EndTime = c.End
            }).ToList()
        };

        _db.Tracks.Add(track);
        await _db.SaveChangesAsync();

        var response = await ToResponseAsync(track, track.Sentences.Count);
        return CreatedAtAction(nameof(Get), new { id = track.Id }, response);
    }

    [HttpGet("api/admin/tracks/{id}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var track = await _db.Tracks.Include(t => t.Sentences).FirstOrDefaultAsync(t => t.Id == id);
        if (track is null) return NotFound();
        return Ok(await ToResponseAsync(track, track.Sentences.Count));
    }

    [HttpPut("api/admin/tracks/{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateTrackRequest request)
    {
        var track = await _db.Tracks.Include(t => t.Sentences).FirstOrDefaultAsync(t => t.Id == id);
        if (track is null) return NotFound();

        track.Title = request.Title;
        track.Level = request.Level;
        track.Description = request.Description;
        await _db.SaveChangesAsync();
        return Ok(await ToResponseAsync(track, track.Sentences.Count));
    }

    [HttpDelete("api/admin/tracks/{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var track = await _db.Tracks.FindAsync(id);
        if (track is null) return NotFound();

        _db.Tracks.Remove(track);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("api/admin/tracks/{id}/publish-status")]
    public async Task<IActionResult> SetPublishStatus(Guid id, UpdatePublishStatusRequest request)
    {
        var track = await _db.Tracks.Include(t => t.Sentences).FirstOrDefaultAsync(t => t.Id == id);
        if (track is null) return NotFound();

        track.IsPublished = request.IsPublished;
        await _db.SaveChangesAsync();
        return Ok(await ToResponseAsync(track, track.Sentences.Count));
    }
}
