using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lychee.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderToTrack : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Order",
                table: "Tracks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Existing tracks had no explicit order — backfill one per unit from creation order
            // so the new admin ordering UI starts from a sensible, stable baseline.
            migrationBuilder.Sql(@"
                UPDATE ""Tracks"" AS t
                SET ""Order"" = ranked.rn
                FROM (
                    SELECT ""Id"", ROW_NUMBER() OVER (PARTITION BY ""UnitId"" ORDER BY ""CreatedAt"") AS rn
                    FROM ""Tracks""
                ) AS ranked
                WHERE t.""Id"" = ranked.""Id"";
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Order",
                table: "Tracks");
        }
    }
}
