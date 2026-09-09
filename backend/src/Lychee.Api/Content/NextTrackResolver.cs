namespace Lychee.Api.Content;

public static class NextTrackResolver
{
    public static Guid? FindNextTrackId(
        Guid currentTrackId,
        List<(Guid UnitId, int UnitOrder, Guid TrackId, int TrackOrder)> tracksInExercise)
    {
        var ordered = tracksInExercise
            .OrderBy(t => t.UnitOrder)
            .ThenBy(t => t.TrackOrder)
            .Select(t => t.TrackId)
            .ToList();

        var index = ordered.IndexOf(currentTrackId);
        if (index < 0 || index == ordered.Count - 1) return null;
        return ordered[index + 1];
    }
}
