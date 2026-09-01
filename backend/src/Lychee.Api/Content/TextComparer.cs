using System.Text.RegularExpressions;

namespace Lychee.Api.Content;

public enum WordDiffStatus { Correct, Incorrect, Missing, Extra }

public record WordDiff(string Word, WordDiffStatus Status);

public record ComparisonResult(List<WordDiff> Words, double AccuracyScore, bool IsExactMatch);

public static class TextComparer
{
    // Only the single most common expansion is used for ambiguous contractions
    // (e.g. "he's" -> "he is", not "he has"; "I'd" -> "I would", not "I had") —
    // good enough for comparing spoken/typed answers against a reference
    // sentence, not a general-purpose English parser.
    private static readonly Dictionary<string, string> ContractionExpansions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["i'm"] = "i am",
        ["i've"] = "i have",
        ["i'll"] = "i will",
        ["i'd"] = "i would",
        ["you're"] = "you are",
        ["you've"] = "you have",
        ["you'll"] = "you will",
        ["you'd"] = "you would",
        ["he's"] = "he is",
        ["she's"] = "she is",
        ["it's"] = "it is",
        ["we're"] = "we are",
        ["we've"] = "we have",
        ["we'll"] = "we will",
        ["we'd"] = "we would",
        ["they're"] = "they are",
        ["they've"] = "they have",
        ["they'll"] = "they will",
        ["they'd"] = "they would",
        ["that's"] = "that is",
        ["that'll"] = "that will",
        ["who's"] = "who is",
        ["what's"] = "what is",
        ["where's"] = "where is",
        ["there's"] = "there is",
        ["here's"] = "here is",
        ["let's"] = "let us",
        ["isn't"] = "is not",
        ["aren't"] = "are not",
        ["wasn't"] = "was not",
        ["weren't"] = "were not",
        ["don't"] = "do not",
        ["doesn't"] = "does not",
        ["didn't"] = "did not",
        ["can't"] = "cannot",
        ["won't"] = "will not",
        ["wouldn't"] = "would not",
        ["shouldn't"] = "should not",
        ["couldn't"] = "could not",
        ["mustn't"] = "must not",
        ["haven't"] = "have not",
        ["hasn't"] = "has not",
        ["hadn't"] = "had not"
    };

    public static ComparisonResult Compare(string referenceText, string submittedText)
    {
        referenceText = ExpandContractions(referenceText);
        submittedText = ExpandContractions(submittedText);

        var refWords = Tokenize(referenceText);
        var subWords = Tokenize(submittedText);
        var refNorm = refWords.Select(Normalize).ToArray();
        var subNorm = subWords.Select(Normalize).ToArray();

        var n = refNorm.Length;
        var m = subNorm.Length;

        // lcs[i, j] = length of the longest common subsequence of refNorm[i..] and subNorm[j..]
        var lcs = new int[n + 1, m + 1];
        for (var i = n - 1; i >= 0; i--)
        {
            for (var j = m - 1; j >= 0; j--)
            {
                lcs[i, j] = refNorm[i] == subNorm[j]
                    ? lcs[i + 1, j + 1] + 1
                    : Math.Max(lcs[i + 1, j], lcs[i, j + 1]);
            }
        }

        var words = new List<WordDiff>();
        var correctCount = 0;
        int refIndex = 0, subIndex = 0;

        while (refIndex < n && subIndex < m)
        {
            if (refNorm[refIndex] == subNorm[subIndex])
            {
                words.Add(new WordDiff(refWords[refIndex], WordDiffStatus.Correct));
                correctCount++;
                refIndex++;
                subIndex++;
                continue;
            }

            var substitutionScore = lcs[refIndex + 1, subIndex + 1];
            var deleteScore = lcs[refIndex + 1, subIndex];
            var insertScore = lcs[refIndex, subIndex + 1];

            if (substitutionScore >= deleteScore && substitutionScore >= insertScore)
            {
                words.Add(new WordDiff(refWords[refIndex], WordDiffStatus.Incorrect));
                refIndex++;
                subIndex++;
            }
            else if (deleteScore >= insertScore)
            {
                words.Add(new WordDiff(refWords[refIndex], WordDiffStatus.Missing));
                refIndex++;
            }
            else
            {
                words.Add(new WordDiff(subWords[subIndex], WordDiffStatus.Extra));
                subIndex++;
            }
        }

        while (refIndex < n)
        {
            words.Add(new WordDiff(refWords[refIndex], WordDiffStatus.Missing));
            refIndex++;
        }

        while (subIndex < m)
        {
            words.Add(new WordDiff(subWords[subIndex], WordDiffStatus.Extra));
            subIndex++;
        }

        var accuracy = n == 0 ? (m == 0 ? 1.0 : 0.0) : (double)correctCount / n;
        var isExactMatch = ComputeIsExactMatch(words);

        return new ComparisonResult(words, accuracy, isExactMatch);
    }

    public static int CountWords(string text) => Tokenize(text).Length;

    // The reference sentence counts as fully matched if it appears anywhere in the
    // submission as one unbroken run — extra words before and/or after are allowed
    // (the learner said/typed more than the sentence), but a word inserted *inside*
    // the reference breaks continuity and must not count as a match.
    private static bool ComputeIsExactMatch(List<WordDiff> words)
    {
        if (words.Any(w => w.Status is WordDiffStatus.Incorrect or WordDiffStatus.Missing))
        {
            return false;
        }

        var firstCorrect = words.FindIndex(w => w.Status == WordDiffStatus.Correct);
        if (firstCorrect == -1)
        {
            return words.Count == 0;
        }

        var lastCorrect = words.FindLastIndex(w => w.Status == WordDiffStatus.Correct);
        for (var k = firstCorrect; k <= lastCorrect; k++)
        {
            if (words[k].Status != WordDiffStatus.Correct) return false;
        }

        return true;
    }

    private static string ExpandContractions(string text) =>
        Regex.Replace(text, @"[A-Za-z]+['’][A-Za-z]+", match =>
        {
            var key = match.Value.Replace('’', '\'');
            return ContractionExpansions.TryGetValue(key, out var expanded) ? expanded : match.Value;
        });

    private static string[] Tokenize(string text) =>
        Regex.Matches(text, @"[A-Za-z0-9']+").Select(m => m.Value).ToArray();

    private static string Normalize(string word) => word.ToLowerInvariant();
}
