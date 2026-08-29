using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Api.Controllers;

public record CreateExerciseRequest(string Title, string? Description, string? CoverImageUrl, string Category);
public record UpdateExerciseRequest(string Title, string? Description, string? CoverImageUrl, string Category);
public record ExerciseResponse(Guid Id, string Title, string? Description, string? CoverImageUrl, string Category, bool IsPublished);

[ApiController]
[Route("api/admin/exercises")]
[Authorize(Roles = "Admin")]
public class ExercisesController : ControllerBase
{
    private readonly LycheeDbContext _db;

    public ExercisesController(LycheeDbContext db) => _db = db;

    private static ExerciseResponse ToResponse(Exercise e) =>
        new(e.Id, e.Title, e.Description, e.CoverImageUrl, e.Category, e.IsPublished);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var exercises = await _db.Exercises.OrderBy(e => e.Title).ToListAsync();
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
            Category = request.Category
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
        exercise.Category = request.Category;
        await _db.SaveChangesAsync();
        return Ok(ToResponse(exercise));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var exercise = await _db.Exercises.FindAsync(id);
        if (exercise is null) return NotFound();

        _db.Exercises.Remove(exercise);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
