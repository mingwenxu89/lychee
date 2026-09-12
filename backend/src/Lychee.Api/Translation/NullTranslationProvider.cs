namespace Lychee.Api.Translation;

// The default when Translation:Provider isn't configured — mirrors R2BlobStorageService's
// constructor-time check for Storage, except there is no meaningful "local" translation
// provider to fall back to, so this only fails when actually invoked, not at startup (a dev
// environment with no translation work to do should still boot cleanly).
public class NullTranslationProvider : ITranslationProvider
{
    public string Name => "none";

    public Task<IReadOnlyList<string>> TranslateBatchAsync(
        IReadOnlyList<string> sentences, string targetLanguageCode, CancellationToken ct = default)
    {
        throw new TranslationProviderException(
            "No translation provider is configured. Set Translation:Provider (e.g. \"DeepSeek\") and its API key.");
    }
}
