param(
  [string]$ApiHealthUrl = "http://127.0.0.1/api/v1/health/ready",
  [string]$WebHealthUrl = "http://127.0.0.1/",
  [int]$Attempts = 30,
  [int]$SleepSeconds = 5
)

$ErrorActionPreference = "Stop"

function Test-Url {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
  }
  catch {
    return $false
  }
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [string]$Name
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if (Test-Url -Url $Url) {
      Write-Host "$Name health check passed ($Url)"
      return
    }

    Start-Sleep -Seconds $SleepSeconds
  }

  throw "$Name health check failed ($Url)"
}

Wait-ForUrl -Url $ApiHealthUrl -Name "API"
Wait-ForUrl -Url $WebHealthUrl -Name "Web"
