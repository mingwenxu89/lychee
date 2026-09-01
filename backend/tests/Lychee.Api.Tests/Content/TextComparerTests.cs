// backend/tests/Lychee.Api.Tests/Content/TextComparerTests.cs
using Lychee.Api.Content;
using Xunit;

namespace Lychee.Api.Tests.Content;

public class TextComparerTests
{
    [Fact]
    public void Compare_ExactMatch_AllWordsCorrect()
    {
        var result = TextComparer.Compare("I saw the first snowfall.", "I saw the first snowfall");

        Assert.True(result.IsExactMatch);
        Assert.Equal(1.0, result.AccuracyScore);
        Assert.All(result.Words, w => Assert.Equal(WordDiffStatus.Correct, w.Status));
        Assert.Equal(5, result.Words.Count);
    }

    [Fact]
    public void Compare_CaseAndPunctuationInsensitive()
    {
        var result = TextComparer.Compare("It was magical.", "it WAS magical");

        Assert.True(result.IsExactMatch);
        Assert.Equal(1.0, result.AccuracyScore);
    }

    [Fact]
    public void Compare_OneSubstitution_MarksIncorrect()
    {
        var result = TextComparer.Compare("I saw the first snowfall", "I saw the last snowfall");

        Assert.False(result.IsExactMatch);
        Assert.Equal(0.8, result.AccuracyScore, precision: 5);
        Assert.Equal(WordDiffStatus.Correct, result.Words[0].Status);
        Assert.Equal(WordDiffStatus.Correct, result.Words[1].Status);
        Assert.Equal(WordDiffStatus.Correct, result.Words[2].Status);
        Assert.Equal(WordDiffStatus.Incorrect, result.Words[3].Status);
        Assert.Equal("first", result.Words[3].Word);
        Assert.Equal(WordDiffStatus.Correct, result.Words[4].Status);
    }

    [Fact]
    public void Compare_MissingWord_MarksMissing()
    {
        var result = TextComparer.Compare("I saw the first snowfall", "I saw first snowfall");

        Assert.False(result.IsExactMatch);
        Assert.Contains(result.Words, w => w.Status == WordDiffStatus.Missing && w.Word == "the");
        Assert.Equal(0.8, result.AccuracyScore, precision: 5);
    }

    [Fact]
    public void Compare_ExtraWord_MarksExtra()
    {
        var result = TextComparer.Compare("I saw the snowfall", "I saw the first snowfall");

        Assert.False(result.IsExactMatch);
        Assert.Contains(result.Words, w => w.Status == WordDiffStatus.Extra && w.Word == "first");
        Assert.Equal(1.0, result.AccuracyScore, precision: 5);
    }

    [Fact]
    public void Compare_EmptySubmission_AllMissing()
    {
        var result = TextComparer.Compare("I saw the snowfall", "");

        Assert.False(result.IsExactMatch);
        Assert.Equal(0.0, result.AccuracyScore);
        Assert.All(result.Words, w => Assert.Equal(WordDiffStatus.Missing, w.Status));
    }

    [Fact]
    public void Compare_ReferenceAppearsContiguouslyWithExtraPrefixAndSuffix_IsExactMatch()
    {
        var result = TextComparer.Compare("I saw the first snowfall", "well I saw the first snowfall today");

        Assert.True(result.IsExactMatch);
        Assert.Equal(1.0, result.AccuracyScore, precision: 5);
    }

    [Fact]
    public void Compare_ReferenceAppearsOnlyAsPrefix_IsExactMatch()
    {
        var result = TextComparer.Compare("I saw the first snowfall", "I saw the first snowfall today");

        Assert.True(result.IsExactMatch);
    }

    [Fact]
    public void Compare_ReferenceAppearsOnlyAsSuffix_IsExactMatch()
    {
        var result = TextComparer.Compare("I saw the first snowfall", "well I saw the first snowfall");

        Assert.True(result.IsExactMatch);
    }

    [Fact]
    public void Compare_ExtraWordInsertedInsideReference_StillNotExactMatch()
    {
        // The extra word breaks continuity, unlike a prefix/suffix — must remain false.
        var result = TextComparer.Compare("I saw the snowfall", "I saw the first snowfall");

        Assert.False(result.IsExactMatch);
    }

    [Theory]
    [InlineData("I will go home", "I'll go home")]
    [InlineData("I have seen it", "I've seen it")]
    [InlineData("I am ready", "I'm ready")]
    [InlineData("do not go", "don't go")]
    [InlineData("she is happy", "she's happy")]
    [InlineData("they are late", "they're late")]
    public void Compare_ContractionMatchesExpandedForm_IsExactMatch(string reference, string submitted)
    {
        var result = TextComparer.Compare(reference, submitted);

        Assert.True(result.IsExactMatch);
        Assert.Equal(1.0, result.AccuracyScore, precision: 5);
    }

    [Fact]
    public void Compare_ContractionInReference_MatchesExpandedSubmission()
    {
        var result = TextComparer.Compare("I'll go home", "I will go home");

        Assert.True(result.IsExactMatch);
    }

    [Fact]
    public void CountWords_CountsAlphanumericTokens()
    {
        Assert.Equal(5, TextComparer.CountWords("I saw the first snowfall."));
        Assert.Equal(0, TextComparer.CountWords(""));
    }
}
