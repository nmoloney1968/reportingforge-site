[CmdletBinding()]
param(
    [string]$ApiHealthUrl = "https://api.reportingforge.com/health",
    [string]$WorkersDevHealthUrl = "https://rf-webhooks.nmoloney1968.workers.dev/health",
    [switch]$SkipWorkersDev
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# This script focuses on Worker reachability and health behavior.
# It is read-only and only performs GET requests plus a Markdown report write.

$repoRoot = Split-Path -Parent $PSScriptRoot
$reportsDir = Join-Path $repoRoot "reports"
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$reportPath = Join-Path $reportsDir ("worker-health-{0}Z.md" -f $timestamp)

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message)
}

function Test-HealthEndpoint {
    param(
        [string]$Url,
        [string]$Label
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 20 -ErrorAction Stop
        $stopwatch.Stop()
        $rawBody = [string]$response.Content
        $normalizedBody = ($rawBody -replace "\s+", "").ToLowerInvariant()

        $okJson = $false
        try {
            $parsed = $rawBody | ConvertFrom-Json -ErrorAction Stop
            $okJson = ($parsed.ok -eq $true)
        }
        catch {
            $okJson = $false
        }

        $bodyContainsOk = $normalizedBody.Contains('{"ok":true}') -or $normalizedBody.Contains('"ok":true')

        return [pscustomobject]@{
            Label          = $Label
            Url            = $Url
            StatusCode     = [int]$response.StatusCode
            Milliseconds   = [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
            Body           = $rawBody
            BodyContainsOk = $bodyContainsOk
            ParsedOk       = $okJson
            Passed         = ($response.StatusCode -eq 200 -and ($bodyContainsOk -or $okJson))
            Error          = ""
        }
    }
    catch {
        $stopwatch.Stop()
        return [pscustomobject]@{
            Label          = $Label
            Url            = $Url
            StatusCode     = 0
            Milliseconds   = [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
            Body           = ""
            BodyContainsOk = $false
            ParsedOk       = $false
            Passed         = $false
            Error          = $_.Exception.Message
        }
    }
}

New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null

$apiHealth = Test-HealthEndpoint -Url $ApiHealthUrl -Label "API custom domain"
if (-not $apiHealth.Passed) {
    Add-Failure ("Health check failed for {0}. Status={1}. Error={2}" -f $apiHealth.Url, $apiHealth.StatusCode, $apiHealth.Error)
}

$workersDevHealth = $null
if (-not $SkipWorkersDev) {
    $workersDevHealth = Test-HealthEndpoint -Url $WorkersDevHealthUrl -Label "workers.dev fallback"
    if (-not $workersDevHealth.Passed) {
        Add-Failure ("Health check failed for {0}. Status={1}. Error={2}" -f $workersDevHealth.Url, $workersDevHealth.StatusCode, $workersDevHealth.Error)
    }
}

$reportLines = @()
$reportLines += "# Worker Health Report"
$reportLines += ""
$reportLines += "- Generated at UTC: $(Get-Date -AsUTC -Format "yyyy-MM-dd HH:mm:ss")"
$reportLines += "- API health URL: <$ApiHealthUrl>"
$reportLines += "- workers.dev health URL: <$WorkersDevHealthUrl>"
$reportLines += ""
$reportLines += "## Results"
$reportLines += ""
$reportLines += "| Target | Status | Time ms | Body ok | Parsed ok | Result |"
$reportLines += "|---|---:|---:|---:|---:|---|"
$reportLines += ("| {0} | {1} | {2} | {3} | {4} | {5} |" -f $apiHealth.Label, $apiHealth.StatusCode, $apiHealth.Milliseconds, $apiHealth.BodyContainsOk, $apiHealth.ParsedOk, ($(if ($apiHealth.Passed) { "PASS" } else { "FAIL" })))
if ($workersDevHealth) {
    $reportLines += ("| {0} | {1} | {2} | {3} | {4} | {5} |" -f $workersDevHealth.Label, $workersDevHealth.StatusCode, $workersDevHealth.Milliseconds, $workersDevHealth.BodyContainsOk, $workersDevHealth.ParsedOk, ($(if ($workersDevHealth.Passed) { "PASS" } else { "FAIL" })))
}
$reportLines += ""
$reportLines += "## Failures"
$reportLines += ""
if ($failures.Count -gt 0) {
    $reportLines += ($failures | ForEach-Object { "- $_" })
}
else {
    $reportLines += "- none"
}

Set-Content -Path $reportPath -Value ($reportLines -join [Environment]::NewLine) -Encoding UTF8
Write-Host "Report written to $reportPath"

if ($failures.Count -gt 0) {
    exit 1
}

exit 0
