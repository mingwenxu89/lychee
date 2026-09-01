using Lychee.Data.Entities;

namespace Lychee.Api.Content;

public static class TrackMetrics
{
    public static int ComputeWordsPerMinute(Track track)
    {
        if (track.Duration <= TimeSpan.Zero) return 0;

        var wordCount = track.Sentences.Sum(s => s.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length);
        return (int)Math.Round(wordCount / track.Duration.TotalMinutes);
    }
}
