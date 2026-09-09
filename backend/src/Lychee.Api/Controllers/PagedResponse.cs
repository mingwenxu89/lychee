namespace Lychee.Api.Controllers;

public record PagedResponse<T>(List<T> Items, int TotalCount, int Page, int PageSize);
