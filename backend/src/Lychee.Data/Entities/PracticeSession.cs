namespace Lychee.Data.Entities;

public enum PracticeSessionStatus { InProgress, Completed }

public class PracticeSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;
    public PracticeSessionStatus Status { get; set; }
    public int CurrentSentenceIndex { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
