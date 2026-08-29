namespace Lychee.Data.Entities;

public class Exercise
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? CoverImageUrl { get; set; }
    public string Category { get; set; } = null!;
    public bool IsPublished { get; set; } = true;
    public List<Unit> Units { get; set; } = new();
}
