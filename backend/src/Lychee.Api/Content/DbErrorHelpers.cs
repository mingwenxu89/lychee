using Lychee.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Lychee.Api.Content;

/// <summary>
/// Small helpers for recovering from expected database-level races (unique constraint
/// violations and deadlocks from concurrent requests) instead of letting them surface as
/// unhandled 500s.
/// </summary>
public static class DbErrorHelpers
{
    private const string DailyPracticeLogUniqueIndexName =
        "IX_DailyPracticeLogs_UserId_Date_SentenceId_PracticeType";

    /// <summary>
    /// Calls <paramref name="db"/>.SaveChangesAsync(), recovering from two concurrent-write races
    /// that a same-day (UserId, Date, SentenceId, PracticeType) DailyPracticeLog insert can hit
    /// when raced against an identical concurrent request:
    ///
    ///  - a unique-violation (SQLSTATE 23505) on DailyPracticeLog's own unique index: the other
    ///    request's insert committed first. Detach this request's own DailyPracticeLog insert(s)
    ///    (not the other entities in the same SaveChanges call — e.g. a PracticeRecord or
    ///    RecitationAttempt — those are untouched and still commit) and retry. Losing this
    ///    request's own log row(s) is fine: the other request's row already satisfies what the
    ///    log is for (did the learner practice this today).
    ///
    ///  - a deadlock (SQLSTATE 40P01): Postgres can raise this instead of a plain unique
    ///    violation when a single SaveChanges call batches MULTIPLE inserts into the same unique
    ///    index (as RecitationAttemptsController.Submit does, one row per qualified sentence) and
    ///    two such transactions interleave their lock acquisition in different orders. Postgres
    ///    aborts one whole transaction to break the cycle, so nothing from it committed — no
    ///    detach needed, just retry the whole save.
    ///
    /// Bounded to <paramref name="maxAttempts"/> so a genuinely different failure still surfaces.
    /// </summary>
    public static async Task SaveChangesRecoveringDailyPracticeLogRaceAsync(DbContext db, int maxAttempts = 5)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await db.SaveChangesAsync();
                return;
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, DailyPracticeLogUniqueIndexName))
            {
                foreach (var entry in db.ChangeTracker.Entries<DailyPracticeLog>()
                    .Where(e => e.State == EntityState.Added).ToList())
                {
                    entry.State = EntityState.Detached;
                }
                if (attempt >= maxAttempts) throw;
            }
            catch (Exception ex) when (attempt < maxAttempts && IsDeadlock(ex))
            {
                // Nothing committed — loop around and retry the save as-is.
            }
        }
    }

    /// <summary>
    /// True if <paramref name="ex"/> was caused by a Postgres unique-violation (SQLSTATE 23505)
    /// on the specific index/constraint named <paramref name="constraintName"/>. Checking the
    /// constraint name (not just the SQLSTATE) avoids swallowing an unrelated unique violation.
    /// </summary>
    private static bool IsUniqueConstraintViolation(DbUpdateException ex, string constraintName) =>
        ex.InnerException is PostgresException { SqlState: "23505" } pgEx &&
        pgEx.ConstraintName == constraintName;

    /// <summary>
    /// True if a Postgres deadlock (SQLSTATE 40P01) appears anywhere in <paramref name="ex"/>'s
    /// inner-exception chain. EF Core's default (non-retrying) execution strategy recognizes
    /// deadlocks as transient and re-wraps them in an <see cref="InvalidOperationException"/>
    /// (suggesting the caller enable retry-on-failure) rather than letting the
    /// <see cref="DbUpdateException"/> propagate directly, so this walks the whole chain instead
    /// of checking only the immediate InnerException.
    /// </summary>
    private static bool IsDeadlock(Exception ex)
    {
        for (var current = ex; current is not null; current = current.InnerException)
        {
            if (current is PostgresException { SqlState: "40P01" }) return true;
        }
        return false;
    }
}
