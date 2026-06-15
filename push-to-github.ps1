# Push Bucket Dashboard to GitHub (Kornpapat-J)
# รันสคริปต์นี้ใน PowerShell แล้ว login เป็น Kornpapat-J

Write-Host "=== Push Bucket Dashboard to GitHub ===" -ForegroundColor Cyan
Write-Host ""

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Host "1. Login GitHub (เลือก account: Kornpapat-J)" -ForegroundColor Yellow
git credential-manager github login

Write-Host ""
Write-Host "2. Push โค้ด..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "สำเร็จ! เปิด GitHub Pages:" -ForegroundColor Green
    Write-Host "https://github.com/Kornpapat-J/Bucket-Dashboard/settings/pages"
    Write-Host "เลือก Source: GitHub Actions หรือ Branch main /docs"
    Write-Host ""
    Write-Host "เว็บจะอยู่ที่: https://kornpapat-j.github.io/Bucket-Dashboard/"
} else {
    Write-Host ""
    Write-Host "Push ไม่สำเร็จ — ต้อง login เป็น Kornpapat-J หรือเพิ่ม Varaluk-M เป็น Collaborator" -ForegroundColor Red
}
