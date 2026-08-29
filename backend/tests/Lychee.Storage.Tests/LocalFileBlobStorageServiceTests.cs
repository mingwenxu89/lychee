using System.Text;
using Lychee.Storage;
using Microsoft.Extensions.Options;
using Xunit;

namespace Lychee.Storage.Tests;

public class LocalFileBlobStorageServiceTests : IDisposable
{
    private readonly string _tempRoot = Path.Combine(Path.GetTempPath(), $"lychee-blob-tests-{Guid.NewGuid():N}");

    private LocalFileBlobStorageService CreateService() =>
        new(Options.Create(new StorageOptions { LocalRootPath = _tempRoot, LocalBaseUrl = "http://localhost:5000/local-blobs" }));

    [Fact]
    public async Task UploadThenGetReadUrl_ReturnsUrlServingUploadedBytes()
    {
        var service = CreateService();
        var content = new MemoryStream(Encoding.UTF8.GetBytes("hello audio"));

        await service.UploadAsync("audio", "track-1.mp3", content, "audio/mpeg");
        var url = await service.GetReadUrlAsync("audio", "track-1.mp3", TimeSpan.FromMinutes(5));

        Assert.Equal("http://localhost:5000/local-blobs/audio/track-1.mp3", url);
        var savedBytes = await File.ReadAllTextAsync(Path.Combine(_tempRoot, "audio", "track-1.mp3"));
        Assert.Equal("hello audio", savedBytes);
    }

    [Fact]
    public async Task Delete_RemovesTheStoredFile()
    {
        var service = CreateService();
        await service.UploadAsync("audio", "to-delete.mp3", new MemoryStream(Encoding.UTF8.GetBytes("x")), "audio/mpeg");

        await service.DeleteAsync("audio", "to-delete.mp3");

        Assert.False(File.Exists(Path.Combine(_tempRoot, "audio", "to-delete.mp3")));
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot)) Directory.Delete(_tempRoot, recursive: true);
    }
}
