namespace Lychee.Data.Entities;

public class PracticeRecord
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid SentenceId { get; set; }
    public Sentence Sentence { get; set; } = null!;
    public string SubmittedText { get; set; } = null!;
    public bool IsCorrect { get; set; }
    public double AccuracyScore { get; set; }
    public string DiffDetail { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
