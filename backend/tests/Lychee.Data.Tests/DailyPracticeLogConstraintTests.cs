using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Lychee.Data.Tests;

public class DailyPracticeLogConstraintTests
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

    private static async Task<(ApplicationUser user, Sentence sentence)> SeedUserAndSentenceAsync(LycheeDbContext context)
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
                            AudioFileUrl = "https://example.test/a.mp3",
                            SrtFileUrl = "https://example.test/a.srt",
                            Duration = TimeSpan.FromMinutes(1),
                            Level = "A1",
                            Sentences = { new Sentence { Id = Guid.NewGuid(), Index = 0, Text = "Hi.", StartTime = TimeSpan.Zero, EndTime = TimeSpan.FromSeconds(1) } }
                        }
                    }
                }
            }
        };

        context.Users.Add(user);
        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();

        return (user, exercise.Units[0].Tracks[0].Sentences[0]);
    }

    [Fact]
    public async Task DailyPracticeLog_DuplicateUserDateSentenceType_ThrowsOnSecondInsert()
    {
        await using var context = CreateContext();
        var (user, sentence) = await SeedUserAndSentenceAsync(context);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        context.DailyPracticeLogs.Add(new DailyPracticeLog
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Date = today,
            SentenceId = sentence.Id,
            PracticeType = PracticeLogType.Practice
        });
        await context.SaveChangesAsync();

        context.DailyPracticeLogs.Add(new DailyPracticeLog
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Date = today,
            SentenceId = sentence.Id,
            PracticeType = PracticeLogType.Practice
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task DailyPracticeLog_SameSentenceDifferentPracticeType_BothSucceed()
    {
        await using var context = CreateContext();
        var (user, sentence) = await SeedUserAndSentenceAsync(context);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        context.DailyPracticeLogs.AddRange(
            new DailyPracticeLog { Id = Guid.NewGuid(), UserId = user.Id, Date = today, SentenceId = sentence.Id, PracticeType = PracticeLogType.Practice },
            new DailyPracticeLog { Id = Guid.NewGuid(), UserId = user.Id, Date = today, SentenceId = sentence.Id, PracticeType = PracticeLogType.Recitation });

        var savedCount = await context.SaveChangesAsync();
        Assert.Equal(2, savedCount);
    }
}
