FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/Lychee.Api/Lychee.Api.csproj src/Lychee.Api/
COPY src/Lychee.Data/Lychee.Data.csproj src/Lychee.Data/
COPY src/Lychee.Storage/Lychee.Storage.csproj src/Lychee.Storage/
RUN dotnet restore src/Lychee.Api/Lychee.Api.csproj
COPY src/ src/
RUN dotnet publish src/Lychee.Api/Lychee.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Lychee.Api.dll"]
