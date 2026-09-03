using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record CreateUnitRequest(string Title, int Order);
public record UpdateUnitRequest(string Title, int Order);
public record UnitResponse(Guid Id, Guid ExerciseId, string Title, int Order, bool IsPublished);
// UpdatePublishStatusRequest is defined in ExercisesController.cs and shared (same namespace).

[ApiController]
[Authorize(Roles = "Admin")]
public class UnitsController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public UnitsController(LycheeDbContext db) => _db = db;

    private static UnitResponse ToResponse(Unit u) =>
        new(u.Id, u.ExerciseId, u.Title, u.Order, u.IsPublished);

    [HttpGet("api/admin/exercises/{exerciseId}/units")]
    public async Task<IActionResult> ListForExercise(Guid exerciseId)
    {
        var units = await _db.Units
            .Where(u => u.ExerciseId == exerciseId)
            .OrderBy(u => u.Order)
            .ToListAsync();
        return Ok(units.Select(ToResponse));
    }

    [HttpPost("api/admin/exercises/{exerciseId}/units")]
    public async Task<IActionResult> Create(Guid exerciseId, CreateUnitRequest request)
    {
        var exerciseExists = await _db.Exercises.AnyAsync(e => e.Id == exerciseId);
        if (!exerciseExists) return NotFound();

        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            ExerciseId = exerciseId,
            Title = request.Title,
            Order = request.Order
        };
        _db.Units.Add(unit);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = unit.Id }, ToResponse(unit));
    }

    [HttpGet("api/admin/units/{id}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var unit = await _db.Units.FindAsync(id);
        return unit is null ? NotFound() : Ok(ToResponse(unit));
    }

    [HttpPut("api/admin/units/{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateUnitRequest request)
    {
        var unit = await _db.Units.FindAsync(id);
        if (unit is null) return NotFound();

        unit.Title = request.Title;
        unit.Order = request.Order;
        await _db.SaveChangesAsync();
        return Ok(ToResponse(unit));
    }

    [HttpPatch("api/admin/units/{id}/publish-status")]
    public async Task<IActionResult> SetPublishStatus(Guid id, UpdatePublishStatusRequest request)
    {
        var unit = await _db.Units.FindAsync(id);
        if (unit is null) return NotFound();

        unit.IsPublished = request.IsPublished;
        await _db.SaveChangesAsync();
        return Ok(ToResponse(unit));
    }
}
