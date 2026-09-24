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
$installedManifestPath = Join-Path $installRoot 'CSXS\manifest.xml'

function Write-UpdateLog {
    param([string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Gray)
    if (-not $Quiet) { Write-Host "[Công cụ bình] $Message" -ForegroundColor $Color }
}

function Write-HiddenLauncher {
    param([string]$UpdaterScript)

    # Task Scheduler đôi khi vẫn chớp cửa sổ PowerShell, dù đã có
    # -WindowStyle Hidden. WScript chạy launcher này không tạo cửa sổ console.
    $launcherPath = Join-Path $PSScriptRoot 'CongCuBinh-AutoUpdate.vbs'
    $command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$UpdaterScript`" -Quiet"
    $vbsLine = 'CreateObject("Wscript.Shell").Run "' + $command.Replace('"', '""') + '", 0, False'
    [System.IO.File]::WriteAllText($launcherPath, $vbsLine + [Environment]::NewLine, [System.Text.Encoding]::ASCII)
    return $launcherPath
}

function Remove-LegacyAutoUpdateTask {
    # Bộ cài cũ tạo task này với PowerShell trực tiếp và một trigger lặp mỗi
    # phút. Giữ nó sẽ làm cửa sổ console chớp lên dù task mới đã chạy ẩn.
    try {
        & schtasks.exe /Delete /TN 'CongCuBinh-AutoUpdate' /F *> $null
    }
    catch {}
}

function Register-RecurringCheckTask {
    # Kiểm tra lại mỗi phút để máy đang mở Illustrator nhận thông báo bản mới
    # gần như ngay khi bản phát hành xuất hiện trên GitHub.
    $recurringTaskName = 'CongCuBinh-AutoUpdate-Recurring'
    $scheduleMarkerPath = Join-Path $PSScriptRoot 'recurring-schedule.txt'
    $scheduleMarker = 'wscript-minute-1'
    $taskExists = $false
    try {
        & schtasks.exe /Query /TN $recurringTaskName *> $null
        $taskExists = ($LASTEXITCODE -eq 0)
    }
    catch {}
    try {
        if ($taskExists -and (Test-Path -LiteralPath $scheduleMarkerPath) -and
            ((Get-Content -LiteralPath $scheduleMarkerPath -Raw -ErrorAction Stop).Trim() -eq $scheduleMarker)) {
            Remove-LegacyAutoUpdateTask
            return
        }
    }
    catch {}
    try {
        $selfPath = $PSCommandPath
        if ([string]::IsNullOrWhiteSpace($selfPath)) { $selfPath = Join-Path $PSScriptRoot 'DanCardUpdater.ps1' }
        $launcherPath = Write-HiddenLauncher -UpdaterScript $selfPath
        $taskCommand = "wscript.exe `"$launcherPath`""
        $taskOutput = & schtasks.exe /Create /TN $recurringTaskName /TR $taskCommand /SC MINUTE /MO 1 /F 2>&1
        if ($LASTEXITCODE -eq 0) {
            [System.IO.File]::WriteAllText($scheduleMarkerPath, $scheduleMarker, [System.Text.Encoding]::ASCII)
            Remove-LegacyAutoUpdateTask
            Write-UpdateLog 'Đã bật lịch kiểm tra bản mới mỗi phút.' DarkCyan
        }
    }
    catch {}
}

function Show-UpdateToast {
    # Hiện thông báo ở khay hệ thống / Notification Center Windows, kể cả khi
    # updater chạy ẩn (-Quiet) qua Scheduled Task lúc đăng nhập. Trên
    # Windows 10/11, balloon tip của NotifyIcon tự được gộp vào Action Center.
    param([string]$Title, [string]$Message)
    try {
        Add-Type -AssemblyName System.Windows.Forms | Out-Null
        Add-Type -AssemblyName System.Drawing | Out-Null
        $iconPath = Join-Path $PSScriptRoot 'CongCuBinh.ico'
        $notifyIcon = New-Object System.Windows.Forms.NotifyIcon
        if (Test-Path -LiteralPath $iconPath) {
            $notifyIcon.Icon = New-Object System.Drawing.Icon($iconPath)
        }
        else {
            $notifyIcon.Icon = [System.Drawing.SystemIcons]::Information
        }
        $notifyIcon.Visible = $true
        $notifyIcon.BalloonTipTitle = $Title
        $notifyIcon.BalloonTipText = $Message
        $notifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
        $notifyIcon.ShowBalloonTip(15000)
        # Giữ tiến trình lâu hơn thời lượng balloon; nếu Dispose sau 6 giây
        # Windows sẽ đóng thông báo sớm dù đã yêu cầu hiển thị 15 giây.
        Start-Sleep -Seconds 16
        $notifyIcon.Dispose()
    }
    catch {
        Write-UpdateLog "Không hiện được thông báo Windows: $($_.Exception.Message)" DarkYellow
    }
}

function Format-ByteSize {
    param([Int64]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N2} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return "$Bytes B"
}

function Write-UpdateProgress {
    param(
        [string]$Phase,
        [Int64]$Completed,
        [Int64]$Total,
        [Int32]$LastPercent
    )
    if ($Total -le 0) {
        if (-not $Quiet -and $LastPercent -lt 0) { Write-Host "[$Phase] Đang xử lý…" -ForegroundColor Cyan }
        return $LastPercent
    }
    $percent = [Math]::Min(100, [Math]::Max(0, [Int32][Math]::Floor(($Completed * 100.0) / $Total)))
    if ($percent -gt $LastPercent) {
        if (-not $Quiet) {
            Write-Host "[$Phase] $percent% — $(Format-ByteSize $Completed) / $(Format-ByteSize $Total)" -ForegroundColor Cyan
        }
        return $percent
    }
    return $LastPercent
}

function Download-FileWithProgress {
    param([string]$Url, [string]$Destination)
    $request = $response = $input = $output = $null
    try {
        $request = [System.Net.HttpWebRequest]::Create($Url)
        $request.UserAgent = 'CongCuBinhUpdater'
        $request.Timeout = 120000
        $request.ReadWriteTimeout = 120000
        $response = $request.GetResponse()
        [Int64]$total = $response.ContentLength
        $input = $response.GetResponseStream()
        $output = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        [byte[]]$buffer = New-Object byte[] 131072
        [Int64]$completed = 0
        [Int32]$lastPercent = -5
        $lastPercent = Write-UpdateProgress -Phase 'Tải DanCardCEP' -Completed 0 -Total $total -LastPercent $lastPercent
        while (($read = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $output.Write($buffer, 0, $read)
            $completed += $read
            $lastPercent = Write-UpdateProgress -Phase 'Tải DanCardCEP' -Completed $completed -Total $total -LastPercent $lastPercent
        }
        if ($total -le 0 -and -not $Quiet) {
            Write-Host "[Tải DanCardCEP] Hoàn thành — $(Format-ByteSize $completed)" -ForegroundColor Cyan
        }
    }
    finally {
        if ($output) { $output.Dispose() }
        if ($input) { $input.Dispose() }
        if ($response) { $response.Dispose() }
    }
}

function Copy-DirectoryWithProgress {
    param([string]$Source, [string]$Destination)
    # Giữ nguyên cả file ẩn và thư mục rỗng như Copy-Item -Recurse -Force
    # trước đây, đồng thời tính được tổng byte để hiện phần trăm chính xác.
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $prefix = $Source.TrimEnd('\') + '\'
    $directories = @(Get-ChildItem -LiteralPath $Source -Force -Recurse -Directory)
    foreach ($directory in $directories) {
        $relativeDirectory = $directory.FullName.Substring($prefix.Length)
        New-Item -ItemType Directory -Path (Join-Path $Destination $relativeDirectory) -Force | Out-Null
    }
    $files = @(Get-ChildItem -LiteralPath $Source -Force -Recurse -File)
    [Int64]$total = 0
    foreach ($file in $files) { $total += [Int64]$file.Length }
    [Int64]$completed = 0
    [Int32]$lastPercent = -5
    $lastPercent = Write-UpdateProgress -Phase 'Chép vào AppData' -Completed 0 -Total $total -LastPercent $lastPercent
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($prefix.Length)
        $targetPath = Join-Path $Destination $relativePath
        New-Item -ItemType Directory -Path (Split-Path -Parent $targetPath) -Force | Out-Null
        $input = $output = $null
        try {
            $input = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
            $output = [System.IO.File]::Open($targetPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            [byte[]]$buffer = New-Object byte[] 131072
            while (($read = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $output.Write($buffer, 0, $read)
                $completed += $read
                $lastPercent = Write-UpdateProgress -Phase 'Chép vào AppData' -Completed $completed -Total $total -LastPercent $lastPercent
            }
        }
        finally {
            if ($output) { $output.Dispose() }
            if ($input) { $input.Dispose() }
        }
    }
    if ($total -eq 0 -and -not $Quiet) { Write-Host '[Chép vào AppData] 100%' -ForegroundColor Cyan }
}

function Schedule-UpdaterPayload {
    param([string]$PackageBase)
    $packageUpdater = Join-Path $PackageBase 'updater'
    if (-not (Test-Path -LiteralPath (Join-Path $packageUpdater 'DanCardUpdater.ps1'))) { return }
    $stageRoot = Join-Path $PSScriptRoot ('payload-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
    foreach ($name in @('DanCardUpdater.ps1', 'SetupShortcuts.ps1', 'ApplyUpdaterPayload.ps1', 'CongCuBinh.ico', 'update-config.json')) {
        $source = Join-Path $packageUpdater $name
        if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $stageRoot $name) -Force }
    }
    $applyScript = Join-Path $stageRoot 'ApplyUpdaterPayload.ps1'
    if (-not (Test-Path -LiteralPath $applyScript)) {
        Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
        return
    }
    $arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$applyScript`" -ParentProcessId $PID -StageRoot `"$stageRoot`" -UpdaterHome `"$PSScriptRoot`""
    try {
        Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden
    }
    catch {
        Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
        throw
    }
    Write-UpdateLog 'Đang làm mới updater và icon cho lần cập nhật sau…' DarkCyan
}

# Chỉ một updater được phép đổi folder extension tại một thời điểm. File lock
# tự được Windows nhả khi tiến trình kết thúc, kể cả khi updater lỗi giữa chừng.
$lockPath = Join-Path $PSScriptRoot 'update.lock'
try {
    $updaterLock = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
}
catch [System.IO.IOException] {
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
    }
    catch {
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
    if (-not (Test-Path -LiteralPath $installedManifestPath)) { return [Version]'0.0.0' }
    [xml]$manifest = Get-Content -LiteralPath $installedManifestPath -Raw -Encoding UTF8
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

Register-RecurringCheckTask

$intervalMinutes = 1
try {
    if ($null -ne $config.checkIntervalMinutes) {
        $intervalMinutes = [Math]::Max(1, [int]$config.checkIntervalMinutes)
    }
}
catch {}
$state = Read-JsonFile -Path $statePath -Default ([pscustomobject]@{})
if (-not $Force -and $state.lastCheckUtc) {
    try {
        $lastCheck = [DateTime]::Parse([string]$state.lastCheckUtc).ToUniversalTime()
        if ((([DateTime]::UtcNow - $lastCheck).TotalMinutes -lt $intervalMinutes) -and -not $state.pendingVersion) {
            exit 0
        }
    }
    catch {}
}

try {
    $manifestUrl = Test-HttpsUrl -Value $config.manifestUrl -Label 'manifestUrl'
    Write-UpdateLog 'Đang kiểm tra bản cập nhật online…'
    # GitHub Raw returns latest.json as text/plain.  Parse it explicitly and
    # remove an optional UTF-8 BOM so Windows PowerShell 5 can read it too.
    $manifestHeaders = @{ 'User-Agent' = 'CongCuBinhUpdater'; 'Accept' = 'application/vnd.github+json' }
    # Khi chưa có bản đang chờ cài, dùng ETag để GitHub trả 304 cho lần kiểm
    # tra không có thay đổi. Nhờ vậy kiểm tra mỗi phút không tải lại nội dung
    # latest.json liên tục.
    if (-not $state.pendingVersion -and -not [string]::IsNullOrWhiteSpace([string]$state.manifestEtag)) {
        $manifestHeaders['If-None-Match'] = [string]$state.manifestEtag
    }
    try {
        $manifestResponse = Invoke-WebRequest -Uri $manifestUrl -UseBasicParsing -TimeoutSec 20 -Headers $manifestHeaders
    }
    catch {
        $webResponse = $_.Exception.Response
        if ($webResponse -and ([int]$webResponse.StatusCode -eq 304)) {
            $state | Add-Member -NotePropertyName lastCheckUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
            Write-JsonFile -Path $statePath -Value $state
            Write-UpdateLog 'Chưa có bản mới.' DarkGreen
            exit 0
        }
        throw
    }
    if ($manifestResponse.Headers['ETag']) {
        $state | Add-Member -NotePropertyName manifestEtag -NotePropertyValue ([string]$manifestResponse.Headers['ETag']) -Force
    }
    $manifestText = ([string]$manifestResponse.Content).TrimStart([char]0xFEFF)
    $remote = $manifestText | ConvertFrom-Json
    # GitHub Contents API returns the manifest as base64.  Supporting this
    # endpoint avoids the five-minute CDN cache used by raw.githubusercontent.
    if (([string]$remote.encoding).ToLowerInvariant() -eq 'base64' -and -not [string]::IsNullOrWhiteSpace([string]$remote.content)) {
        try {
            $base64 = ([string]$remote.content) -replace '\s', ''
            $manifestText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($base64)).TrimStart([char]0xFEFF)
            $remote = $manifestText | ConvertFrom-Json
        }
        catch {
            throw 'Không đọc được nội dung latest.json từ GitHub API.'
        }
    }
    if ([string]$remote.product -ne $product) { throw 'Manifest online không đúng sản phẩm.' }
    $remoteVersion = ConvertTo-Version $remote.version
    $packageUrl = Test-HttpsUrl -Value $remote.packageUrl -Label 'packageUrl'
    $expectedHash = ([string]$remote.sha256).ToUpperInvariant()
    if ($expectedHash -notmatch '^[0-9A-F]{64}$') { throw 'Manifest online thiếu SHA-256 hợp lệ.' }
    $hadInstalledManifest = Test-Path -LiteralPath $installedManifestPath
    $installedVersion = Get-InstalledVersion

    $state | Add-Member -NotePropertyName lastCheckUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
    $state | Add-Member -NotePropertyName lastSeenVersion -NotePropertyValue $remoteVersion.ToString() -Force
    Write-JsonFile -Path $statePath -Value $state

    if ($remoteVersion -le $installedVersion) {
        $state | Add-Member -NotePropertyName pendingVersion -NotePropertyValue $null -Force
        $state | Add-Member -NotePropertyName notifiedPendingVersion -NotePropertyValue $null -Force
        $state | Add-Member -NotePropertyName lastPendingNotificationUtc -NotePropertyValue $null -Force
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
        $shouldNotify = ([string]$state.notifiedPendingVersion -ne $remoteVersion.ToString())
        if (-not $shouldNotify) {
            try {
                $lastNotification = [DateTime]::Parse([string]$state.lastPendingNotificationUtc).ToUniversalTime()
                $shouldNotify = (([DateTime]::UtcNow - $lastNotification).TotalHours -ge 2)
            }
            catch {
                $shouldNotify = $true
            }
        }
        if ($shouldNotify) {
            Show-UpdateToast -Title 'Công cụ bình có bản cập nhật mới' `
                -Message "Bản $remoteVersion đã sẵn sàng. Đóng Illustrator rồi mở lại (hoặc đăng nhập lại Windows) để cài."
            $state | Add-Member -NotePropertyName notifiedPendingVersion -NotePropertyValue $remoteVersion.ToString() -Force
            $state | Add-Member -NotePropertyName lastPendingNotificationUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
            Write-JsonFile -Path $statePath -Value $state
        }
        exit 0
    }

    $workRoot = Join-Path $env:TEMP ('CongCuBinhUpdate-' + [Guid]::NewGuid().ToString('N'))
    $zipPath = Join-Path $workRoot 'package.zip'
    $extractRoot = Join-Path $workRoot 'extract'
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
    try {
        Write-UpdateLog "Đang tải bản $remoteVersion…"
        Download-FileWithProgress -Url $packageUrl -Destination $zipPath
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
            Copy-DirectoryWithProgress -Source $packageRoot -Destination $installRoot
            if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'CSXS\manifest.xml'))) {
                throw 'Chép gói mới không hoàn tất.'
            }
        }
        catch {
            if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
            if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $installRoot -Force }
            throw
        }
        # Gói online cũng mang theo updater và icon.  Chép chúng vào thư mục
        # tạm trước, rồi một tiến trình con sẽ thay file sau khi updater này
        # thoát để không ghi đè script đang chạy.
        try {
            Schedule-UpdaterPayload -PackageBase (Split-Path -Parent $packageRoot)
        }
        catch {
            Write-UpdateLog "Panel đã cập nhật, nhưng chưa làm mới được updater: $($_.Exception.Message)" DarkYellow
        }
        Get-ChildItem -LiteralPath (Split-Path -Parent $installRoot) -Directory -Filter 'DanCardCEP.backup-*' |
        Sort-Object LastWriteTime -Descending | Select-Object -Skip 1 |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        $state | Add-Member -NotePropertyName pendingVersion -NotePropertyValue $null -Force
        $state | Add-Member -NotePropertyName notifiedPendingVersion -NotePropertyValue $null -Force
        $state | Add-Member -NotePropertyName lastPendingNotificationUtc -NotePropertyValue $null -Force
        $state | Add-Member -NotePropertyName installedVersion -NotePropertyValue $remoteVersion.ToString() -Force
        Write-JsonFile -Path $statePath -Value $state
        if ($hadInstalledManifest) {
            Write-UpdateLog "Đã cập nhật $installedVersion → $remoteVersion. Mở lại Illustrator để dùng bản mới." Green
            Show-UpdateToast -Title 'Công cụ bình đã cập nhật' `
                -Message "Đã lên bản $remoteVersion. Mở lại Illustrator để dùng bản mới."
        }
        else {
            Write-UpdateLog "Đã cài v$remoteVersion (không tìm thấy manifest của bản cũ). Mở lại Illustrator để dùng bản mới." Green
            Show-UpdateToast -Title 'Công cụ bình đã cài đặt' `
                -Message "Đã cài bản $remoteVersion. Mở lại Illustrator để dùng."
        }
    }
    finally {
        Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
catch {
    $message = $_.Exception.Message
    try {
        $state | Add-Member -NotePropertyName lastError -NotePropertyValue $message -Force
        Write-JsonFile -Path $statePath -Value $state
    }
    catch {}
    Write-UpdateLog "Không cập nhật được: $message" Red
    if (-not $Quiet) { exit 1 }
}
