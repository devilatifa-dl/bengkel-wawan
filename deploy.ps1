# Deploy Bengkel ke Cloudflare Pages
# Pakai: .\deploy.ps1
$ErrorActionPreference = "Stop"
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$root\frontend"

Write-Host "==> Build frontend..." -ForegroundColor Cyan
$env:CI = "false"
$env:GENERATE_SOURCEMAP = "false"
$env:REACT_APP_BACKEND_URL = "https://backend-phi-ashen-16.vercel.app"
yarn build
if ($LASTEXITCODE -ne 0) { throw "Build gagal" }

Write-Host "==> Deploy ke Cloudflare Pages..." -ForegroundColor Cyan
npx --yes wrangler pages deploy build --project-name bengkel-wawan --branch main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw "Deploy gagal" }

Write-Host ""
Write-Host "SELESAI: https://bengkel-wawan.pages.dev" -ForegroundColor Green
