using System.Net;
using System.Net.Http.Json;
using Lychee.Api.Translation;
using Microsoft.Extensions.Options;
using Xunit;

namespace Lychee.Api.Tests.Translation;

public class DeepSeekTranslationProviderTests
{
    private class FakeHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
        public HttpRequestMessage? LastRequest { get; private set; }
        public string? LastRequestBody { get; private set; }

        public FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) => _responder = responder;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            LastRequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return _responder(request);
        }
    }

    private static DeepSeekTranslationProvider CreateProvider(FakeHttpMessageHandler handler, out HttpClient httpClient)
    {
        httpClient = new HttpClient(handler);
        var options = Options.Create(new TranslationOptions
        {
            Provider = "DeepSeek",
            DeepSeekApiKey = "test-key",
            DeepSeekModel = "deepseek-flash",
            DeepSeekBaseUrl = "https://api.deepseek.test"
        });
        return new DeepSeekTranslationProvider(httpClient, options);
    }

    private static HttpResponseMessage JsonResponse(string content) => new(HttpStatusCode.OK)
    {
        Content = JsonContent.Create(new
        {
            choices = new[]
            {
                new { message = new { content } }
            }
        })
    };

    [Fact]
    public async Task TranslateBatchAsync_ParsesTranslationsInOrder()
    {
        var handler = new FakeHttpMessageHandler(_ =>
            JsonResponse("{\"translations\": [\"你好\", \"早上好\"]}"));
        var provider = CreateProvider(handler, out _);

        var result = await provider.TranslateBatchAsync(new[] { "Hello.", "Good morning." }, "zh");

        Assert.Equal(new[] { "你好", "早上好" }, result);
        Assert.Contains("test-key", handler.LastRequest!.Headers.Authorization!.Parameter);
        Assert.Contains("Hello.", handler.LastRequestBody);
    }

    [Fact]
    public async Task TranslateBatchAsync_CountMismatch_Throws()
    {
        var handler = new FakeHttpMessageHandler(_ => JsonResponse("{\"translations\": [\"你好\"]}"));
        var provider = CreateProvider(handler, out _);

        await Assert.ThrowsAsync<TranslationProviderException>(
            () => provider.TranslateBatchAsync(new[] { "Hello.", "Good morning." }, "zh"));
    }

    [Fact]
    public async Task TranslateBatchAsync_NonSuccessStatus_Throws()
    {
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)
        {
            Content = new StringContent("{\"error\": \"bad key\"}")
        });
        var provider = CreateProvider(handler, out _);

        await Assert.ThrowsAsync<TranslationProviderException>(
            () => provider.TranslateBatchAsync(new[] { "Hello." }, "zh"));
    }

    [Fact]
    public async Task TranslateBatchAsync_MalformedJson_Throws()
    {
        var handler = new FakeHttpMessageHandler(_ => JsonResponse("not json"));
        var provider = CreateProvider(handler, out _);

        await Assert.ThrowsAsync<TranslationProviderException>(
            () => provider.TranslateBatchAsync(new[] { "Hello." }, "zh"));
    }

    [Fact]
    public async Task TranslateBatchAsync_MalformedOuterEnvelope_Throws()
    {
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("<html>not json at all</html>")
        });
        var provider = CreateProvider(handler, out _);

        await Assert.ThrowsAsync<TranslationProviderException>(
            () => provider.TranslateBatchAsync(new[] { "Hello." }, "zh"));
    }

    [Fact]
    public async Task TranslateBatchAsync_ChoiceMissingMessage_Throws()
    {
        var handler = new FakeHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new { choices = new object[] { new { } } })
        });
        var provider = CreateProvider(handler, out _);

        await Assert.ThrowsAsync<TranslationProviderException>(
            () => provider.TranslateBatchAsync(new[] { "Hello." }, "zh"));
    }

    [Fact]
    public async Task TranslateBatchAsync_RequestTimesOut_ThrowsTranslationProviderException()
    {
        var handler = new FakeHttpMessageHandler(_ => throw new TaskCanceledException("The request timed out."));
        var provider = CreateProvider(handler, out _);

        await Assert.ThrowsAsync<TranslationProviderException>(
            () => provider.TranslateBatchAsync(new[] { "Hello." }, "zh"));
    }

    [Fact]
    public void Constructor_MissingApiKey_Throws()
    {
        var httpClient = new HttpClient();
        var options = Options.Create(new TranslationOptions { Provider = "DeepSeek", DeepSeekApiKey = null });

        Assert.Throws<InvalidOperationException>(() => new DeepSeekTranslationProvider(httpClient, options));
    }
}
