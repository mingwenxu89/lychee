namespace Lychee.Data.Entities;

public class RecitationAttempt
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;
    public string SubmittedText { get; set; } = null!;
    public double Score { get; set; }
    public string DiffDetail { get; set; } = null!;
    public List<Guid> QualifiedSentenceIds { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}
