[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^/\s]+/[^/\s]+$')]
    [string]$GitHubRepository,

    [ValidateRange(1, 168)]
    [int]$CheckIntervalHours = 6
)

$ErrorActionPreference = 'Stop'
$url = "https://github.com/$GitHubRepository/releases/latest/download/latest.json"
$config = [ordered]@{
    product = 'com.locdev.dancard'
    manifestUrl = $url
    checkIntervalHours = $CheckIntervalHours
}
$paths = @(
    (Join-Path $PSScriptRoot 'updater\update-config.json'),
    (Join-Path $env:LOCALAPPDATA 'CongCuBinhUpdater\update-config.json')
)
foreach ($path in $paths) {
    $parent = Split-Path -Parent $path
    if (-not (Test-Path $parent)) { continue }
    $config | ConvertTo-Json | Set-Content -LiteralPath $path -Encoding UTF8
    Write-Host "Đã cấu hình: $path" -ForegroundColor Green
}
Write-Host "Kênh update: $url" -ForegroundColor Cyan
Write-Host "Chạy install.bat một lần trên từng máy để bật tác vụ tự cập nhật." -ForegroundColor Yellow
