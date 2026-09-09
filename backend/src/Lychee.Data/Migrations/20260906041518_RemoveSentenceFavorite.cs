using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lychee.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSentenceFavorite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SentenceFavorites");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SentenceFavorites",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SentenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SentenceFavorites", x => new { x.UserId, x.SentenceId });
                    table.ForeignKey(
                        name: "FK_SentenceFavorites_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SentenceFavorites_Sentences_SentenceId",
                        column: x => x.SentenceId,
                        principalTable: "Sentences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SentenceFavorites_SentenceId",
                table: "SentenceFavorites",
                column: "SentenceId");
        }
    }
}
