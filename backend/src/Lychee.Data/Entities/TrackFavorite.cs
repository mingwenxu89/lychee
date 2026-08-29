namespace Lychee.Data.Entities;

public class TrackFavorite
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid TrackId { get; set; }
    public Track Track { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
