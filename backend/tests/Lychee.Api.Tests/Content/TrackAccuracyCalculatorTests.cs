using Lychee.Api.Content;
using Xunit;

namespace Lychee.Api.Tests.Content;

public class TrackAccuracyCalculatorTests
{
    [Fact]
    public void ComputeOverallAccuracy_NoRecords_ReturnsZero()
    {
        var result = TrackAccuracyCalculator.ComputeOverallAccuracy(new List<(Guid, double, DateTime)>());
        Assert.Equal(0.0, result);
    }

    [Fact]
    public void ComputeOverallAccuracy_OneRecordPerSentence_AveragesThem()
    {
        var sentenceA = Guid.NewGuid();
        var sentenceB = Guid.NewGuid();
        var records = new List<(Guid SentenceId, double AccuracyScore, DateTime CreatedAt)>
        {
            (sentenceA, 1.0, new DateTime(2026, 1, 1)),
            (sentenceB, 0.5, new DateTime(2026, 1, 1))
        };

        var result = TrackAccuracyCalculator.ComputeOverallAccuracy(records);

        Assert.Equal(0.75, result, precision: 5);
    }

    [Fact]
    public void ComputeOverallAccuracy_MultipleAttemptsPerSentence_UsesOnlyTheLatest()
    {
        var sentenceA = Guid.NewGuid();
        var records = new List<(Guid SentenceId, double AccuracyScore, DateTime CreatedAt)>
        {
            (sentenceA, 0.2, new DateTime(2026, 1, 1)),
            (sentenceA, 1.0, new DateTime(2026, 1, 2)) // later attempt, should win
        };

        var result = TrackAccuracyCalculator.ComputeOverallAccuracy(records);

        Assert.Equal(1.0, result, precision: 5);
    }
}
