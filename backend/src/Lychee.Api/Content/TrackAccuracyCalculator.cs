namespace Lychee.Api.Content;

public static class TrackAccuracyCalculator
{
    public static double ComputeOverallAccuracy(IEnumerable<(Guid SentenceId, double AccuracyScore, DateTime CreatedAt)> records)
    {
        var latestPerSentence = records
            .GroupBy(r => r.SentenceId)
            .Select(g => g.OrderByDescending(r => r.CreatedAt).First().AccuracyScore)
            .ToList();

        return latestPerSentence.Count == 0 ? 0.0 : latestPerSentence.Average();
    }
}
