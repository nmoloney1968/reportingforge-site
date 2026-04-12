[CmdletBinding()]
param(
    [string]$Domain = "reportingforge.com",
    [string]$ApiDomain = "api.reportingforge.com",
    [string]$ApiHealthUrl = "https://api.reportingforge.com/health",
    [string]$WorkersDevHealthUrl = "https://rf-webhooks.nmoloney1968.workers.dev/health",
    [switch]$SkipWorkersDev
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# This script is intentionally read-only.
# It performs DNS and HTTP checks, writes a timestamped Markdown report,
# and exits nonzero if a required condition fails.

$expectedNameservers = @(
    "kia.ns.cloudflare.com",
    "roan.ns.cloudflare.com"
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$reportsDir = Join-Path $repoRoot "reports"
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$reportPath = Join-Path $reportsDir ("domain-health-{0}Z.md" -f $timestamp)

$failures = New-Object System.Collections.Generic.List[string]
$notes = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message)
}

function Add-Note {
    param([string]$Message)
    $notes.Add($Message)
}

function Normalize-Host {
    param([string]$Value)
    return ($Value.Trim().TrimEnd(".").ToLowerInvariant())
}

function Get-ExactNameservers {
    param([string]$Name)

    try {
        $records = Resolve-DnsName -Name $Name -Type NS -DnsOnly -ErrorAction Stop |
            Where-Object { $_.Type -eq "NS" } |
            ForEach-Object { Normalize-Host $_.NameHost }
        if ($records) {
            return $records | Sort-Object -Unique
        }
    }
    catch {
        Add-Note "Resolve-DnsName NS lookup failed for $Name. Falling back to nslookup."
    }

    $nslookupOutput = & nslookup -type=NS $Name 2>$null
    $records = @()
    foreach ($line in $nslookupOutput) {
        if ($line -match "nameserver\s*=\s*(.+)$") {
            $records += Normalize-Host $matches[1]
        }
    }
    return $records | Sort-Object -Unique
}

function Resolve-HostSummary {
    param([string]$Name)

    try {
        $records = Resolve-DnsName -Name $Name -Type A -DnsOnly -ErrorAction SilentlyContinue
        $records += Resolve-DnsName -Name $Name -Type AAAA -DnsOnly -ErrorAction SilentlyContinue
        $records += Resolve-DnsName -Name $Name -Type CNAME -DnsOnly -ErrorAction SilentlyContinue

        $values = foreach ($record in $records) {
            if ($record.IPAddress) { $record.IPAddress }
            elseif ($record.NameHost) { Normalize-Host $record.NameHost }
        }

        if ($values) {
            return $values | Sort-Object -Unique
        }
    }
    catch {
        Add-Note "Resolve-DnsName resolution failed for $Name. Falling back to nslookup."
    }

    $nslookupOutput = & nslookup $Name 2>$null
    $values = @()
    foreach ($line in $nslookupOutput) {
        if ($line -match "Address:\s+(.+)$") {
            $candidate = $matches[1].Trim()
            if ($candidate -ne "127.0.0.1") {
                $values += $candidate
            }
        }
        elseif ($line -match "canonical name = (.+)$") {
            $values += Normalize-Host $matches[1]
        }
    }
    return $values | Sort-Object -Unique
}

function Test-HealthEndpoint {
    param(
        [string]$Url,
        [string]$Label
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 20 -ErrorAction Stop
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
            Body           = $rawBody
            BodyContainsOk = $bodyContainsOk
            ParsedOk       = $okJson
            Passed         = ($response.StatusCode -eq 200 -and ($bodyContainsOk -or $okJson))
        }
    }
    catch {
        return [pscustomobject]@{
            Label          = $Label
            Url            = $Url
            StatusCode     = 0
            Body           = ""
            BodyContainsOk = $false
            ParsedOk       = $false
            Passed         = $false
            Error          = $_.Exception.Message
        }
    }
}

New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null

$observedNameservers = Get-ExactNameservers -Name $Domain
$expectedSorted = $expectedNameservers | ForEach-Object { Normalize-Host $_ } | Sort-Object -Unique
$nsMatch = (@($observedNameservers) -join ",") -eq (@($expectedSorted) -join ",")
if (-not $nsMatch) {
    Add-Failure ("Nameserver mismatch for {0}. Expected: {1}. Observed: {2}." -f $Domain, ($expectedSorted -join ", "), (($observedNameservers | ForEach-Object { $_ }) -join ", "))
}

$apiResolution = Resolve-HostSummary -Name $ApiDomain
if (-not $apiResolution -or $apiResolution.Count -eq 0) {
    Add-Failure "Failed to resolve $ApiDomain."
}

$apiHealth = Test-HealthEndpoint -Url $ApiHealthUrl -Label "API custom domain"
if (-not $apiHealth.Passed) {
    Add-Failure ("Health check failed for {0}. Status={1}. Error={2}" -f $ApiHealth.Url, $apiHealth.StatusCode, $apiHealth.Error)
}

$workersDevHealth = $null
if (-not $SkipWorkersDev) {
    $workersDevHealth = Test-HealthEndpoint -Url $WorkersDevHealthUrl -Label "workers.dev fallback"
    if (-not $workersDevHealth.Passed) {
        Add-Failure ("Optional workers.dev health check failed for {0}. Status={1}. Error={2}" -f $workersDevHealth.Url, $workersDevHealth.StatusCode, $workersDevHealth.Error)
    }
}

$reportLines = @()
$reportLines += "# Domain Health Report"
$reportLines += ""
$reportLines += "- Generated at UTC: $(Get-Date -AsUTC -Format "yyyy-MM-dd HH:mm:ss")"
$reportLines += "- Domain: `$Domain"
$reportLines += "- API domain: `$ApiDomain"
$reportLines += "- API health URL: <$ApiHealthUrl>"
$reportLines += "- workers.dev health URL: <$WorkersDevHealthUrl>"
$reportLines += ""
$reportLines += "## Expected nameservers"
$reportLines += ""
$reportLines += ($expectedSorted | ForEach-Object { "- `$_`" })
$reportLines += ""
$reportLines += "## Observed nameservers"
$reportLines += ""
if ($observedNameservers.Count -gt 0) {
    $reportLines += ($observedNameservers | ForEach-Object { "- `$_`" })
}
else {
    $reportLines += "- none"
}
$reportLines += ""
$reportLines += "## API resolution"
$reportLines += ""
if ($apiResolution.Count -gt 0) {
    $reportLines += ($apiResolution | ForEach-Object { "- `$_`" })
}
else {
    $reportLines += "- resolution failed"
}
$reportLines += ""
$reportLines += "## Health checks"
$reportLines += ""
$reportLines += "| Target | Status | Body ok | Parsed ok | Result |"
$reportLines += "|---|---:|---:|---:|---|"
$reportLines += ("| {0} | {1} | {2} | {3} | {4} |" -f $apiHealth.Label, $apiHealth.StatusCode, $apiHealth.BodyContainsOk, $apiHealth.ParsedOk, ($(if ($apiHealth.Passed) { "PASS" } else { "FAIL" })))
if ($workersDevHealth) {
    $reportLines += ("| {0} | {1} | {2} | {3} | {4} |" -f $workersDevHealth.Label, $workersDevHealth.StatusCode, $workersDevHealth.BodyContainsOk, $workersDevHealth.ParsedOk, ($(if ($workersDevHealth.Passed) { "PASS" } else { "FAIL" })))
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
$reportLines += ""
$reportLines += "## Notes"
$reportLines += ""
if ($notes.Count -gt 0) {
    $reportLines += ($notes | ForEach-Object { "- $_" })
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
