$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot

Set-Location $ProjectRoot

try {
    $Host.UI.RawUI.WindowTitle =
        "MOMENTDEV - TABLEAU TESTEURS"
}
catch {
}

Write-Host ""
Write-Host "=== MOMENTDEV - TABLEAU TESTEURS ===" -ForegroundColor Cyan
Write-Host ""

& node.exe "server/tools/watch-alpha-credits.js"
