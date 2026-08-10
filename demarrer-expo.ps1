$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot
$ReadyFile = Join-Path $env:TEMP "moment-original-cloudflare-ready.json"
$ServerFile = Join-Path $ProjectRoot "config\server.ts"

function Write-Tagged {
    param(
        [string]$Tag,
        [string]$Message,
        [ConsoleColor]$Color
    )

    Write-Host $Tag -NoNewline -ForegroundColor $Color
    Write-Host " $Message" -ForegroundColor White
}

function Log-OK {
    param([string]$Message)
    Write-Tagged "[OK]" $Message Green
}

function Log-KO {
    param([string]$Message)
    Write-Tagged "[KO]" $Message Red
}

function Log-INFO {
    param([string]$Message)
    Write-Host "[INFO] " -NoNewline -ForegroundColor Gray
    Write-Host $Message -ForegroundColor White
}

function Get-ConfiguredServerUrl {
    $bytes = [IO.File]::ReadAllBytes(
        $ServerFile
    )

    $latin1 = [Text.Encoding]::GetEncoding(
        28591
    )

    $text = $latin1.GetString(
        $bytes
    )

    $match = [regex]::Match(
        $text,
        'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
    )

    if (
        $match.Success
    ) {
        return $match.Value
    }

    return $null
}

try {
    Set-Location $ProjectRoot

    $startedAt = (Get-Date).ToUniversalTime()
    $deadline = (Get-Date).AddSeconds(150)
    $ready = $false
    $readyUrl = $null

    Log-INFO "Attente du tunnel Cloudflare et de la mise a jour SERVER_URL..."

    while (
        -not $ready -and
        (Get-Date) -lt $deadline
    ) {
        if (
            Test-Path -LiteralPath $ReadyFile
        ) {
            try {
                $markerText = [IO.File]::ReadAllText(
                    $ReadyFile
                )

                $marker = $markerText |
                    ConvertFrom-Json

                $markerTime = [DateTime]::Parse(
                    [string]$marker.created_at
                ).ToUniversalTime()

                $configuredUrl = Get-ConfiguredServerUrl

                if (
                    $configuredUrl -eq [string]$marker.url
                ) {
                    $ready = $true
                    $readyUrl = [string]$marker.url
                    break
                }
            }
            catch {
            }
        }

        Start-Sleep -Milliseconds 500
    }

    if (
        -not $ready
    ) {
        throw "Cloudflare n'est pas pret apres 150 secondes. Expo n'est pas lance pour eviter une ancienne SERVER_URL."
    }

    Log-OK "SERVER_URL synchronisee : $readyUrl"
    Log-INFO "Demarrage Expo avec cache Metro nettoye"

    & npx.cmd expo start --tunnel --clear
}
catch {
    Log-KO $_.Exception.Message
    Write-Host ""
    Write-Host "EXPO MOMENT NON DEMARRE" -ForegroundColor Red
}
