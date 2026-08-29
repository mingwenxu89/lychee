using Lychee.Data.Entities;

namespace Lychee.Api.Auth;

public interface IJwtTokenService
{
    (string Token, DateTime ExpiresAtUtc) CreateToken(ApplicationUser user, IList<string> roles);
}
