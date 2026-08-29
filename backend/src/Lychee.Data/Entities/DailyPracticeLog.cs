namespace Lychee.Data.Entities;

public enum PracticeLogType { Practice, Recitation }

public class DailyPracticeLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public Guid SentenceId { get; set; }
    public Sentence Sentence { get; set; } = null!;
    public PracticeLogType PracticeType { get; set; }
}
