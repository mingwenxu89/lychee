namespace Lychee.Storage;

public static class BlobStorageServiceExtensions
{
    // storedPath is "{containerName}/{blobName}" per IBlobStorageService.UploadAsync's return contract.
    public static Task DeleteStoredAsync(this IBlobStorageService service, string storedPath, CancellationToken ct = default)
    {
        var parts = storedPath.Split('/', 2);
        return service.DeleteAsync(parts[0], parts[1], ct);
    }
}
