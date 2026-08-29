using Microsoft.AspNetCore.Identity;

namespace Lychee.Data.Entities;

public class ApplicationUser : IdentityUser<Guid>
{
    public int TotalCompletedSentences { get; set; } = 0;
}
