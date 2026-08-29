using Lychee.Api.Content;
using Xunit;

namespace Lychee.Api.Tests.Content;

public class SrtParserTests
{
    [Fact]
    public void Parse_SimpleTwoCueFile_ReturnsBothCuesInOrder()
    {
        const string srt = "1\n00:00:01,000 --> 00:00:03,500\nHello world.\n\n2\n00:00:04,000 --> 00:00:06,200\nThis is a test.\n";

        var cues = SrtParser.Parse(srt);

        Assert.Equal(2, cues.Count);
        Assert.Equal(1, cues[0].Index);
        Assert.Equal(TimeSpan.FromSeconds(1), cues[0].Start);
        Assert.Equal(TimeSpan.FromMilliseconds(3500), cues[0].End);
        Assert.Equal("Hello world.", cues[0].Text);
        Assert.Equal(2, cues[1].Index);
        Assert.Equal("This is a test.", cues[1].Text);
    }

    [Fact]
    public void Parse_MultiLineCueText_JoinsLinesWithSpace()
    {
        const string srt = "1\n00:00:01,000 --> 00:00:03,000\nFirst line\nsecond line\n";

        var cues = SrtParser.Parse(srt);

        Assert.Single(cues);
        Assert.Equal("First line second line", cues[0].Text);
    }

    [Fact]
    public void Parse_WindowsLineEndingsAndTrailingWhitespace_StillParsesCorrectly()
    {
        const string srt = "1\r\n00:00:01,000 --> 00:00:02,000  \r\nHello.  \r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nWorld.\r\n";

        var cues = SrtParser.Parse(srt);

        Assert.Equal(2, cues.Count);
        Assert.Equal("Hello.", cues[0].Text);
        Assert.Equal("World.", cues[1].Text);
    }
}
