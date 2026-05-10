# Starts ngrok with a STATIC domain — URL never changes between restarts
# Get your free static domain at: https://dashboard.ngrok.com/domains

# ─── SET YOUR STATIC DOMAIN HERE ───────────────────────────────────────────────
$staticDomain = "overcaptious-noelle-malarian.ngrok-free.dev"
$port = 8000
# ────────────────────────────────────────────────────────────────────────────────

Write-Host "Starting ngrok tunnel..." -ForegroundColor Cyan
Write-Host "Public URL: https://$staticDomain" -ForegroundColor Green
Write-Host "Make sure Docker container (voiceforge-api) is running on port $port" -ForegroundColor Yellow

if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    ngrok http $port --domain=$staticDomain
} else {
    Write-Host "`nERROR: ngrok not found. Install via: winget install ngrok.ngrok" -ForegroundColor Red
}
