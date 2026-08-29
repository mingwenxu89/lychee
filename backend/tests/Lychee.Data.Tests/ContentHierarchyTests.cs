using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Lychee.Data.Tests;

public class ContentHierarchyTests
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

    [Fact]
    public async Task SavingExercise_CascadesThroughUnitTrackSentence_AndReloads()
    {
        await using var context = CreateContext();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var exercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Title = $"Short Stories {suffix}",
            Category = "Short Stories",
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
                            AudioFileUrl = "https://example.test/audio.mp3",
                            SrtFileUrl = "https://example.test/audio.srt",
                            Duration = TimeSpan.FromMinutes(2),
                            Level = "A1",
                            Sentences =
                            {
                                new Sentence
                                {
                                    Id = Guid.NewGuid(),
                                    Index = 0,
                                    Text = "I saw the first snowfall this morning.",
                                    StartTime = TimeSpan.FromSeconds(0),
                                    EndTime = TimeSpan.FromSeconds(3)
                                }
                            }
                        }
                    }
                }
            }
        };

        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();

        await using var reloadContext = CreateContext();
        var reloaded = await reloadContext.Exercises
            .Include(e => e.Units).ThenInclude(u => u.Tracks).ThenInclude(t => t.Sentences)
            .SingleAsync(e => e.Id == exercise.Id);

        Assert.Single(reloaded.Units);
        Assert.Single(reloaded.Units[0].Tracks);
        Assert.Single(reloaded.Units[0].Tracks[0].Sentences);
        Assert.Equal("A1", reloaded.Units[0].Tracks[0].Level);
        Assert.Equal(TimeSpan.FromSeconds(3), reloaded.Units[0].Tracks[0].Sentences[0].EndTime);
    }
}
