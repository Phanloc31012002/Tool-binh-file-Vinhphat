[CmdletBinding()]
param(
    [Alias('Message')]
    [string]$UpdateName = '',

    [string]$UpdateContent = '',

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root 'DanCardCEP\CSXS\manifest.xml'
$indexPath = Join-Path $root 'DanCardCEP\index.html'
$readmePath = Join-Path $PSScriptRoot 'README.md'
$changelogPath = Join-Path $root 'DanCardCEP\LICH_SU_CAP_NHAT.md'
$publishScript = Join-Path $PSScriptRoot 'Publish-OnlineUpdate.ps1'
$employeePackageScript = Join-Path $PSScriptRoot 'DongGoiNhanVien.ps1'

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

function Read-ReleaseDetails {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing

        $form = New-Object System.Windows.Forms.Form
        $form.Text = 'Phát hành cập nhật'
        $form.StartPosition = 'CenterScreen'
        $form.FormBorderStyle = 'FixedDialog'
        $form.MaximizeBox = $false
        $form.MinimizeBox = $false
        $form.ClientSize = New-Object System.Drawing.Size(440, 218)

        $nameLabel = New-Object System.Windows.Forms.Label
        $nameLabel.Text = 'Tên update / commit:'
        $nameLabel.AutoSize = $true
        $nameLabel.Location = New-Object System.Drawing.Point(16, 16)
        $form.Controls.Add($nameLabel)

        $nameInput = New-Object System.Windows.Forms.TextBox
        $nameInput.Size = New-Object System.Drawing.Size(408, 24)
        $nameInput.Location = New-Object System.Drawing.Point(16, 38)
        $form.Controls.Add($nameInput)

        $contentLabel = New-Object System.Windows.Forms.Label
        $contentLabel.Text = 'Nội dung:'
        $contentLabel.AutoSize = $true
        $contentLabel.Location = New-Object System.Drawing.Point(16, 76)
        $form.Controls.Add($contentLabel)

        $contentInput = New-Object System.Windows.Forms.TextBox
        $contentInput.Multiline = $true
        $contentInput.AcceptsReturn = $true
        $contentInput.ScrollBars = 'Vertical'
        $contentInput.Size = New-Object System.Drawing.Size(408, 64)
        $contentInput.Location = New-Object System.Drawing.Point(16, 98)
        $form.Controls.Add($contentInput)

        $cancel = New-Object System.Windows.Forms.Button
        $cancel.Text = 'Hủy'
        $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
        $cancel.Size = New-Object System.Drawing.Size(86, 28)
        $cancel.Location = New-Object System.Drawing.Point(246, 176)
        $form.Controls.Add($cancel)

        $publish = New-Object System.Windows.Forms.Button
        $publish.Text = 'Phát hành'
        $publish.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $publish.Size = New-Object System.Drawing.Size(92, 28)
        $publish.Location = New-Object System.Drawing.Point(332, 176)
        $form.Controls.Add($publish)

        $form.AcceptButton = $publish
        $form.CancelButton = $cancel
        $form.Add_Shown({ $nameInput.Focus() })
        if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
        return [pscustomobject]@{
            UpdateName = $nameInput.Text.Trim()
            UpdateContent = $contentInput.Text.Trim()
        }
    } catch {
        return [pscustomobject]@{
            UpdateName = Read-Host 'Tên update / commit'
            UpdateContent = Read-Host 'Nội dung'
        }
    }
}

foreach ($path in @($manifestPath, $indexPath, $readmePath, $changelogPath, $publishScript, $employeePackageScript)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Thiếu file: $path" }
}

$manifestText = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
$match = [regex]::Match($manifestText, 'ExtensionBundleVersion="(\d+)\.(\d+)\.(\d+)"')
if (-not $match.Success) { throw 'Không đọc được version trong manifest.xml.' }
$oldVersion = $match.Groups[1].Value + '.' + $match.Groups[2].Value + '.' + $match.Groups[3].Value
$newVersion = $match.Groups[1].Value + '.' + $match.Groups[2].Value + '.' + (([int]$match.Groups[3].Value) + 1)
$repository = Get-GitHubRepository

if ([string]::IsNullOrWhiteSpace($UpdateName) -and [string]::IsNullOrWhiteSpace($UpdateContent)) {
    $releaseDetails = Read-ReleaseDetails
    if ($null -eq $releaseDetails) {
        Write-Host 'Đã hủy phát hành.' -ForegroundColor Yellow
        exit 0
    }
    $UpdateName = $releaseDetails.UpdateName
    $UpdateContent = $releaseDetails.UpdateContent
}
if ([string]::IsNullOrWhiteSpace($UpdateName)) { $UpdateName = 'Cập nhật chức năng' }
$UpdateName = $UpdateName.Trim()
if ([string]::IsNullOrWhiteSpace($UpdateContent)) { $UpdateContent = $UpdateName }
$UpdateContent = $UpdateContent.Trim()

Write-Host "Phát hành: $oldVersion -> $newVersion" -ForegroundColor Cyan
Write-Host "GitHub: $repository" -ForegroundColor Cyan
Write-Host "Tên update / commit: $UpdateName" -ForegroundColor Cyan
Write-Host "Nội dung: $UpdateContent" -ForegroundColor Cyan
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
$noteLines = @(
    $UpdateContent -split "`r`n|`r|`n" |
        ForEach-Object { ($_ -replace '^\s*[-*]\s*', '').Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)
if ($noteLines.Count -eq 0) { $noteLines = @('Cập nhật chức năng') }
$entry = "$newline## v$newVersion — $UpdateName$newline$newline"
foreach ($line in $noteLines) {
    $entry += "- $line$newline"
}
$entry += "$newline---$newline"
$changelogText = $changelogText.Insert($authorEnd + $newline.Length, $entry)
Write-Utf8Bom -Path $changelogPath -Text $changelogText

& $publishScript -GitHubRepository $repository -ReleaseTitle $UpdateName -ReleaseDescription $UpdateContent
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được gói cập nhật.' }

& $employeePackageScript

& git -C $root add --all
if ($LASTEXITCODE -ne 0) { throw 'Git add thất bại.' }
& git -C $root diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Có lỗi định dạng trong file chuẩn bị commit.' }
$commitMessage = "Release v${newVersion}: $UpdateName"
& git -C $root commit -m $commitMessage
if ($LASTEXITCODE -ne 0) { throw 'Git commit thất bại.' }
& git -C $root push origin main
if ($LASTEXITCODE -ne 0) { throw 'Git push thất bại. Commit đã có ở máy này; chạy lại git push origin main.' }

Write-Host ''
Write-Host "Đã phát hành v$newVersion lên GitHub." -ForegroundColor Green
Write-Host 'Máy nhân viên sẽ nhận bản mới khi updater chạy và Illustrator đang đóng.' -ForegroundColor Green
