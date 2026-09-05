namespace Lychee.Data.Entities;

public enum PracticeSessionStatus { InProgress, Completed }

// Sentence-by-sentence dictation, one linear pass through the track. FullDictation re-tests
// every sentence each round (not just what's still wrong) — see CurrentSentenceIndex below.
public enum PracticeMode { Sentence, FullDictation }

// Shared by Sentence Dictation and Full Dictation — a learner can have one InProgress row per
// (UserId, TrackId, Mode), so practicing the same track in both modes at once doesn't collide.
// Full Dictation additionally backs each attempt with a FullDictationSentenceResult row (this
// entity has no per-sentence detail of its own).
public class PracticeSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;
    public PracticeMode Mode { get; set; }
    public PracticeSessionStatus Status { get; set; }
    // Sentence mode: position in one straight pass over all sentences (0..sentenceCount).
    // FullDictation mode: position within the current round's pass over ALL sentences — resets
    // to 0 whenever a round finishes and a new one begins.
    public int CurrentSentenceIndex { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
