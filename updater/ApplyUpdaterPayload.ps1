[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [int]$ParentProcessId,
    [Parameter(Mandatory = $true)]
    [string]$StageRoot,
    [string]$UpdaterHome = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
$deadline = [DateTime]::UtcNow.AddSeconds(45)
while ((Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
}

try {
    foreach ($name in @('DanCardUpdater.ps1', 'SetupShortcuts.ps1', 'ApplyUpdaterPayload.ps1', 'CongCuBinh.ico')) {
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
} finally {
    Remove-Item -LiteralPath $StageRoot -Recurse -Force -ErrorAction SilentlyContinue
}
