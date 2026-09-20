[CmdletBinding()]
param(
    [string]$UpdaterHome = $PSScriptRoot,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$programsDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\CongCuBinh'
$cmdPath = Join-Path $programsDir 'Cap nhat Cong cu binh.cmd'
$shortcutPath = Join-Path $programsDir 'Cap nhat Cong cu binh.lnk'
$updaterScript = Join-Path $UpdaterHome 'DanCardUpdater.ps1'
$iconPath = Join-Path $UpdaterHome 'CongCuBinh.ico'

New-Item -ItemType Directory -Path $programsDir -Force | Out-Null
$cmdContent = @(
    '@echo off'
    'chcp 65001 >nul'
    'echo Dong Illustrator truoc khi cap nhat.'
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\CongCuBinhUpdater\DanCardUpdater.ps1" -Force'
    'echo.'
    'pause'
) -join [Environment]::NewLine
[System.IO.File]::WriteAllText($cmdPath, $cmdContent + [Environment]::NewLine, [System.Text.Encoding]::ASCII)

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $env:ComSpec
$shortcut.Arguments = '/c ""' + $cmdPath + '""'
$shortcut.WorkingDirectory = $UpdaterHome
$shortcut.Description = 'Kiem tra va cai ban moi cua Cong cu binh'
if (Test-Path -LiteralPath $iconPath) { $shortcut.IconLocation = "$iconPath,0" }
$shortcut.Save()

if (-not $Quiet) { Write-Host 'Da tao loi tat Start Menu: CongCuBinh > Cap nhat Cong cu binh.' -ForegroundColor Green }
