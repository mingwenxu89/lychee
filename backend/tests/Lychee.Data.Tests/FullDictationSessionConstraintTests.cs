using Lychee.Data;
using Lychee.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Lychee.Data.Tests;

public class FullDictationSessionConstraintTests
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
    public async Task FullDictationSession_DuplicateUserTrack_ThrowsOnSecondInsert()
    {
        await using var context = CreateContext();
        var (user, sentence) = await SeedUserAndSentenceAsync(context);
        var trackId = sentence.TrackId;

        context.FullDictationSessions.Add(new FullDictationSession
        {
            Id = Guid.NewGuid(), UserId = user.Id, TrackId = trackId,
            Status = FullDictationSessionStatus.InProgress, CurrentRound = 1,
            CurrentPhase = FullDictationPhase.Blind, UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        context.FullDictationSessions.Add(new FullDictationSession
        {
            Id = Guid.NewGuid(), UserId = user.Id, TrackId = trackId,
            Status = FullDictationSessionStatus.InProgress, CurrentRound = 1,
            CurrentPhase = FullDictationPhase.Blind, UpdatedAt = DateTime.UtcNow
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task FullDictationSentenceResult_DuplicateSessionSentence_ThrowsOnSecondInsert()
    {
        await using var context = CreateContext();
        var (user, sentence) = await SeedUserAndSentenceAsync(context);
        var session = new FullDictationSession
        {
            Id = Guid.NewGuid(), UserId = user.Id, TrackId = sentence.TrackId,
            Status = FullDictationSessionStatus.InProgress, CurrentRound = 1,
            CurrentPhase = FullDictationPhase.Blind, UpdatedAt = DateTime.UtcNow
        };
        context.FullDictationSessions.Add(session);
        await context.SaveChangesAsync();

        context.FullDictationSentenceResults.Add(new FullDictationSentenceResult
        {
            Id = Guid.NewGuid(), SessionId = session.Id, SentenceId = sentence.Id, IsCorrect = true
        });
        await context.SaveChangesAsync();

        context.FullDictationSentenceResults.Add(new FullDictationSentenceResult
        {
            Id = Guid.NewGuid(), SessionId = session.Id, SentenceId = sentence.Id, IsCorrect = false
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }
}
