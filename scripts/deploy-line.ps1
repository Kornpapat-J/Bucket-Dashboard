# Deploy LINE + Supabase Edge Functions
# First run: npx supabase login
# Then run: .\scripts\deploy-line.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$envFile = Join-Path $PSScriptRoot ".env.line.local"
if (-not (Test-Path $envFile)) {
    Write-Host "Missing scripts/.env.line.local" -ForegroundColor Red
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
}

if (-not $env:LINE_CHANNEL_ACCESS_TOKEN -or -not $env:LINE_CHANNEL_SECRET) {
    Write-Host "Need LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET in .env.line.local" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Deploy Bucket Dashboard LINE Functions ===" -ForegroundColor Cyan

npx supabase link --project-ref fdbudhutavcpsouszwrp
npx supabase secrets set `
    "LINE_CHANNEL_ACCESS_TOKEN=$env:LINE_CHANNEL_ACCESS_TOKEN" `
    "LINE_CHANNEL_SECRET=$env:LINE_CHANNEL_SECRET" `
    "SITE_URL=https://kornpapat-j.github.io/Bucket-Dashboard" `
    "EMAIL_DOMAIN=@bucket.ith"

npx supabase functions deploy register-request --no-verify-jwt
npx supabase functions deploy process-approval --no-verify-jwt
npx supabase functions deploy line-webhook --no-verify-jwt

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Webhook URL for LINE Manager:" -ForegroundColor Yellow
Write-Host "https://fdbudhutavcpsouszwrp.supabase.co/functions/v1/line-webhook"
Write-Host "Supervisor: Add friend @893ntzwh then send: id" -ForegroundColor Yellow
