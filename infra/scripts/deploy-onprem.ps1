param(
  [string]$ComposeFile = "infra/docker/docker-compose.onprem.yml",
  [string]$ReleaseEnvFile = "infra/docker/env/onprem.release.env",
  [string]$BackendEnvFile = "infra/docker/env/backend.prod.env",
  [string]$FrontendEnvFile = "infra/docker/env/frontend.prod.env",
  [string]$StateFile = "infra/state/current-release.env",
  [switch]$RunDbSeed,
  [switch]$BuildImages
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ReleaseEnvFile)) {
  throw "Missing release env file: $ReleaseEnvFile"
}

if (-not (Test-Path $BackendEnvFile)) {
  throw "Missing backend env file: $BackendEnvFile"
}

if (-not (Test-Path $FrontendEnvFile)) {
  throw "Missing frontend env file: $FrontendEnvFile"
}

$composeArgs = @("--env-file", $ReleaseEnvFile, "-f", $ComposeFile)

if ($BuildImages.IsPresent) {
  docker compose @composeArgs build backend frontend
}
else {
  docker compose @composeArgs pull backend frontend
}

docker compose @composeArgs up -d postgres
docker compose @composeArgs --profile ops run --rm migrate

if ($RunDbSeed.IsPresent) {
  docker compose @composeArgs --profile ops run --rm seed
}

docker compose @composeArgs up -d backend frontend reverse-proxy

& "infra/scripts/post-deploy-smoke.ps1"

$stateDir = Split-Path -Parent $StateFile
if (-not (Test-Path $stateDir)) {
  New-Item -Path $stateDir -ItemType Directory | Out-Null
}

Copy-Item -Path $ReleaseEnvFile -Destination $StateFile -Force

Write-Host "Deployment completed successfully."
