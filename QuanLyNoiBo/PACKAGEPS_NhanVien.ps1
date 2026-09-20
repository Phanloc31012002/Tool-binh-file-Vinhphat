$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root "DanCardCEP"
$dest = Join-Path $env:APPDATA "Adobe\CEP\extensions\DanCardCEP"
$updaterSource = Join-Path $PSScriptRoot "updater"
$updaterHome = Join-Path $env:LOCALAPPDATA "CongCuBinhUpdater"
$updaterScript = Join-Path $updaterHome "DanCardUpdater.ps1"
$updaterConfig = Join-Path $updaterHome "update-config.json"
$updaterIcon = Join-Path $updaterHome "CongCuBinh.ico"
$updaterTaskName = "CongCuBinh-AutoUpdate"
$startupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$startupLauncher = Join-Path $startupDir "$updaterTaskName.vbs"
$programsDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\CongCuBinh"
$manualUpdateLauncher = Join-Path $updaterHome "Cap nhat Cong cu binh.cmd"
$legacyManualUpdateLauncher = Join-Path $programsDir "Cap nhat Cong cu binh.cmd"
$manualUpdateShortcut = Join-Path $programsDir "Cap nhat Cong cu binh.lnk"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CÀI ĐẶT PANEL `"CÔNG CỤ BÌNH`" (CEP)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $src)) {
    Write-Host "[LỖI] Không tìm thấy thư mục DanCardCEP bên cạnh file này." -ForegroundColor Red
    Write-Host "Hãy giải nén đầy đủ bộ cài rồi chạy CAI_DAT_CONG_CU_BINH.bat." -ForegroundColor Yellow
    Read-Host "Nhấn Enter để thoát"
    exit 1
}

Write-Host "Nguồn:  " -ForegroundColor Blue -NoNewline
Write-Host $src -ForegroundColor White
Write-Host "Đích:   " -ForegroundColor Blue -NoNewline
Write-Host $dest -ForegroundColor White
Write-Host ""

$extDir = Join-Path $env:APPDATA "Adobe\CEP\extensions"
if (-not (Test-Path $extDir)) { New-Item -ItemType Directory -Path $extDir -Force | Out-Null }

while (Get-Process -Name Illustrator -ErrorAction SilentlyContinue) {
    Write-Host "Illustrator đang mở. Hãy LƯU và ĐÓNG hẳn Illustrator rồi tiếp tục." -ForegroundColor Yellow
    Write-Host "(Nếu còn mở, Illustrator giữ bản panel cũ trong bộ nhớ - cài xong vẫn thấy bản cũ.)" -ForegroundColor Yellow
    Read-Host "Đóng Illustrator xong, nhấn Enter để tiếp tục" | Out-Null
}

if (Test-Path $dest) {
    Write-Host "Đã có bản cũ -> đang cập nhật (xóa bản cũ)..." -ForegroundColor Yellow
    Remove-Item $dest -Recurse -Force
    $lanDau = $false
} else {
    Write-Host "Cài đặt LẦN ĐẦU (chưa có bản nào trước đó)." -ForegroundColor Green
    $lanDau = $true
}

Write-Host "Đang chép bản mới..." -ForegroundColor Yellow
Copy-Item $src $dest -Recurse -Force

if (Test-Path (Join-Path $dest "CSXS\manifest.xml")) {
    # Updater nằm ngoài DanCardCEP để lúc thay panel online không tự xóa chính nó.
    # Config đã có trên máy được giữ lại; chỉ bổ sung config mẫu khi chưa có.
    if (Test-Path $updaterSource) {
        New-Item -ItemType Directory -Path $updaterHome -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $updaterSource "DanCardUpdater.ps1") -Destination $updaterScript -Force
        foreach ($updaterFileName in @("SetupShortcuts.ps1", "ApplyUpdaterPayload.ps1", "CongCuBinh.ico")) {
            $updaterFileSource = Join-Path $updaterSource $updaterFileName
            if (Test-Path -LiteralPath $updaterFileSource) {
                Copy-Item -LiteralPath $updaterFileSource -Destination (Join-Path $updaterHome $updaterFileName) -Force
            }
        }
        $sourceUpdaterConfig = Join-Path $updaterSource "update-config.json"
        $sourceUpdateUrl = ""
        $currentUpdateUrl = ""
        try {
            $sourceUpdateUrl = [string]((Get-Content -LiteralPath $sourceUpdaterConfig -Raw -Encoding UTF8 | ConvertFrom-Json).manifestUrl)
        } catch {}
        try {
            if (Test-Path $updaterConfig) {
                $currentUpdateUrl = [string]((Get-Content -LiteralPath $updaterConfig -Raw -Encoding UTF8 | ConvertFrom-Json).manifestUrl)
            }
        } catch {}
        if ((-not (Test-Path $updaterConfig)) -or ((-not [string]::IsNullOrWhiteSpace($sourceUpdateUrl)) -and ( [string]::IsNullOrWhiteSpace($currentUpdateUrl) -or $currentUpdateUrl -match '^https://raw\.githubusercontent\.com/' ))) {
            Copy-Item -LiteralPath (Join-Path $updaterSource "update-config.json") -Destination $updaterConfig -Force
        }

        $updateUrl = ""
        try {
            $updateConfigData = Get-Content -LiteralPath $updaterConfig -Raw -Encoding UTF8 | ConvertFrom-Json
            $updateUrl = [string]$updateConfigData.manifestUrl
        } catch {}
        if (-not [string]::IsNullOrWhiteSpace($updateUrl)) {
            try {
                New-Item -ItemType Directory -Path $programsDir -Force | Out-Null
                $manualUpdateContent = @(
                    '@echo off'
                    'chcp 65001 >nul'
                    'echo Dong Illustrator truoc khi cap nhat.'
                    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\CongCuBinhUpdater\DanCardUpdater.ps1" -Force'
                    'echo.'
                    'pause'
                ) -join [Environment]::NewLine
                [System.IO.File]::WriteAllText($manualUpdateLauncher, $manualUpdateContent + [Environment]::NewLine, [System.Text.Encoding]::ASCII)
                # Start Menu chi hien shortcut co icon, con .cmd dat trong updater.
                if (Test-Path -LiteralPath $legacyManualUpdateLauncher) {
                    Remove-Item -LiteralPath $legacyManualUpdateLauncher -Force -ErrorAction SilentlyContinue
                }
                $shell = New-Object -ComObject WScript.Shell
                $shortcut = $shell.CreateShortcut($manualUpdateShortcut)
                $shortcut.TargetPath = $env:ComSpec
                $shortcut.Arguments = '/c ""' + $manualUpdateLauncher + '""'
                $shortcut.WorkingDirectory = $updaterHome
                $shortcut.Description = 'Kiem tra va cai ban moi cua Cong cu binh'
                if (Test-Path -LiteralPath $updaterIcon) { $shortcut.IconLocation = "$updaterIcon,0" }
                $shortcut.Save()
                Write-Host "Đã thêm lối tắt Start Menu: Cập nhật Công cụ bình." -ForegroundColor Green
            } catch {
                Write-Host "Chưa tạo được lối tắt cập nhật thủ công: $($_.Exception.Message)" -ForegroundColor Yellow
            }
            $autoUpdateEnabled = $false
            $usingStartupFallback = $false
            $taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$updaterScript`" -Quiet"
            try {
                $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$updaterScript`" -Quiet")
                $taskTrigger = New-ScheduledTaskTrigger -AtLogOn
                $taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
                Register-ScheduledTask -TaskName $updaterTaskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description "Tự kiểm tra cập nhật Công cụ bình" -Force | Out-Null
                Write-Host "Đã bật tự kiểm tra cập nhật online khi đăng nhập Windows." -ForegroundColor Green
                $autoUpdateEnabled = $true
            } catch {
                $registerError = $_.Exception.Message
                try {
                    # Một số bản Windows chặn Register-ScheduledTask của user thường.
                    # schtasks tạo tác vụ đăng nhập cho chính user mà không cần quyền admin.
                    $taskOutput = & schtasks.exe /Create /TN $updaterTaskName /TR $taskCommand /SC ONLOGON /F 2>&1
                    if ($LASTEXITCODE -ne 0) { throw ($taskOutput -join ' ') }
                    Write-Host "Đã bật tự kiểm tra cập nhật online khi đăng nhập Windows." -ForegroundColor Green
                    $autoUpdateEnabled = $true
                } catch {
                    Write-Host "Windows không cho tạo Task Scheduler cho user này; đang dùng Startup tự động thay thế." -ForegroundColor Yellow
                }
            }
            if (-not $autoUpdateEnabled) {
                try {
                    New-Item -ItemType Directory -Path $startupDir -Force | Out-Null
                    $vbsLine = 'CreateObject("Wscript.Shell").Run "' + $taskCommand.Replace('"', '""') + '", 0, False'
                    [System.IO.File]::WriteAllText($startupLauncher, $vbsLine + [Environment]::NewLine, [System.Text.Encoding]::ASCII)
                    Write-Host "Đã bật tự kiểm tra cập nhật bằng Startup của user." -ForegroundColor Green
                    $autoUpdateEnabled = $true
                    $usingStartupFallback = $true
                } catch {
                    Write-Host "Chưa bật được tự update: $($_.Exception.Message)" -ForegroundColor Yellow
                    Write-Host "Vẫn có thể chạy: $updaterScript" -ForegroundColor Yellow
                }
            }
            if ($autoUpdateEnabled -and -not $usingStartupFallback -and (Test-Path -LiteralPath $startupLauncher)) {
                Remove-Item -LiteralPath $startupLauncher -Force -ErrorAction SilentlyContinue
            }
        } else {
            Write-Host "Chưa cấu hình URL update online; panel vẫn cài bình thường." -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Red
    Write-Host "   CÀI ĐẶT XONG RỒI, CÓ GÌ KO BÍT IB LỘC CODE DẠO!" -ForegroundColor Red
    Write-Host "===============================================" -ForegroundColor Red
    Write-Host ""
    if ($lanDau) {
        Write-Host "(Đây là lần cài đầu tiên. Các lần sau tool tự kiểm tra cập nhật online.)" -ForegroundColor White
    } else {
        Write-Host "(Đã cập nhật lên bản mới nhất.)" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Mở lại Illustrator:  Window > Extensions > Công cụ bình" -ForegroundColor Green
    Write-Host ""
    Write-Host "ZALO 0853147500" -ForegroundColor Cyan
} else {
    Write-Host "[LỖI] Chép thất bại. Kiểm tra lại quyền ghi." -ForegroundColor Red
}

Write-Host ""
Read-Host "Nhấn Enter để đóng"
