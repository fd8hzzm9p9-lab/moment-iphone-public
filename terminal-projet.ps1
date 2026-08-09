param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("server", "cloudflare", "expo")]
    [string]$Role
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot
$Esc = [char]27
$ProjectAnsi = "32"
$ProjectColor = "Green"
$ProjectName = "MOMENTDEV"

Set-Location $ProjectRoot

# Couleur par defaut du terminal du projet.
[Console]::Write("$Esc[$($ProjectAnsi)m")

try {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor $ProjectColor
    Write-Host " $ProjectName - $($Role.ToUpperInvariant())" -ForegroundColor $ProjectColor
    Write-Host "============================================================" -ForegroundColor $ProjectColor
    Write-Host ""

    switch ($Role) {
        "server" {
        $env:PORT = "3001"
        & node.exe "server/server.js"
        }

        "cloudflare" {
            & powershell.exe `
                -ExecutionPolicy Bypass `
                -File (
                    Join-Path `
                        $ProjectRoot `
                        "demarrer-tunnel.ps1"
                )
        }

        "expo" {
            & powershell.exe `
                -ExecutionPolicy Bypass `
                -File (
                    Join-Path `
                        $ProjectRoot `
                        "demarrer-expo.ps1"
                )
        }
    }
}
finally {
    [Console]::Write("$Esc[0m")
}
