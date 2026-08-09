$ErrorActionPreference = "Stop"

$Projet = $PSScriptRoot
$ServerFile = Join-Path $Projet "config\server.ts"

Set-Location $Projet

Write-Host ""
Write-Host "=== CLOUDFLARE TUNNEL MOMENT ===" -ForegroundColor Cyan
Write-Host ""

function Get-ConfiguredServerUrl {
    if (-not (Test-Path $ServerFile)) {
        return $null
    }

    $content = Get-Content $ServerFile -Raw

    if ($content -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
        return $matches[0]
    }

    return $null
}

function Test-MomentTunnel {
    param([string]$Url)

    if (-not $Url) {
        return $false
    }

    try {
        $response = Invoke-RestMethod -Uri "$Url/" -Method Get -TimeoutSec 5
        return ($response.message -eq "Le cerveau de Moment fonctionne !")
    }
    catch {
        return $false
    }
}

$currentUrl = Get-ConfiguredServerUrl

if ($currentUrl) {
    Write-Host "URL configurée : $currentUrl" -ForegroundColor Cyan
    Write-Host "Vérification..." -ForegroundColor Yellow

    if (Test-MomentTunnel $currentUrl) {
        Write-Host ""
        Write-Host "✅ TUNNEL EXISTANT TOUJOURS ACTIF" -ForegroundColor Green
        Write-Host "✅ URL CONSERVÉE : $currentUrl" -ForegroundColor Green
        Write-Host "✅ Aucun nouveau tunnel créé." -ForegroundColor Green
        Write-Host ""
        exit 0
    }
}

Write-Host "Ancien tunnel indisponible : création nécessaire." -ForegroundColor Yellow
Write-Host ""

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cloudflared"
$psi.Arguments = "tunnel --url http://localhost:3000"
$psi.WorkingDirectory = $Projet
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi
$process.Start() | Out-Null

$url = $null
$deadline = (Get-Date).AddSeconds(45)

while (-not $url -and (Get-Date) -lt $deadline) {
    if ($process.HasExited) {
        throw "Cloudflare s’est arrêté avant de fournir une URL."
    }

    $line = $process.StandardError.ReadLine()

    if ($line) {
        Write-Host $line

        if ($line -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
            $url = $matches[0]
        }
    }
}

if (-not $url) {
    try { $process.Kill() } catch {}
    throw "Aucune URL Cloudflare obtenue."
}

Write-Host ""
Write-Host "Nouvelle URL : $url" -ForegroundColor Cyan

$ready = $false

for ($i = 1; $i -le 15; $i++) {
    if (Test-MomentTunnel $url) {
        $ready = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $ready) {
    try { $process.Kill() } catch {}
    throw "Le nouveau tunnel ne répond pas."
}

$serverOriginal = Get-Content $ServerFile -Raw
$serverBackup = "$ServerFile.before-tunnel-update.bak"

try {
    Copy-Item $ServerFile $serverBackup -Force

    $serverNew = [regex]::Replace(
        $serverOriginal,
        "https://[a-zA-Z0-9-]+\.trycloudflare\.com",
        $url
    )

    if ($serverNew -eq $serverOriginal) {
        throw "Impossible de remplacer l’URL dans config/server.ts."
    }

    Set-Content -Path $ServerFile -Value $serverNew -Encoding UTF8

    $verification = Get-Content $ServerFile -Raw

    if (-not $verification.Contains($url)) {
        throw "Contrôle après écriture échoué."
    }
}
catch {
    Copy-Item $serverBackup $ServerFile -Force
    try { $process.Kill() } catch {}
    Write-Host "❌ ÉCHEC — server.ts restauré." -ForegroundColor Red
    throw
}

Write-Host ""
Write-Host "✅ NOUVEAU TUNNEL ACTIF" -ForegroundColor Green
Write-Host "✅ URL : $url" -ForegroundColor Green
Write-Host "✅ config/server.ts mis à jour automatiquement." -ForegroundColor Green
Write-Host ""

$process.WaitForExit()
