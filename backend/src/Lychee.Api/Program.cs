using System.Text;
using Lychee.Api.Auth;
using Lychee.Api.Extensions;
using Lychee.Data;
using Lychee.Data.Entities;
using Lychee.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddDbContext<LycheeDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.Password.RequiredLength = 8;
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<LycheeDbContext>();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Read configuration lazily (not into a variable captured before builder.Build())
        // so this picks up any configuration overrides applied at host-build time, e.g.
        // WebApplicationFactory's ConfigureAppConfiguration in tests.
        var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()!;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Secret))
        };
    })
    .AddCookie(Microsoft.AspNetCore.Identity.IdentityConstants.ExternalScheme)
    .AddGoogle(options =>
    {
        options.ClientId = builder.Configuration["Authentication:Google:ClientId"]!;
        options.ClientSecret = builder.Configuration["Authentication:Google:ClientSecret"]!;
        options.SignInScheme = Microsoft.AspNetCore.Identity.IdentityConstants.ExternalScheme;
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<Lychee.Api.Auth.ExternalLoginService>();

builder.Services.AddLycheeStorage(builder.Configuration);
builder.Services.AddLycheeTranslation(builder.Configuration);

// The browser fetches audio bytes directly from this app's static-file host (for local dev
// storage) rather than through the same-origin Next.js proxy — <audio> playback and the
// sentence-mode whole-track pre-download both need this. Frontend and backend run on
// different ports even in normal local dev, so this is a real cross-origin request, not
// just a concern for non-default setups.
const string DevCorsPolicy = "DevCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCorsPolicy, policy =>
    {
        policy.SetIsOriginAllowed(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .WithExposedHeaders("Content-Range", "Accept-Ranges", "Content-Length");
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseCors(DevCorsPolicy);
}

var storageOptions = builder.Configuration.GetSection("Storage").Get<StorageOptions>() ?? new StorageOptions();
var localBlobRoot = Path.IsPathRooted(storageOptions.LocalRootPath)
    ? storageOptions.LocalRootPath
    : Path.Combine(builder.Environment.ContentRootPath, storageOptions.LocalRootPath);
Directory.CreateDirectory(localBlobRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(localBlobRoot),
    RequestPath = "/local-blobs"
});

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<LycheeDbContext>().Database.Migrate();
}

using (var seedScope = app.Services.CreateScope())
{
    await Lychee.Data.IdentitySeeding.SeedRolesAsync(seedScope.ServiceProvider.GetRequiredService<LycheeDbContext>());
}

if (app.Environment.IsDevelopment())
{
    using var adminSeedScope = app.Services.CreateScope();
    var userManager = adminSeedScope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var adminEmail = builder.Configuration["Admin:Email"]!;
    var adminPassword = builder.Configuration["Admin:Password"]!;
    await Lychee.Data.IdentitySeeding.SeedDefaultAdminAsync(userManager, adminEmail, adminPassword);
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program { }
