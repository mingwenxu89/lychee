using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace Lychee.Storage;

/// <summary>
/// Cloudflare R2 is S3-compatible, so this talks to it through the AWS S3 SDK pointed at R2's
/// account-scoped endpoint. Everything lives in ONE bucket (<see cref="StorageOptions.R2BucketName"/>)
/// — a "container" here (e.g. "audio", "srt") is just a key prefix within that bucket, not a
/// separate bucket, so setup is a single bucket created once in the Cloudflare dashboard; this
/// service does not create buckets on the fly.
///
/// Deployment note: like <see cref="AzureBlobStorageService"/>, <see cref="GetReadUrlAsync"/>
/// returns a presigned URL that the LEARNER'S BROWSER fetches directly, so the R2 bucket needs
/// its own CORS rules (allowing GET from the deployed frontend's origin) — this API's CORS policy
/// has no effect on those direct-to-R2 requests. R2 has no egress fees, so making the bucket public
/// with a custom domain (skipping presigned URLs entirely) is also a reasonable alternative if
/// read-access control isn't a concern.
/// </summary>
public class R2BlobStorageService : IBlobStorageService
{
    private readonly AmazonS3Client _s3Client;
    private readonly string _bucketName;

    public R2BlobStorageService(IOptions<StorageOptions> options)
    {
        var storageOptions = options.Value;
        if (string.IsNullOrEmpty(storageOptions.R2AccountId)
            || string.IsNullOrEmpty(storageOptions.R2AccessKeyId)
            || string.IsNullOrEmpty(storageOptions.R2SecretAccessKey))
        {
            throw new InvalidOperationException(
                "Storage:Provider is R2 but Storage:R2AccountId, Storage:R2AccessKeyId, and Storage:R2SecretAccessKey must all be configured.");
        }

        _bucketName = storageOptions.R2BucketName;
        var credentials = new BasicAWSCredentials(storageOptions.R2AccessKeyId, storageOptions.R2SecretAccessKey);
        var config = new AmazonS3Config
        {
            ServiceURL = $"https://{storageOptions.R2AccountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true, // R2 requires path-style addressing (bucket in the path, not the host).
            // Without this, the AWS SDK falls back to the machine's ambient AWS region config
            // (e.g. ~/.aws/config) when signing requests — R2 rejects any region name that isn't
            // one of its own pseudo-regions, so this must always be "auto" regardless of environment.
            AuthenticationRegion = "auto",
            // AWSSDK.S3 v4 defaults to streaming uploads with a trailing checksum
            // (STREAMING-AWS4-HMAC-SHA256-PAYLOAD-TRAILER), which R2 doesn't implement and rejects
            // outright. Forcing WHEN_REQUIRED keeps checksums off unless the caller explicitly asks.
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED
        };
        _s3Client = new AmazonS3Client(credentials, config);
    }

    public async Task<string> UploadAsync(string containerName, string blobName, Stream content, string contentType, CancellationToken ct = default)
    {
        await _s3Client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = $"{containerName}/{blobName}",
            InputStream = content,
            ContentType = contentType,
            AutoCloseStream = false,
            // R2 doesn't implement the AWS4 streaming/chunked signed-payload upload the SDK uses
            // by default (even with checksums off) — fall back to a single unsigned-payload PUT,
            // which R2 does support. Safe here since the client is pinned to an https:// endpoint.
            DisablePayloadSigning = true,
            UseChunkEncoding = false
        }, ct);
        return $"{containerName}/{blobName}";
    }

    public Task<string> GetReadUrlAsync(string containerName, string blobName, TimeSpan validFor, CancellationToken ct = default)
    {
        var url = _s3Client.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _bucketName,
            Key = $"{containerName}/{blobName}",
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.Add(validFor),
            // blobName is always a freshly generated GUID (see UploadAsync callers) — a given key's
            // content never changes — so the browser can cache the response as long as it likes
            // without ever revalidating, instead of round-tripping a 304 on every re-fetch of the
            // same presigned URL within one page visit (e.g. Full Listen's <audio> element and the
            // Dictation views' preloaded blob both reading the same track.audioUrl).
            ResponseHeaderOverrides = new ResponseHeaderOverrides { CacheControl = "private, max-age=31536000, immutable" }
        });
        return Task.FromResult(url);
    }

    public async Task DeleteAsync(string containerName, string blobName, CancellationToken ct = default)
    {
        await _s3Client.DeleteObjectAsync(new DeleteObjectRequest
        {
            BucketName = _bucketName,
            Key = $"{containerName}/{blobName}"
        }, ct);
    }
}
