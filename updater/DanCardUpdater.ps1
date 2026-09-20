[CmdletBinding()]
param(
    [switch]$Quiet,
    [switch]$Force,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$product = 'com.locdev.dancard'
$configPath = Join-Path $PSScriptRoot 'update-config.json'
$statePath = Join-Path $PSScriptRoot 'update-state.json'
$installRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions\DanCardCEP'

function Write-UpdateLog {
    param([string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Gray)
    if (-not $Quiet) { Write-Host "[Công cụ bình] $Message" -ForegroundColor $Color }
}

# Chỉ một updater được phép đổi folder extension tại một thời điểm. File lock
# tự được Windows nhả khi tiến trình kết thúc, kể cả khi updater lỗi giữa chừng.
$lockPath = Join-Path $PSScriptRoot 'update.lock'
try {
    $updaterLock = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch [System.IO.IOException] {
    Write-UpdateLog 'Đang có một tiến trình cập nhật khác; bỏ qua lần này.' DarkYellow
    exit 0
}

function Read-JsonFile {
    param([string]$Path, [object]$Default)
    if (-not (Test-Path -LiteralPath $Path)) { return $Default }
    try {
        $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
        if ([string]::IsNullOrWhiteSpace($raw)) { return $Default }
        return $raw | ConvertFrom-Json
    } catch {
        return $Default
    }
}

function Write-JsonFile {
    param([string]$Path, [object]$Value)
    $temp = "$Path.new"
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temp -Encoding UTF8
    Move-Item -LiteralPath $temp -Destination $Path -Force
}

function ConvertTo-Version {
    param([object]$Value)
    $text = [string]$Value
    if ($text.StartsWith('v')) { $text = $text.Substring(1) }
    if ($text -notmatch '^\d+\.\d+\.\d+(?:\.\d+)?$') {
        throw "Phiên bản không hợp lệ: $Value"
    }
    return [Version]$text
}

function Get-InstalledVersion {
    $manifestPath = Join-Path $installRoot 'CSXS\manifest.xml'
    if (-not (Test-Path -LiteralPath $manifestPath)) { return [Version]'0.0.0' }
    [xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8
    if ($manifest.ExtensionManifest.ExtensionBundleId -ne $product) {
        throw 'Panel đang cài không đúng mã sản phẩm.'
    }
    return ConvertTo-Version $manifest.ExtensionManifest.ExtensionBundleVersion
}

function Test-HttpsUrl {
    param([object]$Value, [string]$Label)
    $uri = $null
    if (-not [Uri]::TryCreate([string]$Value, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https') {
        throw "$Label phải là URL HTTPS."
    }
    return $uri.AbsoluteUri
}

function Test-IllustratorClosed {
    return -not (Get-Process -Name Illustrator -ErrorAction SilentlyContinue)
}

function Get-PackageRoot {
    param([string]$ExtractRoot)
    $direct = Join-Path $ExtractRoot 'DanCardCEP'
    if (Test-Path -LiteralPath (Join-Path $direct 'CSXS\manifest.xml')) { return $direct }
    $matches = Get-ChildItem -LiteralPath $ExtractRoot -Recurse -File -Filter manifest.xml |
        Where-Object { $_.FullName -match '[\\/]DanCardCEP[\\/]CSXS[\\/]manifest\.xml$' }
    if ($matches.Count -ne 1) { throw 'ZIP cập nhật không có đúng một thư mục DanCardCEP hợp lệ.' }
    return Split-Path -Parent (Split-Path -Parent $matches[0].FullName)
}

$config = Read-JsonFile -Path $configPath -Default $null
if ($null -eq $config) { throw "Thiếu file cấu hình: $configPath" }
if ([string]$config.product -ne $product) { throw 'File cấu hình updater không đúng sản phẩm.' }
if ([string]::IsNullOrWhiteSpace([string]$config.manifestUrl)) {
    Write-UpdateLog 'Chưa cấu hình manifestUrl online; bỏ qua kiểm tra.' DarkYellow
    exit 0
}

$intervalHours = 6
try { $intervalHours = [Math]::Max(1, [int]$config.checkIntervalHours) } catch {}
$state = Read-JsonFile -Path $statePath -Default ([pscustomobject]@{})
if (-not $Force -and $state.lastCheckUtc) {
    try {
        $lastCheck = [DateTime]::Parse([string]$state.lastCheckUtc).ToUniversalTime()
        if ((([DateTime]::UtcNow - $lastCheck).TotalHours -lt $intervalHours) -and -not $state.pendingVersion) {
            exit 0
        }
    } catch {}
}

try {
    $manifestUrl = Test-HttpsUrl -Value $config.manifestUrl -Label 'manifestUrl'
    Write-UpdateLog 'Đang kiểm tra bản cập nhật online…'
    # GitHub Raw returns latest.json as text/plain.  Parse it explicitly and
    # remove an optional UTF-8 BOM so Windows PowerShell 5 can read it too.
    $manifestResponse = Invoke-WebRequest -Uri $manifestUrl -UseBasicParsing -TimeoutSec 20
    $manifestText = ([string]$manifestResponse.Content).TrimStart([char]0xFEFF)
    $remote = $manifestText | ConvertFrom-Json
    if ([string]$remote.product -ne $product) { throw 'Manifest online không đúng sản phẩm.' }
    $remoteVersion = ConvertTo-Version $remote.version
    $packageUrl = Test-HttpsUrl -Value $remote.packageUrl -Label 'packageUrl'
    $expectedHash = ([string]$remote.sha256).ToUpperInvariant()
    if ($expectedHash -notmatch '^[0-9A-F]{64}$') { throw 'Manifest online thiếu SHA-256 hợp lệ.' }
    $installedVersion = Get-InstalledVersion

    $state | Add-Member -NotePropertyName lastCheckUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
    $state | Add-Member -NotePropertyName lastSeenVersion -NotePropertyValue $remoteVersion.ToString() -Force
    Write-JsonFile -Path $statePath -Value $state

    if ($remoteVersion -le $installedVersion) {
        $state | Add-Member -NotePropertyName pendingVersion -NotePropertyValue $null -Force
        Write-JsonFile -Path $statePath -Value $state
        Write-UpdateLog "Đã là bản mới nhất ($installedVersion)." DarkGreen
        exit 0
    }
    if ($CheckOnly) {
        Write-UpdateLog "Có bản mới $remoteVersion (đang dùng $installedVersion)." Yellow
        exit 2
    }
    if (-not (Test-IllustratorClosed)) {
        $state | Add-Member -NotePropertyName pendingVersion -NotePropertyValue $remoteVersion.ToString() -Force
        Write-JsonFile -Path $statePath -Value $state
        Write-UpdateLog "Có bản $remoteVersion nhưng Illustrator đang mở; sẽ cập nhật ở lần kiểm tra sau." Yellow
        exit 0
    }

    $workRoot = Join-Path $env:TEMP ('CongCuBinhUpdate-' + [Guid]::NewGuid().ToString('N'))
    $zipPath = Join-Path $workRoot 'package.zip'
    $extractRoot = Join-Path $workRoot 'extract'
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
    try {
        Write-UpdateLog "Đang tải bản $remoteVersion…"
        Invoke-WebRequest -Uri $packageUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 120
        $actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
        if ($actualHash -ne $expectedHash) { throw 'SHA-256 của gói tải về không khớp manifest.' }
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force
        $packageRoot = Get-PackageRoot -ExtractRoot $extractRoot
        [xml]$packageManifest = Get-Content -LiteralPath (Join-Path $packageRoot 'CSXS\manifest.xml') -Raw -Encoding UTF8
        if ($packageManifest.ExtensionManifest.ExtensionBundleId -ne $product) { throw 'Gói ZIP không đúng sản phẩm.' }
        $packageVersion = ConvertTo-Version $packageManifest.ExtensionManifest.ExtensionBundleVersion
        if ($packageVersion -ne $remoteVersion) { throw 'Version trong ZIP không khớp manifest online.' }
        if (-not (Test-IllustratorClosed)) { throw 'Illustrator vừa được mở; chưa thay file.' }

        $backup = "$installRoot.backup-$($installedVersion)-$([DateTime]::Now.ToString('yyyyMMddHHmmss'))"
        if (Test-Path -LiteralPath $installRoot) {
            Move-Item -LiteralPath $installRoot -Destination $backup -Force
        }
        try {
            Copy-Item -LiteralPath $packageRoot -Destination $installRoot -Recurse -Force
            if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'CSXS\manifest.xml'))) {
                throw 'Chép gói mới không hoàn tất.'
            }
        } catch {
            if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
            if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $installRoot -Force }
            throw
        }
        Get-ChildItem -LiteralPath (Split-Path -Parent $installRoot) -Directory -Filter 'DanCardCEP.backup-*' |
            Sort-Object LastWriteTime -Descending | Select-Object -Skip 1 |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        $state | Add-Member -NotePropertyName pendingVersion -NotePropertyValue $null -Force
        $state | Add-Member -NotePropertyName installedVersion -NotePropertyValue $remoteVersion.ToString() -Force
        Write-JsonFile -Path $statePath -Value $state
        Write-UpdateLog "Đã cập nhật $installedVersion → $remoteVersion. Mở lại Illustrator để dùng bản mới." Green
    } finally {
        Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
} catch {
    $message = $_.Exception.Message
    try {
        $state | Add-Member -NotePropertyName lastError -NotePropertyValue $message -Force
        Write-JsonFile -Path $statePath -Value $state
    } catch {}
    Write-UpdateLog "Không cập nhật được: $message" Red
    if (-not $Quiet) { exit 1 }
}
