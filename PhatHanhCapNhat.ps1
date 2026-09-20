[CmdletBinding()]
param(
    [string]$Message = '',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = $PSScriptRoot
$manifestPath = Join-Path $root 'DanCardCEP\CSXS\manifest.xml'
$indexPath = Join-Path $root 'DanCardCEP\index.html'
$readmePath = Join-Path $root 'README.md'
$changelogPath = Join-Path $root 'DanCardCEP\LICH_SU_CAP_NHAT.md'
$publishScript = Join-Path $root 'Publish-OnlineUpdate.ps1'

function Write-Utf8Bom {
    param([string]$Path, [string]$Text)
    $encoding = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($Path, $Text, $encoding)
}

function Get-GitHubRepository {
    $origin = (& git -C $root remote get-url origin).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Không đọc được remote origin của Git.' }
    if ($origin -match '^https://github\.com/([^/]+/[^/]+?)(?:\.git)?/?$') { return $Matches[1] }
    if ($origin -match '^git@github\.com:([^/]+/[^/]+?)(?:\.git)?$') { return $Matches[1] }
    throw "Remote origin không phải GitHub: $origin"
}

foreach ($path in @($manifestPath, $indexPath, $readmePath, $changelogPath, $publishScript)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Thiếu file: $path" }
}

$manifestText = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
$match = [regex]::Match($manifestText, 'ExtensionBundleVersion="(\d+)\.(\d+)\.(\d+)"')
if (-not $match.Success) { throw 'Không đọc được version trong manifest.xml.' }
$oldVersion = $match.Groups[1].Value + '.' + $match.Groups[2].Value + '.' + $match.Groups[3].Value
$newVersion = $match.Groups[1].Value + '.' + $match.Groups[2].Value + '.' + (([int]$match.Groups[3].Value) + 1)
$repository = Get-GitHubRepository

if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = Read-Host 'Mô tả ngắn của bản cập nhật (bỏ trống để dùng mô tả mặc định)'
}
if ([string]::IsNullOrWhiteSpace($Message)) { $Message = 'Cập nhật chức năng' }
$Message = $Message.Trim()

Write-Host "Phát hành: $oldVersion -> $newVersion" -ForegroundColor Cyan
Write-Host "GitHub: $repository" -ForegroundColor Cyan
Write-Host "Mô tả: $Message" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host 'DryRun: chưa sửa file, chưa commit, chưa push.' -ForegroundColor Yellow
    exit 0
}

$manifestText = $manifestText -replace 'ExtensionBundleVersion="\d+\.\d+\.\d+"', "ExtensionBundleVersion=`"$newVersion`""
$manifestText = $manifestText -replace 'Extension Id="com\.locdev\.dancard\.panel" Version="\d+\.\d+\.\d+"', "Extension Id=`"com.locdev.dancard.panel`" Version=`"$newVersion`""
Write-Utf8Bom -Path $manifestPath -Text $manifestText

$indexText = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
$indexText = $indexText -replace '<span class="ver">v\d+\.\d+\.\d+</span>', "<span class=`"ver`">v$newVersion</span>"
Write-Utf8Bom -Path $indexPath -Text $indexText

$readmeText = [System.IO.File]::ReadAllText($readmePath, [System.Text.Encoding]::UTF8)
$readmeText = $readmeText -replace 'Phiên bản hiện tại: \*\*v\d+\.\d+\.\d+\*\*\.', "Phiên bản hiện tại: **v$newVersion**."
Write-Utf8Bom -Path $readmePath -Text $readmeText

$changelogText = [System.IO.File]::ReadAllText($changelogPath, [System.Text.Encoding]::UTF8)
$newline = if ($changelogText.Contains("`r`n")) { "`r`n" } else { "`n" }
$authorStart = $changelogText.IndexOf('_Tác giả:')
if ($authorStart -lt 0) { throw 'Không tìm thấy dòng tác giả trong changelog.' }
$authorEnd = $changelogText.IndexOf($newline, $authorStart)
if ($authorEnd -lt 0) { throw 'Changelog không đúng định dạng.' }
$entry = "$newline## v$newVersion — $Message$newline$newline- Phát hành tự động qua `PhatHanhCapNhat.bat`.$newline$newline---$newline"
$changelogText = $changelogText.Insert($authorEnd + $newline.Length, $entry)
Write-Utf8Bom -Path $changelogPath -Text $changelogText

& $publishScript -GitHubRepository $repository
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được gói cập nhật.' }

& git -C $root add --all
if ($LASTEXITCODE -ne 0) { throw 'Git add thất bại.' }
& git -C $root diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Có lỗi định dạng trong file chuẩn bị commit.' }
& git -C $root commit -m "Release v${newVersion}: $Message"
if ($LASTEXITCODE -ne 0) { throw 'Git commit thất bại.' }
& git -C $root push origin main
if ($LASTEXITCODE -ne 0) { throw 'Git push thất bại. Commit đã có ở máy này; chạy lại git push origin main.' }

Write-Host ''
Write-Host "Đã phát hành v$newVersion lên GitHub." -ForegroundColor Green
Write-Host 'Máy nhân viên sẽ nhận bản mới khi updater chạy và Illustrator đang đóng.' -ForegroundColor Green
