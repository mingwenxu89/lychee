using Lychee.Api.Translation;

namespace Lychee.Api.Tests;

public class FakeTranslationProvider : ITranslationProvider
{
    public string Name => "fake";

    // Default: prefix each sentence with its target language code — deterministic and easy to
    // assert against without a custom responder for the common case. Tests that need to
    // exercise failure paths can still throw, since this is just a normal C# delegate.
    public Func<IReadOnlyList<string>, string, IReadOnlyList<string>> Responder { get; set; } =
        (sentences, languageCode) => sentences.Select(s => $"[{languageCode}] {s}").ToList();

    public Task<IReadOnlyList<string>> TranslateBatchAsync(
        IReadOnlyList<string> sentences, string targetLanguageCode, CancellationToken ct = default)
        => Task.FromResult(Responder(sentences, targetLanguageCode));
}
