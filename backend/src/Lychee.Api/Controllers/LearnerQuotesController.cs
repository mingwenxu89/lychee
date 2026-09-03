using Lychee.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record RandomQuoteResponse(string Text);

[ApiController]
[Authorize]
public class LearnerQuotesController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public LearnerQuotesController(LycheeDbContext db) => _db = db;

    [HttpGet("api/learner/quotes/random")]
    public async Task<IActionResult> GetRandom()
    {
        var activeIds = await _db.Quotes
            .Where(q => q.IsActive)
            .Select(q => q.Id)
            .ToListAsync();
        if (activeIds.Count == 0) return NotFound();

        var randomId = activeIds[Random.Shared.Next(activeIds.Count)];
        var quote = await _db.Quotes.FindAsync(randomId);
        return Ok(new RandomQuoteResponse(quote!.Text));
    }
}
