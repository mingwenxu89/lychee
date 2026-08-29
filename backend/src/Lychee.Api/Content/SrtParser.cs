using System.Globalization;

namespace Lychee.Api.Content;

public record SrtCue(int Index, TimeSpan Start, TimeSpan End, string Text);

public static class SrtParser
{
    public static List<SrtCue> Parse(string content)
    {
        var cues = new List<SrtCue>();
        var normalized = content.Replace("\r\n", "\n").Replace("\r", "\n");
        var blocks = normalized.Split("\n\n", StringSplitOptions.RemoveEmptyEntries);

        foreach (var block in blocks)
        {
            var lines = block.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(l => l.Trim())
                .Where(l => l.Length > 0)
                .ToArray();

            if (lines.Length < 2 || !int.TryParse(lines[0], out var index))
            {
                continue;
            }

            var timingParts = lines[1].Split("-->", StringSplitOptions.TrimEntries);
            if (timingParts.Length != 2)
            {
                continue;
            }

            var start = ParseTimestamp(timingParts[0]);
            var end = ParseTimestamp(timingParts[1]);
            var text = string.Join(" ", lines.Skip(2));

            cues.Add(new SrtCue(index, start, end, text));
        }

        return cues;
    }

    private static TimeSpan ParseTimestamp(string timestamp)
    {
        // SRT timestamps use a comma for the millisecond separator: 00:00:01,000
        var normalized = timestamp.Replace(',', '.');
        return TimeSpan.ParseExact(normalized, @"hh\:mm\:ss\.fff", CultureInfo.InvariantCulture);
    }
}
