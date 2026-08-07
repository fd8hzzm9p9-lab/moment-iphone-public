$Projet = "C:\Users\jerry\moment-iphone"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Projet\server'; Write-Host '=== SERVEUR MOMENT ===' -ForegroundColor Cyan; node server.js"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Projet'; Write-Host '=== EXPO ===' -ForegroundColor Green; npx.cmd expo start --port 8081"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=== CLOUDFLARE TUNNEL ===' -ForegroundColor Yellow; cloudflared tunnel --url http://192.168.1.12:3000"