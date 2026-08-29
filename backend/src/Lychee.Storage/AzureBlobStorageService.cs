using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using Microsoft.Extensions.Options;

namespace Lychee.Storage;

public class AzureBlobStorageService : IBlobStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly bool _usesManagedIdentity;

    public AzureBlobStorageService(IOptions<StorageOptions> options)
    {
        var storageOptions = options.Value;
        if (!string.IsNullOrEmpty(storageOptions.AzureConnectionString))
        {
            _blobServiceClient = new BlobServiceClient(storageOptions.AzureConnectionString);
            _usesManagedIdentity = false;
        }
        else if (!string.IsNullOrEmpty(storageOptions.AzureAccountUrl))
        {
            _blobServiceClient = new BlobServiceClient(new Uri(storageOptions.AzureAccountUrl), new DefaultAzureCredential());
            _usesManagedIdentity = true;
        }
        else
        {
            throw new InvalidOperationException(
                "Storage:Provider is Azure but neither Storage:AzureConnectionString nor Storage:AzureAccountUrl is configured.");
        }
    }

    public async Task<string> UploadAsync(string containerName, string blobName, Stream content, string contentType, CancellationToken ct = default)
    {
        var container = _blobServiceClient.GetBlobContainerClient(containerName);
        await container.CreateIfNotExistsAsync(cancellationToken: ct);
        var blobClient = container.GetBlobClient(blobName);
        await blobClient.UploadAsync(content, new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = contentType }, cancellationToken: ct);
        return $"{containerName}/{blobName}";
    }

    public async Task<string> GetReadUrlAsync(string containerName, string blobName, TimeSpan validFor, CancellationToken ct = default)
    {
        var blobClient = _blobServiceClient.GetBlobContainerClient(containerName).GetBlobClient(blobName);
        var expiresOn = DateTimeOffset.UtcNow.Add(validFor);

        if (!_usesManagedIdentity)
        {
            var sasBuilder = new BlobSasBuilder
            {
                BlobContainerName = containerName,
                BlobName = blobName,
                Resource = "b",
                ExpiresOn = expiresOn
            };
            sasBuilder.SetPermissions(BlobSasPermissions.Read);
            return blobClient.GenerateSasUri(sasBuilder).ToString();
        }

        // Managed Identity has no account key to sign a SAS with directly — it must first
        // obtain a short-lived user-delegation key from Azure AD, then sign with that instead.
        var delegationKeyStart = DateTimeOffset.UtcNow;
        var userDelegationKey = await _blobServiceClient.GetUserDelegationKeyAsync(delegationKeyStart, expiresOn, ct);
        var delegationSasBuilder = new BlobSasBuilder
        {
            BlobContainerName = containerName,
            BlobName = blobName,
            Resource = "b",
            StartsOn = delegationKeyStart,
            ExpiresOn = expiresOn
        };
        delegationSasBuilder.SetPermissions(BlobSasPermissions.Read);
        var sasQuery = delegationSasBuilder.ToSasQueryParameters(userDelegationKey.Value, _blobServiceClient.AccountName);
        return $"{blobClient.Uri}?{sasQuery}";
    }

    public async Task DeleteAsync(string containerName, string blobName, CancellationToken ct = default)
    {
        var blobClient = _blobServiceClient.GetBlobContainerClient(containerName).GetBlobClient(blobName);
        await blobClient.DeleteIfExistsAsync(cancellationToken: ct);
    }
}
