using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Lychee.Api.Translation;

public class DeepSeekTranslationProvider : ITranslationProvider
{
    private readonly HttpClient _httpClient;
    private readonly TranslationOptions _options;

    public DeepSeekTranslationProvider(HttpClient httpClient, IOptions<TranslationOptions> options)
    {
        _options = options.Value;
        if (string.IsNullOrEmpty(_options.DeepSeekApiKey))
        {
            throw new InvalidOperationException(
                "Translation:Provider is DeepSeek but Translation:DeepSeekApiKey must be configured.");
        }

        _httpClient = httpClient;
        _httpClient.BaseAddress = new Uri(_options.DeepSeekBaseUrl);
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.DeepSeekApiKey);
    }

    public string Name => _options.DeepSeekModel;

    public async Task<IReadOnlyList<string>> TranslateBatchAsync(
        IReadOnlyList<string> sentences, string targetLanguageCode, CancellationToken ct = default)
    {
        var numbered = string.Join('\n', sentences.Select((s, i) => $"{i + 1}. {s}"));
        var prompt =
            $"Translate the following {sentences.Count} numbered English sentences into the language with " +
            $"ISO code \"{targetLanguageCode}\". Keep the translation natural and easy to read for a language " +
            "learner. Respond with JSON only, in this exact shape: {\"translations\": [\"...\", \"...\"]}, with " +
            $"exactly {sentences.Count} strings, in the same order as the input, and nothing else.\n\n{numbered}";

        var requestBody = new
        {
            model = _options.DeepSeekModel,
            messages = new object[] { new { role = "user", content = prompt } },
            response_format = new { type = "json_object" },
            stream = false
        };

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsJsonAsync("chat/completions", requestBody, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new TranslationProviderException($"Could not reach DeepSeek API: {ex.Message}");
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                throw new TranslationProviderException($"DeepSeek API request failed ({(int)response.StatusCode}): {errorBody}");
            }

            var completion = await response.Content.ReadFromJsonAsync<ChatCompletionResponse>(cancellationToken: ct);
            var content = completion?.Choices.FirstOrDefault()?.Message.Content;
            if (string.IsNullOrEmpty(content))
            {
                throw new TranslationProviderException("DeepSeek API returned an empty response.");
            }

            TranslationPayload? payload;
            try
            {
                payload = JsonSerializer.Deserialize<TranslationPayload>(content);
            }
            catch (JsonException ex)
            {
                throw new TranslationProviderException($"DeepSeek API returned invalid JSON: {ex.Message}");
            }

            if (payload?.Translations is null || payload.Translations.Count != sentences.Count)
            {
                throw new TranslationProviderException(
                    $"Expected {sentences.Count} translations but got {payload?.Translations?.Count ?? 0}.");
            }

            return payload.Translations;
        }
    }

    private class ChatCompletionResponse
    {
        [JsonPropertyName("choices")]
        public List<Choice> Choices { get; set; } = new();
    }

    private class Choice
    {
        [JsonPropertyName("message")]
        public Message Message { get; set; } = null!;
    }

    private class Message
    {
        [JsonPropertyName("content")]
        public string Content { get; set; } = "";
    }

    private class TranslationPayload
    {
        [JsonPropertyName("translations")]
        public List<string>? Translations { get; set; }
    }
}
