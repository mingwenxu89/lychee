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
    public DbSet<SentenceTranslation> SentenceTranslations => Set<SentenceTranslation>();
    public DbSet<TrackFavorite> TrackFavorites => Set<TrackFavorite>();
    public DbSet<SentenceFavorite> SentenceFavorites => Set<SentenceFavorite>();
    public DbSet<PracticeSession> PracticeSessions => Set<PracticeSession>();
    public DbSet<RecitationAttempt> RecitationAttempts => Set<RecitationAttempt>();
    public DbSet<FullDictationSentenceResult> FullDictationSentenceResults => Set<FullDictationSentenceResult>();
    public DbSet<DailyPracticeLog> DailyPracticeLogs => Set<DailyPracticeLog>();
    public DbSet<Quote> Quotes => Set<Quote>();

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

        modelBuilder.Entity<SentenceTranslation>()
            .HasIndex(t => new { t.SentenceId, t.LanguageCode })
            .IsUnique();

        modelBuilder.Entity<SentenceTranslation>()
            .HasOne(t => t.Sentence)
            .WithMany()
            .HasForeignKey(t => t.SentenceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Track>()
            .Property(t => t.CreatedAt)
            .HasDefaultValueSql("now()")
            .ValueGeneratedOnAdd();

        modelBuilder.Entity<TrackFavorite>().HasKey(f => new { f.UserId, f.TrackId });
        modelBuilder.Entity<SentenceFavorite>().HasKey(f => new { f.UserId, f.SentenceId });

        // A learner can have one InProgress-or-Completed row per (UserId, TrackId, Mode) — a
        // Sentence Dictation session and a Full Dictation session for the same track are
        // independent and can both be in progress at once.
        modelBuilder.Entity<PracticeSession>()
            .HasIndex(s => new { s.UserId, s.TrackId, s.Mode })
            .IsUnique();

        modelBuilder.Entity<FullDictationSentenceResult>()
            .HasIndex(r => new { r.SessionId, r.SentenceId })
            .IsUnique();

        modelBuilder.Entity<FullDictationSentenceResult>()
            .Property(r => r.SubmittedText)
            .HasDefaultValue("");

        modelBuilder.Entity<PracticeSession>()
            .HasMany<FullDictationSentenceResult>()
            .WithOne(r => r.Session)
            .HasForeignKey(r => r.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RecitationAttempt>()
            .Property(r => r.QualifiedSentenceIds)
            .HasColumnType("jsonb");

        modelBuilder.Entity<DailyPracticeLog>()
            .HasIndex(l => new { l.UserId, l.Date, l.SentenceId, l.PracticeType })
            .IsUnique();

        modelBuilder.Entity<Exercise>().Property(e => e.IsPublished).HasDefaultValue(true);
        modelBuilder.Entity<Unit>().Property(u => u.IsPublished).HasDefaultValue(true);
        modelBuilder.Entity<Track>().Property(t => t.IsPublished).HasDefaultValue(true);

        modelBuilder.Entity<Track>()
            .Property(t => t.Title)
            .HasDefaultValue("Untitled Track");
    }
}
