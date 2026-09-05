using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lychee.Data.Migrations
{
    /// <inheritdoc />
    public partial class MergeFullDictationIntoPracticeSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add the Mode column first — existing PracticeSession rows default to Sentence (0).
            migrationBuilder.AddColumn<int>(
                name: "Mode",
                table: "PracticeSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // 2. Drop the old 2-column unique index before inserting FullDictation rows below —
            //    a learner who already has a Sentence-mode row for a track would otherwise
            //    collide with it on (UserId, TrackId) alone, since Mode doesn't factor in yet.
            migrationBuilder.DropIndex(
                name: "IX_PracticeSessions_UserId_TrackId",
                table: "PracticeSessions");

            // 3. Carry every existing FullDictationSession row over, preserving its Id so
            //    FullDictationSentenceResults.SessionId keeps pointing at the same row once
            //    repointed below. The old round number doesn't translate to the new
            //    queue-position indexing scheme, so CurrentSentenceIndex resets to 0 — equivalent
            //    to "restart this round's queue from its first sentence"; nothing is lost about
            //    which sentences are already correct, since that lives in
            //    FullDictationSentenceResults and isn't touched here. Mode 1 = FullDictation
            //    (see the PracticeMode enum).
            migrationBuilder.Sql(
                """
                INSERT INTO "PracticeSessions" ("Id", "UserId", "TrackId", "Mode", "Status", "CurrentSentenceIndex", "UpdatedAt", "CompletedAt")
                SELECT "Id", "UserId", "TrackId", 1, "Status", 0, "UpdatedAt", "CompletedAt"
                FROM "FullDictationSessions";
                """);

            // 4. Drop the old FK/table now that the data has a new home.
            migrationBuilder.DropForeignKey(
                name: "FK_FullDictationSentenceResults_FullDictationSessions_SessionId",
                table: "FullDictationSentenceResults");

            migrationBuilder.DropTable(
                name: "FullDictationSessions");

            // 5. Create the 3-column unique index scoped by Mode, so a learner can have one
            //    InProgress Sentence session and one InProgress FullDictation session for the
            //    same track at once.
            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessions_UserId_TrackId_Mode",
                table: "PracticeSessions",
                columns: new[] { "UserId", "TrackId", "Mode" },
                unique: true);

            // 6. Repoint FullDictationSentenceResults at the merged table.
            migrationBuilder.AddForeignKey(
                name: "FK_FullDictationSentenceResults_PracticeSessions_SessionId",
                table: "FullDictationSentenceResults",
                column: "SessionId",
                principalTable: "PracticeSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        // Unlike Up(), this does not carry FullDictation-mode rows back out of PracticeSessions —
        // rolling back discards them, same as any migration that merges rows out of a dropped
        // table. Acceptable here since this is a schema rollback safety net, not an expected path.
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FullDictationSentenceResults_PracticeSessions_SessionId",
                table: "FullDictationSentenceResults");

            migrationBuilder.DropIndex(
                name: "IX_PracticeSessions_UserId_TrackId_Mode",
                table: "PracticeSessions");

            migrationBuilder.DropColumn(
                name: "Mode",
                table: "PracticeSessions");

            migrationBuilder.CreateTable(
                name: "FullDictationSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CurrentRound = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FullDictationSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FullDictationSessions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FullDictationSessions_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PracticeSessions_UserId_TrackId",
                table: "PracticeSessions",
                columns: new[] { "UserId", "TrackId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FullDictationSessions_TrackId",
                table: "FullDictationSessions",
                column: "TrackId");

            migrationBuilder.CreateIndex(
                name: "IX_FullDictationSessions_UserId_TrackId",
                table: "FullDictationSessions",
                columns: new[] { "UserId", "TrackId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_FullDictationSentenceResults_FullDictationSessions_SessionId",
                table: "FullDictationSentenceResults",
                column: "SessionId",
                principalTable: "FullDictationSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
