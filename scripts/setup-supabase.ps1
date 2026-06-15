# ช่วยตั้งค่า Supabase — เปิดลิงก์ที่ต้องทำ + คัดลอก SQL
$ProjectRef = "fdbudhutavcpsouszwrp"
$Base = "https://supabase.com/dashboard/project/$ProjectRef"
$SiteUrl = "https://kornpapat-j.github.io/Bucket-Dashboard/"

Write-Host "`n=== Bucket Dashboard — Supabase Setup ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectRef`n"

$sqlPath = Join-Path $PSScriptRoot "..\docs\supabase\schema.sql"
$sql = Get-Content $sqlPath -Raw
Set-Clipboard -Value $sql
Write-Host "[1] คัดลอก schema.sql ไป Clipboard แล้ว" -ForegroundColor Green
Write-Host "    -> เปิด SQL Editor แล้ววาง (Ctrl+V) กด Run`n"

$links = @(
    @{ n = "SQL Editor"; u = "$Base/sql/new" },
    @{ n = "API Keys"; u = "$Base/settings/api" },
    @{ n = "Auth Users"; u = "$Base/auth/users" },
    @{ n = "Auth URL Config"; u = "$Base/auth/url-configuration" },
    @{ n = "Email Provider"; u = "$Base/auth/providers?provider=Email" }
)

$i = 2
foreach ($link in $links) {
    Write-Host "[$i] $($link.n): $($link.u)"
    $i++
}

Write-Host "`nSite URL ที่ต้องใส่ใน Auth URL Config:" -ForegroundColor Yellow
Write-Host "  $SiteUrl"
Write-Host "  ${SiteUrl}**`n"

Write-Host "สร้าง User ตัวอย่าง:" -ForegroundColor Yellow
Write-Host "  Email: admin@bucket.ith"
Write-Host "  Password: (ตั้งเอง) — ติ๊ก Auto Confirm User`n"

$open = Read-Host "เปิด SQL Editor ในเบราว์เซอร์เลยไหม? (y/n)"
if ($open -eq 'y') { Start-Process "$Base/sql/new" }

Write-Host "`nหลังได้ anon key แล้ว แก้ docs/js/supabase-config.js:" -ForegroundColor Cyan
Write-Host @"
  enabled: true,
  url: 'https://$ProjectRef.supabase.co',
  anonKey: '...'
"@
