#!/usr/bin/env bash
# Runs the backend for local development: loads backend/.env (R2 storage credentials, see
# .env.example) and binds to port 5050 to match frontend/.env.local's BACKEND_API_URL — the
# launchSettings.json default of 5000 collides with macOS AirPlay Receiver on some machines.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "warning: backend/.env not found — copy .env.example to .env and fill in real values" >&2
  echo "         (falling back to whatever Storage:Provider is set in appsettings.Development.json)" >&2
fi

export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
export ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://localhost:5050}"

exec dotnet run --project src/Lychee.Api --no-launch-profile
