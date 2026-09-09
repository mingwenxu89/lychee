namespace Lychee.Data.Entities;

public class Track
{
    public Guid Id { get; set; }
    public Guid UnitId { get; set; }
    public Unit Unit { get; set; } = null!;
    public string AudioFileUrl { get; set; } = null!;
    public string SrtFileUrl { get; set; } = null!;
    public TimeSpan Duration { get; set; }
    public string Level { get; set; } = null!;
    public bool IsPublished { get; set; } = true;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public int Order { get; set; }
    public List<Sentence> Sentences { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}
