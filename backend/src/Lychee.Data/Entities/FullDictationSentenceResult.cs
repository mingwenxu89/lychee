namespace Lychee.Data.Entities;

public class FullDictationSentenceResult
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public FullDictationSession Session { get; set; } = null!;
    public Guid SentenceId { get; set; }
    public Sentence Sentence { get; set; } = null!;
    public bool IsCorrect { get; set; }
}
