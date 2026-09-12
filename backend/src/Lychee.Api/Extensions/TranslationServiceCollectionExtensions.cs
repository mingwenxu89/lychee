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
            // A whole-track translation batch call can legitimately take a while - the default
            // 100-second HttpClient timeout is too tight for that, so give it a generous ceiling.
            services.AddHttpClient<ITranslationProvider, DeepSeekTranslationProvider>(
                client => client.Timeout = TimeSpan.FromMinutes(5));
        }
        else
        {
            services.AddSingleton<ITranslationProvider, NullTranslationProvider>();
        }

        return services;
    }
}
