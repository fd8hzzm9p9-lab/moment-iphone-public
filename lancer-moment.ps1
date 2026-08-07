Set-Location "C:\Users\jerry\moment-iphone"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "        MOMENT - DEMARRAGE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Verification TypeScript..." -ForegroundColor Yellow
npx.cmd tsc --noEmit

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERREUR TypeScript - demarrage annule." -ForegroundColor Red
    Read-Host "Appuie sur Entree pour fermer"
    exit 1
}

Write-Host ""
Write-Host "TypeScript OK." -ForegroundColor Green
Write-Host ""
Write-Host "Demarrage de Moment..." -ForegroundColor Yellow
Write-Host ""

npx.cmd expo start