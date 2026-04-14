param(
  [string]$ComposeFile = "infra/docker/docker-compose.onprem.yml",
  [string]$RollbackReleaseFile = "infra/state/previous-release.env",
  [string]$BackendEnvFile = "infra/docker/env/backend.prod.env",
  [string]$FrontendEnvFile = "infra/docker/env/frontend.prod.env"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $RollbackReleaseFile)) {
  throw "Rollback release file not found: $RollbackReleaseFile"
}

if (-not (Test-Path $BackendEnvFile)) {
  throw "Missing backend env file: $BackendEnvFile"
}

if (-not (Test-Path $FrontendEnvFile)) {
  throw "Missing frontend env file: $FrontendEnvFile"
}

$composeArgs = @("--env-file", $RollbackReleaseFile, "-f", $ComposeFile)

docker compose @composeArgs pull backend frontend
docker compose @composeArgs up -d backend frontend reverse-proxy

& "infra/scripts/post-deploy-smoke.ps1"

Write-Host "Rollback completed successfully."
