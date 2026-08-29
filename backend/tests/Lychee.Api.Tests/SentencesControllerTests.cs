using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Lychee.Api.Auth;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class SentencesControllerTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public SentencesControllerTests(LycheeWebApplicationFactory factory) => _factory = factory;

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        var jwtTokenService = _factory.Services.GetRequiredService<IJwtTokenService>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.ForRole(jwtTokenService, "Admin"));
        return client;
    }

    private async Task<Guid> CreateTrackWithOneSentenceAsync(HttpClient client)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var exerciseResponse = await client.PostAsJsonAsync("/api/admin/exercises",
            new { title = $"Exercise {suffix}", description = (string?)null, coverImageUrl = (string?)null, category = "Short Stories" });
        var exercise = await exerciseResponse.Content.ReadFromJsonAsync<IdOnly>();
        var unitResponse = await client.PostAsJsonAsync($"/api/admin/exercises/{exercise!.Id}/units", new { title = "Unit 1", order = 1 });
        var unit = await unitResponse.Content.ReadFromJsonAsync<IdOnly>();

        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("audio")), "AudioFile", "a.mp3");
        form.Add(new StringContent("1\n00:00:00,000 --> 00:00:02,000\nOriginal text.\n"), "SrtFile", "a.srt");
        form.Add(new StringContent("A1"), "Level");
        var trackResponse = await client.PostAsync($"/api/admin/units/{unit!.Id}/tracks", form);
        var track = await trackResponse.Content.ReadFromJsonAsync<IdOnly>();
        return track!.Id;
    }

    [Fact]
    public async Task ListForTrack_ThenUpdate_ReflectsCorrectedText()
    {
        var client = AdminClient();
        var trackId = await CreateTrackWithOneSentenceAsync(client);

        var listResponse = await client.GetAsync($"/api/admin/tracks/{trackId}/sentences");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var sentences = await listResponse.Content.ReadFromJsonAsync<List<SentenceResponse>>();
        Assert.Single(sentences!);
        Assert.Equal("Original text.", sentences![0].Text);

        var updateResponse = await client.PutAsJsonAsync($"/api/admin/sentences/{sentences[0].Id}",
            new { text = "Corrected text.", startTime = "00:00:00.100", endTime = "00:00:02.100" });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<SentenceResponse>();
        Assert.Equal("Corrected text.", updated!.Text);
        Assert.Equal(TimeSpan.Parse("00:00:00.100"), updated.StartTime);
    }

    private record IdOnly(Guid Id);
    private record SentenceResponse(Guid Id, Guid TrackId, int Index, string Text, TimeSpan StartTime, TimeSpan EndTime);
}
