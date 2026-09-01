using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lychee.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDescriptionToTrack : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Tracks",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Tracks");
        }
    }
}
