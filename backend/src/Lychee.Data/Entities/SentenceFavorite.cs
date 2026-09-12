namespace Lychee.Data.Entities;

public class SentenceFavorite
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid SentenceId { get; set; }
    public Sentence Sentence { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
