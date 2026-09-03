using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record CreateExerciseRequest(string Title, string? Description, string? CoverImageUrl, int Order);
public record UpdateExerciseRequest(string Title, string? Description, string? CoverImageUrl, int Order);
public record ExerciseResponse(Guid Id, string Title, string? Description, string? CoverImageUrl, int Order, bool IsPublished);
public record UpdatePublishStatusRequest(bool IsPublished);

[ApiController]
[Route("api/admin/exercises")]
[Authorize(Roles = "Admin")]
public class ExercisesController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public ExercisesController(LycheeDbContext db) => _db = db;

    private static ExerciseResponse ToResponse(Exercise e) =>
        new(e.Id, e.Title, e.Description, e.CoverImageUrl, e.Order, e.IsPublished);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var exercises = await _db.Exercises.OrderBy(e => e.Order).ToListAsync();
        return Ok(exercises.Select(ToResponse));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var exercise = await _db.Exercises.FindAsync(id);
        return exercise is null ? NotFound() : Ok(ToResponse(exercise));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateExerciseRequest request)
    {
        var exercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            CoverImageUrl = request.CoverImageUrl,
            Order = request.Order
        };
        _db.Exercises.Add(exercise);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = exercise.Id }, ToResponse(exercise));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateExerciseRequest request)
    {
        var exercise = await _db.Exercises.FindAsync(id);
        if (exercise is null) return NotFound();

        exercise.Title = request.Title;
        exercise.Description = request.Description;
        exercise.CoverImageUrl = request.CoverImageUrl;
        exercise.Order = request.Order;
        await _db.SaveChangesAsync();
        return Ok(ToResponse(exercise));
    }

    [HttpPatch("{id}/publish-status")]
    public async Task<IActionResult> SetPublishStatus(Guid id, UpdatePublishStatusRequest request)
    {
        var exercise = await _db.Exercises.FindAsync(id);
        if (exercise is null) return NotFound();

        exercise.IsPublished = request.IsPublished;
        await _db.SaveChangesAsync();
        return Ok(ToResponse(exercise));
    }
}
