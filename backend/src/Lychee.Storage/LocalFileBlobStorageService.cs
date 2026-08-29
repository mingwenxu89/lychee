using Microsoft.Extensions.Options;

namespace Lychee.Storage;

public class LocalFileBlobStorageService : IBlobStorageService
{
    private readonly StorageOptions _options;

    public LocalFileBlobStorageService(IOptions<StorageOptions> options) => _options = options.Value;

    public async Task<string> UploadAsync(string containerName, string blobName, Stream content, string contentType, CancellationToken ct = default)
    {
        var directory = Path.Combine(_options.LocalRootPath, containerName);
        Directory.CreateDirectory(directory);
        var filePath = Path.Combine(directory, blobName);

        await using var fileStream = File.Create(filePath);
        await content.CopyToAsync(fileStream, ct);

        return $"{containerName}/{blobName}";
    }

    public Task<string> GetReadUrlAsync(string containerName, string blobName, TimeSpan validFor, CancellationToken ct = default)
    {
        // Local dev files are served by static middleware with no expiry; `validFor` is ignored here
        // (see Task 8 for the Azure implementation, where it drives a real SAS expiry).
        return Task.FromResult($"{_options.LocalBaseUrl.TrimEnd('/')}/{containerName}/{blobName}");
    }

    public Task DeleteAsync(string containerName, string blobName, CancellationToken ct = default)
    {
        var filePath = Path.Combine(_options.LocalRootPath, containerName, blobName);
        if (File.Exists(filePath)) File.Delete(filePath);
        return Task.CompletedTask;
    }
}
