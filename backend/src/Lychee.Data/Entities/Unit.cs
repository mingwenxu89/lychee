namespace Lychee.Data.Entities;

public class Unit
{
    public Guid Id { get; set; }
    public Guid ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public string Title { get; set; } = null!;
    public int Order { get; set; }
    public List<Track> Tracks { get; set; } = new();
}
