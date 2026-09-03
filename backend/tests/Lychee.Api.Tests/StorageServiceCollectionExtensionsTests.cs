using Lychee.Api.Extensions;
using Lychee.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Lychee.Api.Tests;

public class StorageServiceCollectionExtensionsTests
{
    private static IServiceProvider BuildProvider(string provider)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:Provider"] = provider,
                ["Storage:LocalRootPath"] = "local-blobs",
                ["Storage:LocalBaseUrl"] = "http://localhost:5000/local-blobs",
                ["Storage:AzureConnectionString"] = "UseDevelopmentStorage=true",
                ["Storage:R2AccountId"] = "test-account",
                ["Storage:R2AccessKeyId"] = "test-key",
                ["Storage:R2SecretAccessKey"] = "test-secret"
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLycheeStorage(configuration);
        return services.BuildServiceProvider();
    }

    [Fact]
    public void Provider_Local_ResolvesLocalFileBlobStorageService()
    {
        var provider = BuildProvider("Local");
        Assert.IsType<LocalFileBlobStorageService>(provider.GetRequiredService<IBlobStorageService>());
    }

    [Fact]
    public void Provider_Azure_ResolvesAzureBlobStorageService()
    {
        var provider = BuildProvider("Azure");
        Assert.IsType<AzureBlobStorageService>(provider.GetRequiredService<IBlobStorageService>());
    }

    [Fact]
    public void Provider_R2_ResolvesR2BlobStorageService()
    {
        var provider = BuildProvider("R2");
        Assert.IsType<R2BlobStorageService>(provider.GetRequiredService<IBlobStorageService>());
    }
}
