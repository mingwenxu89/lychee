using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Lychee.Data.Tests;

public class RecitationAttemptTests
{
    private const string TestConnectionString =
        "Host=localhost;Port=5433;Database=lychee_test;Username=lychee;Password=lychee_dev_password";

    private static LycheeDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<LycheeDbContext>()
            .UseNpgsql(TestConnectionString)
            .Options;
        var context = new LycheeDbContext(options);
        context.Database.Migrate();
        return context;
    }

    private static async Task<(ApplicationUser user, Track track)> SeedUserAndTrackAsync(LycheeDbContext context)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = $"user-{Guid.NewGuid():N}@example.test",
            Email = $"user-{Guid.NewGuid():N}@example.test"
        };
        var exercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Title = "Test Exercise",
            Units =
            {
                new Unit
                {
                    Id = Guid.NewGuid(),
                    Title = "Unit 1",
                    Order = 1,
                    Tracks =
                    {
                        new Track
                        {
                            Id = Guid.NewGuid(),
                            AudioFileUrl = "https://example.test/a.mp3",
                            SrtFileUrl = "https://example.test/a.srt",
                            Duration = TimeSpan.FromMinutes(1),
                            Level = "A1"
                        }
                    }
                }
            }
        };

        context.Users.Add(user);
        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();

        return (user, exercise.Units[0].Tracks[0]);
    }

    [Fact]
    public async Task RecitationAttempt_QualifiedSentenceIds_RoundTripsThroughPostgres()
    {
        await using var seedContext = CreateContext();
        var (user, track) = await SeedUserAndTrackAsync(seedContext);

        var expectedIds = new List<Guid> { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var attemptId = Guid.NewGuid();

        await using (var writeContext = CreateContext())
        {
            writeContext.RecitationAttempts.Add(new RecitationAttempt
            {
                Id = attemptId,
                UserId = user.Id,
                TrackId = track.Id,
                SubmittedText = "This is my recitation attempt.",
                Score = 0.87,
                DiffDetail = "{}",
                QualifiedSentenceIds = expectedIds,
                CreatedAt = DateTime.UtcNow
            });
            await writeContext.SaveChangesAsync();
        }

        await using var readContext = CreateContext();
        var reloaded = await readContext.RecitationAttempts
            .AsNoTracking()
            .SingleAsync(a => a.Id == attemptId);

        Assert.Equal(expectedIds.Count, reloaded.QualifiedSentenceIds.Count);
        Assert.Equal(expectedIds, reloaded.QualifiedSentenceIds);
    }

    [Fact]
    public async Task RecitationAttempt_EmptyQualifiedSentenceIds_RoundTripsAsEmptyListNotNull()
    {
        await using var seedContext = CreateContext();
        var (user, track) = await SeedUserAndTrackAsync(seedContext);

        var attemptId = Guid.NewGuid();

        await using (var writeContext = CreateContext())
        {
            writeContext.RecitationAttempts.Add(new RecitationAttempt
            {
                Id = attemptId,
                UserId = user.Id,
                TrackId = track.Id,
                SubmittedText = "Empty qualified list attempt.",
                Score = 0.0,
                DiffDetail = "{}",
                QualifiedSentenceIds = new List<Guid>(),
                CreatedAt = DateTime.UtcNow
            });
            await writeContext.SaveChangesAsync();
        }

        await using var readContext = CreateContext();
        var reloaded = await readContext.RecitationAttempts
            .AsNoTracking()
            .SingleAsync(a => a.Id == attemptId);

        Assert.NotNull(reloaded.QualifiedSentenceIds);
        Assert.Empty(reloaded.QualifiedSentenceIds);
    }
}
