using Lychee.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record UpdateSentenceRequest(string Text, TimeSpan StartTime, TimeSpan EndTime);
public record SentenceResponse(Guid Id, Guid TrackId, int Index, string Text, TimeSpan StartTime, TimeSpan EndTime);

[ApiController]
[Authorize(Roles = "Admin")]
public class SentencesController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public SentencesController(LycheeDbContext db) => _db = db;

    private static SentenceResponse ToResponse(Lychee.Data.Entities.Sentence s) =>
        new(s.Id, s.TrackId, s.Index, s.Text, s.StartTime, s.EndTime);

    [HttpGet("api/admin/tracks/{trackId}/sentences")]
    public async Task<IActionResult> ListForTrack(Guid trackId)
    {
        var sentences = await _db.Sentences
            .Where(s => s.TrackId == trackId)
            .OrderBy(s => s.Index)
            .ToListAsync();
        return Ok(sentences.Select(ToResponse));
    }

    [HttpPut("api/admin/sentences/{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateSentenceRequest request)
    {
        var sentence = await _db.Sentences.FindAsync(id);
        if (sentence is null) return NotFound();

        sentence.Text = request.Text;
        sentence.StartTime = request.StartTime;
        sentence.EndTime = request.EndTime;
        await _db.SaveChangesAsync();
        return Ok(ToResponse(sentence));
    }
}
