using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record CreateQuoteRequest(string Text);
public record UpdateQuoteRequest(string Text, bool IsActive);
public record QuoteResponse(Guid Id, string Text, bool IsActive);

[ApiController]
[Route("api/admin/encouragement-quotes")]
[Authorize(Roles = "Admin")]
public class EncouragementQuotesController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public EncouragementQuotesController(LycheeDbContext db) => _db = db;

    private static QuoteResponse ToResponse(EncouragementQuote q) => new(q.Id, q.Text, q.IsActive);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var quotes = await _db.EncouragementQuotes.ToListAsync();
        return Ok(quotes.Select(ToResponse));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateQuoteRequest request)
    {
        var quote = new EncouragementQuote { Id = Guid.NewGuid(), Text = request.Text, IsActive = true };
        _db.EncouragementQuotes.Add(quote);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(List), ToResponse(quote));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateQuoteRequest request)
    {
        var quote = await _db.EncouragementQuotes.FindAsync(id);
        if (quote is null) return NotFound();

        quote.Text = request.Text;
        quote.IsActive = request.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ToResponse(quote));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var quote = await _db.EncouragementQuotes.FindAsync(id);
        if (quote is null) return NotFound();

        _db.EncouragementQuotes.Remove(quote);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
