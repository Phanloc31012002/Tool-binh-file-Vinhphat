[CmdletBinding()]
param(
    [string]$MachinesFile = (Join-Path $PSScriptRoot 'staff-sync\staff-machines.json'),
    [pscredential]$Credential,
    [ValidateRange(30, 3600)]
    [int]$IntervalSeconds = 120,
    [ValidateRange(10, 300)]
    [int]$SettleSeconds = 30,
    [switch]$NoInitialPush
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'DanCardCEP'
$pushScript = Join-Path $PSScriptRoot 'Push-StaffUpdate.ps1'

function Get-SourceFingerprint {
    $builder = New-Object System.Text.StringBuilder
    $files = Get-ChildItem -LiteralPath $source -Recurse -File | Sort-Object FullName
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($source.Length + 1)
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        [void]$builder.Append($relative).Append('|').Append($hash).Append("`n")
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes($builder.ToString())
    return ([Security.Cryptography.SHA256]::Create().ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
}

function Push-CurrentSource {
    $summary = & $pushScript -MachinesFile $MachinesFile -Credential $Credential -Quiet
    if ($summary.Failed -gt 0) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Đẩy lỗi $($summary.Failed)/$($summary.Total) máy; sẽ thử lại." -ForegroundColor Red
        return $false
    }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Đã đồng bộ $($summary.Total) máy." -ForegroundColor Green
    return $true
}

if (-not (Test-Path -LiteralPath $pushScript)) { throw "Không tìm thấy $pushScript" }
Write-Host 'Đang theo dõi DanCardCEP. Nhấn Ctrl+C để dừng.' -ForegroundColor Cyan
$lastFingerprint = Get-SourceFingerprint
if (-not $NoInitialPush) { [void](Push-CurrentSource) }

while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    $nextFingerprint = Get-SourceFingerprint
    if ($nextFingerprint -eq $lastFingerprint) { continue }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Phát hiện thay đổi; đợi file ổn định…" -ForegroundColor Yellow
    Start-Sleep -Seconds $SettleSeconds
    $stableFingerprint = Get-SourceFingerprint
    if ($stableFingerprint -ne $nextFingerprint) { continue }
    if (Push-CurrentSource) { $lastFingerprint = $stableFingerprint }
}
