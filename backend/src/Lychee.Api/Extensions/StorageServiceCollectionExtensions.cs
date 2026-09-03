using Lychee.Storage;

namespace Lychee.Api.Extensions;

public static class StorageServiceCollectionExtensions
{
    public static IServiceCollection AddLycheeStorage(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<StorageOptions>(configuration.GetSection("Storage"));

        var provider = configuration["Storage:Provider"] ?? "Local";
        if (string.Equals(provider, "Azure", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IBlobStorageService, AzureBlobStorageService>();
        }
        else if (string.Equals(provider, "R2", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IBlobStorageService, R2BlobStorageService>();
        }
        else
        {
            services.AddSingleton<IBlobStorageService, LocalFileBlobStorageService>();
        }

        return services;
    }
}
