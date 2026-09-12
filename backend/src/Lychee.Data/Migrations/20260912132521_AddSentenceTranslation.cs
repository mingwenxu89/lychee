using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lychee.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSentenceTranslation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SentenceTranslations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SentenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    LanguageCode = table.Column<string>(type: "text", nullable: false),
                    TranslatedText = table.Column<string>(type: "text", nullable: false),
                    IsManuallyEdited = table.Column<bool>(type: "boolean", nullable: false),
                    Provider = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SentenceTranslations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SentenceTranslations_Sentences_SentenceId",
                        column: x => x.SentenceId,
                        principalTable: "Sentences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SentenceTranslations_SentenceId_LanguageCode",
                table: "SentenceTranslations",
                columns: new[] { "SentenceId", "LanguageCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SentenceTranslations");
        }
    }
}
