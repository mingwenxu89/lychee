using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lychee.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFullDictationSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FullDictationSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentRound = table.Column<int>(type: "integer", nullable: false),
                    CurrentPhase = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
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

            migrationBuilder.CreateTable(
                name: "FullDictationSentenceResults",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SentenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FullDictationSentenceResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FullDictationSentenceResults_FullDictationSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "FullDictationSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FullDictationSentenceResults_Sentences_SentenceId",
                        column: x => x.SentenceId,
                        principalTable: "Sentences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FullDictationSentenceResults_SentenceId",
                table: "FullDictationSentenceResults",
                column: "SentenceId");

            migrationBuilder.CreateIndex(
                name: "IX_FullDictationSentenceResults_SessionId_SentenceId",
                table: "FullDictationSentenceResults",
                columns: new[] { "SessionId", "SentenceId" },
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FullDictationSentenceResults");

            migrationBuilder.DropTable(
                name: "FullDictationSessions");
        }
    }
}
