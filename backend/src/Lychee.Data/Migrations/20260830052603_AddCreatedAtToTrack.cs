using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lychee.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatedAtToTrack : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Tracks",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Tracks");
        }
    }
}
