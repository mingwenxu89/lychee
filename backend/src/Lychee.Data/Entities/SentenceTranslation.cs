namespace Lychee.Data.Entities;

public class SentenceTranslation
{
    public Guid Id { get; set; }
    public Guid SentenceId { get; set; }
    public Sentence Sentence { get; set; } = null!;
    public string LanguageCode { get; set; } = null!;
    public string TranslatedText { get; set; } = null!;
    public bool IsManuallyEdited { get; set; }
    public string Provider { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
