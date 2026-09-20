[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^/\s]+/[^/\s]+$')]
    [string]$GitHubRepository,

    [string]$OutputDirectory = '',

    [switch]$AllowSameVersion
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot 'online'
}
$source = Join-Path $PSScriptRoot 'DanCardCEP'
$manifestPath = Join-Path $source 'CSXS\manifest.xml'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Không tìm thấy DanCardCEP\CSXS\manifest.xml.' }
[xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8
$product = [string]$manifest.ExtensionManifest.ExtensionBundleId
$version = [string]$manifest.ExtensionManifest.ExtensionBundleVersion
if ($product -ne 'com.locdev.dancard') { throw 'Manifest không đúng mã sản phẩm.' }
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Version phải có dạng x.y.z, hiện là $version." }

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$existingLatestPath = Join-Path $OutputDirectory 'latest.json'
if ((Test-Path -LiteralPath $existingLatestPath) -and -not $AllowSameVersion) {
    try {
        $existingManifest = Get-Content -LiteralPath $existingLatestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $existingVersion = [Version]([string]$existingManifest.version)
    } catch {
        throw "Không đọc được version trong $existingLatestPath."
    }
    if ([Version]$version -le $existingVersion) {
        throw "Version $version chưa cao hơn bản đang phát hành $existingVersion. Hãy tăng version trước khi publish."
    }
}
$zipName = "DanCardCEP-$version.zip"
$zipPath = Join-Path $OutputDirectory $zipName
$stageRoot = Join-Path $env:TEMP ('DanCardPublish-' + [Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $stageRoot 'DanCardCEP') -Recurse -Force
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    Compress-Archive -LiteralPath (Join-Path $stageRoot 'DanCardCEP') -DestinationPath $zipPath -CompressionLevel Optimal
    $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
    $packageUrl = "https://raw.githubusercontent.com/$GitHubRepository/main/online/$zipName"
    $onlineManifest = [ordered]@{
        product = $product
        version = $version
        packageUrl = $packageUrl
        sha256 = $hash
        publishedUtc = [DateTime]::UtcNow.ToString('o')
    }
    $latestPath = Join-Path $OutputDirectory 'latest.json'
    $latestJson = $onlineManifest | ConvertTo-Json
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($latestPath, $latestJson + [Environment]::NewLine, $utf8NoBom)
    Write-Host "Đã tạo: $zipPath" -ForegroundColor Green
    Write-Host "Đã tạo: $latestPath" -ForegroundColor Green
    Write-Host "Commit va push ca thu muc online/ len nhanh main." -ForegroundColor Yellow
    Write-Host "URL manifest dùng cho máy khách:" -ForegroundColor Cyan
    Write-Host "https://raw.githubusercontent.com/$GitHubRepository/main/online/latest.json" -ForegroundColor White
} finally {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
}
