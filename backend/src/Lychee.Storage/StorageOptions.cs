namespace Lychee.Storage;

public class StorageOptions
{
    public string Provider { get; set; } = "Local";
    public string LocalRootPath { get; set; } = "local-blobs";
    public string LocalBaseUrl { get; set; } = "http://localhost:5000/local-blobs";
    public string? AzureConnectionString { get; set; }
    public string? AzureAccountUrl { get; set; }
    public string? R2AccountId { get; set; }
    public string? R2AccessKeyId { get; set; }
    public string? R2SecretAccessKey { get; set; }
    public string R2BucketName { get; set; } = "lychee";
}
