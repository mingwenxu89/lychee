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
    }
}
