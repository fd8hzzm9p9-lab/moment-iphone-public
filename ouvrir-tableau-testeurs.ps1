$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot
$TableScript = Join-Path $ProjectRoot "tableau-testeurs-externe.ps1"

if (
    -not (
        Test-Path -LiteralPath $TableScript
    )
) {
    throw "tableau-testeurs-externe.ps1 introuvable."
}

$quotedScript =
    '"' +
    $TableScript +
    '"'

$arguments = @(
    "-NoProfile",
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $quotedScript
)

Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList $arguments `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Normal

Write-Host "[OK] Tableau testeurs ouvert dans une fenetre PowerShell separee."
