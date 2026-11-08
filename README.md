# Lychee

English listening / dictation / shadowing practice web app.

## Local development

Prerequisites: .NET 10 SDK, Node.js 20+, Docker Desktop, `dotnet-ef` (`dotnet tool install --global dotnet-ef`).

1. `docker compose up -d postgres postgres_test`
2. `cd backend && dotnet run --project src/Lychee.Api`
3. `cd frontend && npm install && npm run dev`

Backend: http://localhost:5000/health · Frontend: http://localhost:3000
