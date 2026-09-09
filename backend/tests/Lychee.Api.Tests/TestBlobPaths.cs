using Lychee.Storage;

namespace Lychee.Api.Tests;

internal static class TestBlobPaths
{
    // Reverses LocalFileBlobStorageService's read-URL construction back into the on-disk
    // path it wrote to, so tests can assert a blob file was actually created or deleted.
    public static string FromReadUrl(StorageOptions options, string readUrl)
    {
        var relative = readUrl[(options.LocalBaseUrl.TrimEnd('/').Length + 1)..];
        return Path.Combine(options.LocalRootPath, relative.Replace('/', Path.DirectorySeparatorChar));
    }
}
