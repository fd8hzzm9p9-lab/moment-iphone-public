$ErrorActionPreference = "Stop"

$Projet = "C:\Users\jerry\moment-iphone"
$ServerFile = "$Projet\config\server.ts"

Write-Host ""
Write-Host "=== CLOUDFLARE TUNNEL ===" -ForegroundColor Cyan
Write-Host ""

Set-Location $Projet

# Lance Cloudflare et récupère sa sortie
$process = New-Object System.Diagnostics.Process
$process.StartInfo.FileName = "cloudflared"
$process.StartInfo.Arguments = "tunnel --url http://192.168.1.12:3000"
$process.StartInfo.WorkingDirectory = $Projet
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true
$process.StartInfo.CreateNoWindow = $true

$process.Start() | Out-Null

$url = $null

while (-not $url) {
    $line = $process.StandardError.ReadLine()

    if ($line) {
        Write-Host $line

        if ($line -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
            $url = $matches[0]
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "URL CLOUDFLARE :" -ForegroundColor Green
Write-Host $url -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green

# Mise à jour automatique de config/server.ts
@"
/* ========================================================= */
/* CONFIGURATION SERVEUR CENTRALISÉE                         */
/* ========================================================= */
/*
 * Moment — pré-0.1.0
 *
 * URL Cloudflare générée automatiquement au démarrage.
 */

export const SERVER_URL =
  '$url';
"@ | Set-Content -Path $ServerFile -Encoding UTF8

Write-Host ""
Write-Host "✅ config/server.ts mis à jour automatiquement." -ForegroundColor Green
Write-Host ""

# Le tunnel reste actif
$process.WaitForExit()