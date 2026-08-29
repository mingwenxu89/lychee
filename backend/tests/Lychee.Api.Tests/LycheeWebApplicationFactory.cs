using Lychee.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Lychee.Api.Tests;

public class LycheeWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string TestConnectionString =
        "Host=localhost;Port=5433;Database=lychee_test;Username=lychee;Password=lychee_dev_password";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = TestConnectionString,
                ["Jwt:Secret"] = "test-only-signing-key-at-least-32-bytes-long",
                ["Jwt:Issuer"] = "lychee-test",
                ["Jwt:Audience"] = "lychee-test-clients",
                ["Jwt:ExpiryDays"] = "7",
                ["Authentication:Google:ClientId"] = "test-google-client-id",
                ["Authentication:Google:ClientSecret"] = "test-google-client-secret",
                ["FrontendBaseUrl"] = "http://localhost:3000"
            });
        });
        builder.ConfigureServices(services =>
        {
            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LycheeDbContext>();
            db.Database.Migrate();
        });
    }
}
