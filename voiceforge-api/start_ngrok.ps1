# Starts ngrok and exposes the local VoiceForge API to a public URL
# This is useful for testing with frontend apps or webhooks before deployment

$port = 8000
Write-Host "Starting ngrok on port $port..." -ForegroundColor Cyan
Write-Host "Make sure your FastAPI server or Docker container is running on port $port" -ForegroundColor Yellow

# Check if ngrok is installed
if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    ngrok http $port
} else {
    Write-Host "`nERROR: ngrok is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install it from https://ngrok.com/download or via winget:"
    Write-Host "  winget install ngrok.ngrok"
}
