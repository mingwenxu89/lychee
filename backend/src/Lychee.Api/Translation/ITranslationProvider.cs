namespace Lychee.Api.Translation;

public interface ITranslationProvider
{
    // An identifier for whichever model/provider actually produced a translation — stored on
    // SentenceTranslation.Provider so quality issues can be traced back to their source.
    string Name { get; }

    // sentences is translated as one batch, in order; the returned list must be the same length
    // and order, or callers must treat this as a failure (see TranslationProviderException) —
    // never silently pad or truncate a mismatched result.
    Task<IReadOnlyList<string>> TranslateBatchAsync(
        IReadOnlyList<string> sentences, string targetLanguageCode, CancellationToken ct = default);
}
