namespace Lychee.Data.Entities;

public enum FullDictationSessionStatus { InProgress, Completed }
public enum FullDictationPhase { Blind, Focused }

public class FullDictationSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;
    public FullDictationSessionStatus Status { get; set; }
    public int CurrentRound { get; set; }
    public FullDictationPhase CurrentPhase { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
