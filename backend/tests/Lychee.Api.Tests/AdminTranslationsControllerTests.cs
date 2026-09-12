using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Lychee.Api.Auth;
using Lychee.Api.Controllers;
using Lychee.Api.Translation;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class AdminTranslationsControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public AdminTranslationsControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient(FakeTranslationProvider? fakeProvider = null)
    {
        var factory = fakeProvider is null ? _factory : _factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
                services.AddSingleton<ITranslationProvider>(fakeProvider)));

        var client = factory.CreateClient();
        var jwtTokenService = factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    private static async Task<(Guid TrackId, Guid[] SentenceIds)> CreateTrackWithSentencesAsync(HttpClient adminClient)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await adminClient.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<IdOnly>();

        var unitResponse = await adminClient.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units",
            new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<IdOnly>();

        using var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(Encoding.UTF8.GetBytes("fake-audio"));
        audioContent.Headers.ContentType = new MediaTypeHeaderValue("audio/mpeg");
        form.Add(audioContent, "AudioFile", "track.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:02,000\nHello there.\n\n2\n00:00:02,000 --> 00:00:04,000\nGood morning.\n"), "SrtFile", "track.srt");
        form.Add(new StringContent("A1"), "Level");
        form.Add(new StringContent("Test Track"), "Title");
        var trackResponse = await adminClient.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();

        var sentencesResponse = await adminClient.GetAsync($"/api/admin/tracks/{track!.Id}/sentences");
        var sentences = await sentencesResponse.Content.ReadFromJsonAsync<List<IdOnly>>();

        return (track.Id, sentences!.Select(s => s.Id).ToArray());
    }

    [Fact]
    public async Task Generate_TranslatesEverySentenceAndPersists()
    {
        var admin = AdminClient(new FakeTranslationProvider());
        var (trackId, sentenceIds) = await CreateTrackWithSentencesAsync(admin);

        var response = await admin.PostAsJsonAsync($"/api/admin/tracks/{trackId}/translations",
            new { languageCode = "zh", overwriteManualEdits = false });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var results = await response.Content.ReadFromJsonAsync<List<SentenceTranslationResponse>>();
        Assert.Equal(2, results!.Count);
        Assert.Contains(results, r => r.SentenceId == sentenceIds[0] && r.TranslatedText == "[zh] Hello there.");
        Assert.Contains(results, r => r.SentenceId == sentenceIds[1] && r.TranslatedText == "[zh] Good morning.");
        Assert.All(results, r => Assert.False(r.IsManuallyEdited));
    }

    [Fact]
    public async Task Generate_SkipsManuallyEditedSentencesByDefault()
    {
        var admin = AdminClient(new FakeTranslationProvider());
        var (trackId, sentenceIds) = await CreateTrackWithSentencesAsync(admin);
        await admin.PutAsJsonAsync($"/api/admin/sentences/{sentenceIds[0]}/translations/zh",
            new { translatedText = "手动修正的翻译" });

        var response = await admin.PostAsJsonAsync($"/api/admin/tracks/{trackId}/translations",
            new { languageCode = "zh", overwriteManualEdits = false });

        var results = await response.Content.ReadFromJsonAsync<List<SentenceTranslationResponse>>();
        var untouched = results!.Single(r => r.SentenceId == sentenceIds[0]);
        Assert.Equal("手动修正的翻译", untouched.TranslatedText);
        Assert.True(untouched.IsManuallyEdited);
        var regenerated = results.Single(r => r.SentenceId == sentenceIds[1]);
        Assert.Equal("[zh] Good morning.", regenerated.TranslatedText);
    }

    [Fact]
    public async Task Generate_WithOverwriteManualEdits_ReplacesManuallyEditedRowsToo()
    {
        var admin = AdminClient(new FakeTranslationProvider());
        var (trackId, sentenceIds) = await CreateTrackWithSentencesAsync(admin);
        await admin.PutAsJsonAsync($"/api/admin/sentences/{sentenceIds[0]}/translations/zh",
            new { translatedText = "手动修正的翻译" });

        var response = await admin.PostAsJsonAsync($"/api/admin/tracks/{trackId}/translations",
            new { languageCode = "zh", overwriteManualEdits = true });

        var results = await response.Content.ReadFromJsonAsync<List<SentenceTranslationResponse>>();
        var overwritten = results!.Single(r => r.SentenceId == sentenceIds[0]);
        Assert.Equal("[zh] Hello there.", overwritten.TranslatedText);
        Assert.False(overwritten.IsManuallyEdited);
    }

    [Fact]
    public async Task Generate_ProviderFailure_ReturnsBadRequestAndPersistsNothing()
    {
        var fakeProvider = new FakeTranslationProvider
        {
            Responder = (_, _) => throw new TranslationProviderException("boom")
        };
        var admin = AdminClient(fakeProvider);
        var (trackId, _) = await CreateTrackWithSentencesAsync(admin);

        var response = await admin.PostAsJsonAsync($"/api/admin/tracks/{trackId}/translations",
            new { languageCode = "zh", overwriteManualEdits = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var list = await (await admin.GetAsync($"/api/admin/tracks/{trackId}/translations?languageCode=zh"))
            .Content.ReadFromJsonAsync<List<SentenceTranslationResponse>>();
        Assert.Empty(list!);
    }

    [Fact]
    public async Task Generate_ProviderReturnsMismatchedCount_ReturnsBadRequestAndPersistsNothing()
    {
        var fakeProvider = new FakeTranslationProvider
        {
            Responder = (sentences, languageCode) => sentences.Select(s => $"[{languageCode}] {s}").Take(1).ToList()
        };
        var admin = AdminClient(fakeProvider);
        var (trackId, _) = await CreateTrackWithSentencesAsync(admin);

        var response = await admin.PostAsJsonAsync($"/api/admin/tracks/{trackId}/translations",
            new { languageCode = "zh", overwriteManualEdits = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var list = await (await admin.GetAsync($"/api/admin/tracks/{trackId}/translations?languageCode=zh"))
            .Content.ReadFromJsonAsync<List<SentenceTranslationResponse>>();
        Assert.Empty(list!);
    }

    [Fact]
    public async Task Generate_NonExistentTrack_Returns404()
    {
        var response = await AdminClient(new FakeTranslationProvider())
            .PostAsJsonAsync($"/api/admin/tracks/{Guid.NewGuid()}/translations",
                new { languageCode = "zh", overwriteManualEdits = false });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task List_BeforeGenerating_ReturnsEmpty()
    {
        var admin = AdminClient();
        var (trackId, _) = await CreateTrackWithSentencesAsync(admin);

        var response = await admin.GetAsync($"/api/admin/tracks/{trackId}/translations?languageCode=zh");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = await response.Content.ReadFromJsonAsync<List<SentenceTranslationResponse>>();
        Assert.Empty(list!);
    }

    private record IdOnly(Guid Id);
}
