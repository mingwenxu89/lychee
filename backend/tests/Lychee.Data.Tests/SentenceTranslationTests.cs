using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Lychee.Data.Tests;

public class SentenceTranslationTests
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
    public async Task DeletingSentence_CascadesToItsTranslations()
    {
        await using var context = CreateContext();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var sentenceId = Guid.NewGuid();

        var exercise = new Exercise
        {
            Id = Guid.NewGuid(),
            Title = $"Short Stories {suffix}",
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
                                    Id = sentenceId,
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

        context.SentenceTranslations.Add(new SentenceTranslation
        {
            Id = Guid.NewGuid(),
            SentenceId = sentenceId,
            LanguageCode = "zh",
            TranslatedText = "我今早看到了第一场雪。",
            IsManuallyEdited = false,
            Provider = "deepseek-flash",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        context.Exercises.Remove(exercise);
        await context.SaveChangesAsync();

        await using var reloadContext = CreateContext();
        var remaining = await reloadContext.SentenceTranslations.CountAsync(t => t.SentenceId == sentenceId);
        Assert.Equal(0, remaining);
    }
}
