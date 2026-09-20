[CmdletBinding()]
param(
    [string]$MachinesFile = (Join-Path $PSScriptRoot 'staff-sync\staff-machines.json'),
    [ValidateRange(30, 3600)]
    [int]$IntervalSeconds = 120,
    [ValidateRange(10, 300)]
    [int]$SettleSeconds = 30
)

$ErrorActionPreference = 'Stop'
$syncScript = Join-Path $PSScriptRoot 'Start-StaffAutoSync.ps1'
$taskName = 'CongCuBinh-StaffAutoSync'
if (-not (Test-Path -LiteralPath $syncScript)) { throw "Không tìm thấy $syncScript" }
if (-not (Test-Path -LiteralPath $MachinesFile)) { throw "Không tìm thấy $MachinesFile" }

$argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$syncScript`" -MachinesFile `"$MachinesFile`" -IntervalSeconds $IntervalSeconds -SettleSeconds $SettleSeconds"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Tự đồng bộ Công cụ bình tới máy nhân viên' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'Đã bật đồng bộ tự động trên máy này.' -ForegroundColor Green
Write-Host 'Máy này sẽ theo dõi DanCardCEP sau mỗi lần đăng nhập và đẩy thay đổi tới danh sách nhân viên.' -ForegroundColor Cyan
