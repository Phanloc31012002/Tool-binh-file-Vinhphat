[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[^/\s]+/[^/\s]+$')]
    [string]$GitHubRepository,

    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'release')
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'DanCardCEP'
$manifestPath = Join-Path $source 'CSXS\manifest.xml'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Không tìm thấy DanCardCEP\CSXS\manifest.xml.' }
[xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8
$product = [string]$manifest.ExtensionManifest.ExtensionBundleId
$version = [string]$manifest.ExtensionManifest.ExtensionBundleVersion
if ($product -ne 'com.locdev.dancard') { throw 'Manifest không đúng mã sản phẩm.' }
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Version phải có dạng x.y.z, hiện là $version." }

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$zipName = "DanCardCEP-$version.zip"
$zipPath = Join-Path $OutputDirectory $zipName
$stageRoot = Join-Path $env:TEMP ('DanCardPublish-' + [Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $stageRoot 'DanCardCEP') -Recurse -Force
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    Compress-Archive -LiteralPath (Join-Path $stageRoot 'DanCardCEP') -DestinationPath $zipPath -CompressionLevel Optimal
    $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
    $packageUrl = "https://github.com/$GitHubRepository/releases/download/v$version/$zipName"
    $onlineManifest = [ordered]@{
        product = $product
        version = $version
        packageUrl = $packageUrl
        sha256 = $hash
        publishedUtc = [DateTime]::UtcNow.ToString('o')
    }
    $latestPath = Join-Path $OutputDirectory 'latest.json'
    $onlineManifest | ConvertTo-Json | Set-Content -LiteralPath $latestPath -Encoding UTF8
    Write-Host "Đã tạo: $zipPath" -ForegroundColor Green
    Write-Host "Đã tạo: $latestPath" -ForegroundColor Green
    Write-Host "Upload hai file này làm assets của GitHub Release có tag: v$version" -ForegroundColor Yellow
    Write-Host "URL manifest dùng cho máy khách:" -ForegroundColor Cyan
    Write-Host "https://github.com/$GitHubRepository/releases/latest/download/latest.json" -ForegroundColor White
} finally {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
}
