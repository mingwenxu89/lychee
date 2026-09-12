using Lychee.Api.Translation;

namespace Lychee.Api.Extensions;

public static class TranslationServiceCollectionExtensions
{
    public static IServiceCollection AddLycheeTranslation(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<TranslationOptions>(configuration.GetSection("Translation"));

        var provider = configuration["Translation:Provider"] ?? "None";
        if (string.Equals(provider, "DeepSeek", StringComparison.OrdinalIgnoreCase))
        {
            services.AddHttpClient<ITranslationProvider, DeepSeekTranslationProvider>();
        }
        else
        {
            services.AddSingleton<ITranslationProvider, NullTranslationProvider>();
        }

        return services;
    }
}
