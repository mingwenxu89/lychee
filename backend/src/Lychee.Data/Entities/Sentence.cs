namespace Lychee.Data.Entities;

public class Sentence
{
    public Guid Id { get; set; }
    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;
    public int Index { get; set; }
    public string Text { get; set; } = null!;
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
}
