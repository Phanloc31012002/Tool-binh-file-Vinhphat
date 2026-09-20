$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root "DanCardCEP"
$dest = Join-Path $env:APPDATA "Adobe\CEP\extensions\DanCardCEP"
$updaterSource = Join-Path $root "updater"
$updaterHome = Join-Path $env:LOCALAPPDATA "CongCuBinhUpdater"
$updaterScript = Join-Path $updaterHome "DanCardUpdater.ps1"
$updaterConfig = Join-Path $updaterHome "update-config.json"
$updaterTaskName = "CongCuBinh-AutoUpdate"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CÀI ĐẶT PANEL `"CÔNG CỤ BÌNH`" (CEP)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $src)) {
    Write-Host "[LỖI] Không tìm thấy thư mục DanCardCEP bên cạnh file này." -ForegroundColor Red
    Write-Host "Hãy đặt install.bat CÙNG CHỖ với thư mục DanCardCEP." -ForegroundColor Yellow
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
        if ((-not (Test-Path $updaterConfig)) -or ((-not [string]::IsNullOrWhiteSpace($sourceUpdateUrl)) -and [string]::IsNullOrWhiteSpace($currentUpdateUrl))) {
            Copy-Item -LiteralPath (Join-Path $updaterSource "update-config.json") -Destination $updaterConfig -Force
        }

        $updateUrl = ""
        try {
            $updateConfigData = Get-Content -LiteralPath $updaterConfig -Raw -Encoding UTF8 | ConvertFrom-Json
            $updateUrl = [string]$updateConfigData.manifestUrl
        } catch {}
        if (-not [string]::IsNullOrWhiteSpace($updateUrl)) {
            try {
                $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$updaterScript`" -Quiet")
                $taskTrigger = New-ScheduledTaskTrigger -AtLogOn
                $taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
                Register-ScheduledTask -TaskName $updaterTaskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description "Tự kiểm tra cập nhật Công cụ bình" -Force | Out-Null
                Write-Host "Đã bật tự kiểm tra cập nhật online khi đăng nhập Windows." -ForegroundColor Green
            } catch {
                Write-Host "Chưa tạo được tác vụ tự update: $($_.Exception.Message)" -ForegroundColor Yellow
                Write-Host "Vẫn có thể chạy: $updaterScript" -ForegroundColor Yellow
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
        Write-Host "(Đây là lần cài đầu tiên. Lần sau chỉ cần bấm lại install.bat để cập nhật.)" -ForegroundColor White
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
