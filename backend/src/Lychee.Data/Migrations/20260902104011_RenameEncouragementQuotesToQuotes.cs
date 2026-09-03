using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lychee.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameEncouragementQuotesToQuotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "EncouragementQuotes",
                newName: "Quotes");

            migrationBuilder.RenameIndex(
                name: "PK_EncouragementQuotes",
                table: "Quotes",
                newName: "PK_Quotes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "Quotes",
                newName: "EncouragementQuotes");

            migrationBuilder.RenameIndex(
                name: "PK_Quotes",
                table: "EncouragementQuotes",
                newName: "PK_EncouragementQuotes");
        }
    }
}
