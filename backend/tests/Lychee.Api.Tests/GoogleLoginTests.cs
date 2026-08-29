using System.Net;
using Xunit;

namespace Lychee.Api.Tests;

public class GoogleLoginTests : IClassFixture<LycheeWebApplicationFactory>
{
    private readonly LycheeWebApplicationFactory _factory;

    public GoogleLoginTests(LycheeWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GoogleLogin_RedirectsToGoogleAuthorizeEndpoint()
    {
        var client = _factory.CreateClient(new() { AllowAutoRedirect = false });

        var response = await client.GetAsync("/api/auth/google/login");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!.ToString();
        Assert.Contains("accounts.google.com", location);
        Assert.Contains("client_id=test-google-client-id", location);
    }
}
