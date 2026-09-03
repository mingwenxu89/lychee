namespace Lychee.Data.Entities;

public class Quote
{
    public Guid Id { get; set; }
    public string Text { get; set; } = null!;
    public bool IsActive { get; set; } = true;
}
