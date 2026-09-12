namespace Lychee.Api.Translation;

public class TranslationOptions
{
    public string Provider { get; set; } = "None";
    public string? DeepSeekApiKey { get; set; }
    public string DeepSeekModel { get; set; } = "deepseek-flash";
    public string DeepSeekBaseUrl { get; set; } = "https://api.deepseek.com";
}
