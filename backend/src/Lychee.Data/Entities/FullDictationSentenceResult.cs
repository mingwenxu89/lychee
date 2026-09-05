namespace Lychee.Data.Entities;

public class FullDictationSentenceResult
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public PracticeSession Session { get; set; } = null!;
    public Guid SentenceId { get; set; }
    public Sentence Sentence { get; set; } = null!;
    public bool IsCorrect { get; set; }
    // What the learner actually typed for this sentence as of the most recent submit call that
    // touched it — lets a resumed session show the same word-diff highlighting the learner saw
    // live, not just the pass/fail flag.
    public string SubmittedText { get; set; } = "";
}
