using Lychee.Api.Content;
using Xunit;

namespace Lychee.Api.Tests.Content;

public class NextTrackResolverTests
{
    [Fact]
    public void FindNextTrackId_ReturnsNextTrackWithinSameUnit()
    {
        var unitA = Guid.NewGuid();
        var trackA1 = Guid.NewGuid();
        var trackA2 = Guid.NewGuid();
        var tracks = new List<(Guid UnitId, int UnitOrder, Guid TrackId, DateTime TrackCreatedAt)>
        {
            (unitA, 1, trackA1, new DateTime(2026, 1, 1)),
            (unitA, 1, trackA2, new DateTime(2026, 1, 2))
        };

        var result = NextTrackResolver.FindNextTrackId(trackA1, tracks);

        Assert.Equal(trackA2, result);
    }

    [Fact]
    public void FindNextTrackId_CrossesIntoNextUnit_OrderedByUnitOrder()
    {
        var unitA = Guid.NewGuid();
        var unitB = Guid.NewGuid();
        var lastTrackOfUnitA = Guid.NewGuid();
        var firstTrackOfUnitB = Guid.NewGuid();
        var tracks = new List<(Guid UnitId, int UnitOrder, Guid TrackId, DateTime TrackCreatedAt)>
        {
            (unitA, 1, lastTrackOfUnitA, new DateTime(2026, 1, 1)),
            (unitB, 2, firstTrackOfUnitB, new DateTime(2026, 1, 1))
        };

        var result = NextTrackResolver.FindNextTrackId(lastTrackOfUnitA, tracks);

        Assert.Equal(firstTrackOfUnitB, result);
    }

    [Fact]
    public void FindNextTrackId_LastTrackInExercise_ReturnsNull()
    {
        var unitA = Guid.NewGuid();
        var onlyTrack = Guid.NewGuid();
        var tracks = new List<(Guid UnitId, int UnitOrder, Guid TrackId, DateTime TrackCreatedAt)>
        {
            (unitA, 1, onlyTrack, new DateTime(2026, 1, 1))
        };

        var result = NextTrackResolver.FindNextTrackId(onlyTrack, tracks);

        Assert.Null(result);
    }
}
