using System.Text.RegularExpressions;

namespace Lychee.Api.Content;

public enum WordDiffStatus { Correct, Incorrect, Missing, Extra }

public record WordDiff(string Word, WordDiffStatus Status);

public record ComparisonResult(List<WordDiff> Words, double AccuracyScore, bool IsExactMatch);

public static class TextComparer
{
    public static ComparisonResult Compare(string referenceText, string submittedText)
    {
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
        var isExactMatch = words.All(w => w.Status == WordDiffStatus.Correct);

        return new ComparisonResult(words, accuracy, isExactMatch);
    }

    public static int CountWords(string text) => Tokenize(text).Length;

    private static string[] Tokenize(string text) =>
        Regex.Matches(text, @"[A-Za-z0-9']+").Select(m => m.Value).ToArray();

    private static string Normalize(string word) => word.ToLowerInvariant();
}
