[CmdletBinding()]
param(
    [string]$OutputDirectory = '',
    [string]$ZipPath = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$packageName = 'GUI_NHAN_VIEN_CAI_LAN_DAU'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $root $packageName
}
if ([string]::IsNullOrWhiteSpace($ZipPath)) {
    $ZipPath = Join-Path $root 'CongCuBinh_CaiLanDau.zip'
}

$panelSource = Join-Path $root 'DanCardCEP'
$updaterSource = Join-Path $root 'updater'
$installerTemplate = Join-Path $PSScriptRoot 'PACKAGEPS_NhanVien.ps1'
$manifestPath = Join-Path $panelSource 'CSXS\manifest.xml'
$requiredUpdaterFiles = @(
    'DanCardUpdater.ps1',
    'SetupShortcuts.ps1',
    'ApplyUpdaterPayload.ps1',
    'CongCuBinh.ico',
    'update-config.json'
) | ForEach-Object { Join-Path $updaterSource $_ }
$requiredPaths = @($panelSource, $updaterSource, $installerTemplate, $manifestPath) + $requiredUpdaterFiles
foreach ($path in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Thieu file dong goi: $path" }
}

[xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8
$version = [string]$manifest.ExtensionManifest.ExtensionBundleVersion
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Version panel khong hop le: $version" }

$stageParent = Join-Path $env:TEMP ('CongCuBinhInstaller-' + [Guid]::NewGuid().ToString('N'))
$stagePackage = Join-Path $stageParent $packageName
$backupDirectory = ''
$utf8Bom = New-Object System.Text.UTF8Encoding($true)

try {
    New-Item -ItemType Directory -Path $stagePackage -Force | Out-Null
    $systemDir = Join-Path $stagePackage '_HE_THONG_KHONG_XOA'
    New-Item -ItemType Directory -Path $systemDir -Force | Out-Null

    Copy-Item -LiteralPath $panelSource -Destination (Join-Path $stagePackage 'DanCardCEP') -Recurse -Force
    Copy-Item -LiteralPath $updaterSource -Destination (Join-Path $systemDir 'updater') -Recurse -Force
    Copy-Item -LiteralPath $installerTemplate -Destination (Join-Path $systemDir 'PACKAGEPS.ps1') -Force

    # Nhat ky ky thuat chi dung cho may quan ly, khong can gui cho nhan vien.
    $history = Join-Path $stagePackage 'DanCardCEP\LICH_SU_CAP_NHAT.md'
    if (Test-Path -LiteralPath $history) { Remove-Item -LiteralPath $history -Force }

    $installBat = @(
        '@echo off'
        'chcp 65001 >nul'
        'title Cai dat Cong cu binh'
        'echo.'
        'echo Dang bat PlayerDebugMode cho Illustrator...'
        'reg add "HKCU\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1'
        'reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1'
        'reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1'
        'reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1'
        'echo Dang cai Cong cu binh...'
        'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0_HE_THONG_KHONG_XOA\PACKAGEPS.ps1"'
        'if errorlevel 1 pause'
    ) -join [Environment]::NewLine
    [System.IO.File]::WriteAllText((Join-Path $stagePackage 'CAI_DAT_CONG_CU_BINH.bat'), $installBat + [Environment]::NewLine, [System.Text.Encoding]::ASCII)

    $guide = @"
CONG CU BINH - CAI LAN DAU (v$version)

1. Giai nen TOAN BO file ZIP ra mot thu muc.
2. Dong han Illustrator.
3. Bam dup CAI_DAT_CONG_CU_BINH.bat.
4. Doi cua so bao cai dat xong, roi mo Illustrator:
   Window > Extensions > Cong cu binh

Tu lan sau:
- Tool tu kiem tra cap nhat khi dang nhap Windows.
- Muon cap nhat ngay: dong Illustrator, vao Start Menu > CongCuBinh >
  Cap nhat Cong cu binh.

Chi giu nguyen cau truc thu muc trong luc cai dat.
Sau khi cai xong, co the xoa file ZIP va thu muc da giai nen.
"@
    [System.IO.File]::WriteAllText((Join-Path $stagePackage 'HUONG_DAN_CAI_LAN_DAU.txt'), $guide.Trim() + [Environment]::NewLine, $utf8Bom)

    if (Test-Path -LiteralPath $OutputDirectory) {
        $backupDirectory = "$OutputDirectory.backup-$([DateTime]::Now.ToString('yyyyMMddHHmmss'))"
        Move-Item -LiteralPath $OutputDirectory -Destination $backupDirectory -Force
    }
    try {
        Move-Item -LiteralPath $stagePackage -Destination $OutputDirectory -Force
        if ($backupDirectory -and (Test-Path -LiteralPath $backupDirectory)) {
            Remove-Item -LiteralPath $backupDirectory -Recurse -Force
        }
    } catch {
        if (Test-Path -LiteralPath $OutputDirectory) {
            Remove-Item -LiteralPath $OutputDirectory -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($backupDirectory -and (Test-Path -LiteralPath $backupDirectory)) {
            Move-Item -LiteralPath $backupDirectory -Destination $OutputDirectory -Force
        }
        throw
    }

    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
    Compress-Archive -LiteralPath $OutputDirectory -DestinationPath $ZipPath -CompressionLevel Optimal

    Write-Host "Da dong goi ban cai nhan vien v$version" -ForegroundColor Green
    Write-Host "Thu muc gui: $OutputDirectory" -ForegroundColor Cyan
    Write-Host "File ZIP gui: $ZipPath" -ForegroundColor Cyan
} finally {
    Remove-Item -LiteralPath $stageParent -Recurse -Force -ErrorAction SilentlyContinue
}
