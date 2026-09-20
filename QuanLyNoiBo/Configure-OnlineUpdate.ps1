[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^/\s]+/[^/\s]+$')]
    [string]$GitHubRepository,

    [ValidateRange(1, 168)]
    [int]$CheckIntervalHours = 6
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url = "https://api.github.com/repos/$GitHubRepository/contents/online/latest.json?ref=main"
$config = [ordered]@{
    product = 'com.locdev.dancard'
    manifestUrl = $url
    checkIntervalHours = $CheckIntervalHours
}
$paths = @(
    (Join-Path $root 'updater\update-config.json'),
    (Join-Path $env:LOCALAPPDATA 'CongCuBinhUpdater\update-config.json')
)
foreach ($path in $paths) {
    $parent = Split-Path -Parent $path
    if (-not (Test-Path $parent)) { continue }
    $config | ConvertTo-Json | Set-Content -LiteralPath $path -Encoding UTF8
    Write-Host "Đã cấu hình: $path" -ForegroundColor Green
}
Write-Host "Kênh update: $url" -ForegroundColor Cyan
Write-Host "Chạy CAI_DAT_CONG_CU_BINH.bat một lần trên từng máy để bật tự cập nhật." -ForegroundColor Yellow
Write-Host "Sau khi đổi kênh, chạy .\DongGoiNhanVien.ps1 để tạo lại bộ cài nhân viên." -ForegroundColor Yellow
