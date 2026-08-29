using Lychee.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Lychee.Data;

public class LycheeDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public LycheeDbContext(DbContextOptions<LycheeDbContext> options) : base(options) { }

    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Track> Tracks => Set<Track>();
    public DbSet<Sentence> Sentences => Set<Sentence>();
    public DbSet<SentenceFavorite> SentenceFavorites => Set<SentenceFavorite>();
    public DbSet<TrackFavorite> TrackFavorites => Set<TrackFavorite>();
    public DbSet<PracticeSession> PracticeSessions => Set<PracticeSession>();
    public DbSet<PracticeRecord> PracticeRecords => Set<PracticeRecord>();
    public DbSet<RecitationAttempt> RecitationAttempts => Set<RecitationAttempt>();
    public DbSet<DailyPracticeLog> DailyPracticeLogs => Set<DailyPracticeLog>();
    public DbSet<EncouragementQuote> EncouragementQuotes => Set<EncouragementQuote>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Exercise>()
            .HasMany(e => e.Units)
            .WithOne(u => u.Exercise)
            .HasForeignKey(u => u.ExerciseId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Unit>()
            .HasMany(u => u.Tracks)
            .WithOne(t => t.Unit)
            .HasForeignKey(t => t.UnitId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Track>()
            .HasMany(t => t.Sentences)
            .WithOne(s => s.Track)
            .HasForeignKey(s => s.TrackId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SentenceFavorite>().HasKey(f => new { f.UserId, f.SentenceId });
        modelBuilder.Entity<TrackFavorite>().HasKey(f => new { f.UserId, f.TrackId });

        modelBuilder.Entity<PracticeSession>()
            .HasIndex(s => new { s.UserId, s.TrackId })
            .IsUnique();

        modelBuilder.Entity<RecitationAttempt>()
            .Property(r => r.QualifiedSentenceIds)
            .HasColumnType("jsonb");

        modelBuilder.Entity<DailyPracticeLog>()
            .HasIndex(l => new { l.UserId, l.Date, l.SentenceId, l.PracticeType })
            .IsUnique();
    }
}
