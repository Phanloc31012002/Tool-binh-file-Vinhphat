[CmdletBinding()]
param(
    [string]$MachinesFile = (Join-Path $PSScriptRoot 'staff-sync\staff-machines.json'),
    [pscredential]$Credential,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'DanCardCEP'
$product = 'com.locdev.dancard'

function Write-PushLog {
    param([string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Gray)
    if (-not $Quiet) { Write-Host "[Đẩy Công cụ bình] $Message" -ForegroundColor $Color }
}

function Get-StaffMachines {
    if (-not (Test-Path -LiteralPath $MachinesFile)) {
        throw "Không tìm thấy danh sách máy: $MachinesFile"
    }
    $data = Get-Content -LiteralPath $MachinesFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $items = if ($data.machines) { @($data.machines) } else { @($data) }
    $clean = @()
    foreach ($item in $items) {
        $computer = ([string]$item.computer).Trim()
        $profile = ([string]$item.profile).Trim()
        if ([string]::IsNullOrWhiteSpace($computer) -or [string]::IsNullOrWhiteSpace($profile)) { continue }
        if ($computer -match '^TEN-MAY-' -or $profile -match '^ten-user-') { continue }
        if ($computer -notmatch '^[A-Za-z0-9._-]+$') { throw "Tên máy không hợp lệ: $computer" }
        if ($profile -match '[\\/:*?"<>|]') { throw "Tên profile Windows không hợp lệ: $profile" }
        $clean += [pscustomobject]@{ computer = $computer; profile = $profile }
    }
    if ($clean.Count -eq 0) {
        throw 'Danh sách máy đang trống. Điền computer và profile vào staff-sync\staff-machines.json.'
    }
    return $clean
}

function New-RemoteDrive {
    param([string]$Computer, [pscredential]$NetworkCredential, [int]$Index)
    $name = ('DC{0:D3}' -f $Index)
    $root = "\\$Computer\c$"
    if ($NetworkCredential) {
        New-PSDrive -Name $name -PSProvider FileSystem -Root $root -Credential $NetworkCredential -Scope Script -ErrorAction Stop | Out-Null
    } else {
        New-PSDrive -Name $name -PSProvider FileSystem -Root $root -Scope Script -ErrorAction Stop | Out-Null
    }
    return $name
}

if (-not (Test-Path -LiteralPath (Join-Path $source 'CSXS\manifest.xml'))) {
    throw 'Không tìm thấy panel nguồn DanCardCEP hợp lệ.'
}
[xml]$sourceManifest = Get-Content -LiteralPath (Join-Path $source 'CSXS\manifest.xml') -Raw -Encoding UTF8
if ($sourceManifest.ExtensionManifest.ExtensionBundleId -ne $product) {
    throw 'Panel nguồn không đúng mã sản phẩm.'
}
$sourceVersion = [string]$sourceManifest.ExtensionManifest.ExtensionBundleVersion
$machines = Get-StaffMachines
$results = @()

for ($index = 0; $index -lt $machines.Count; $index++) {
    $machine = $machines[$index]
    $drive = $null
    $destination = $null
    $backup = $null
    $stage = $null
    try {
        Write-PushLog "Đang đẩy v$sourceVersion tới $($machine.computer) ($($machine.profile))…"
        $drive = New-RemoteDrive -Computer $machine.computer -NetworkCredential $Credential -Index $index
        $extensions = "${drive}:\Users\$($machine.profile)\AppData\Roaming\Adobe\CEP\extensions"
        New-Item -ItemType Directory -Path $extensions -Force | Out-Null
        $destination = Join-Path $extensions 'DanCardCEP'
        $stage = Join-Path $extensions ('DanCardCEP.__incoming__' + [Guid]::NewGuid().ToString('N'))
        Copy-Item -LiteralPath $source -Destination $stage -Recurse -Force
        if (-not (Test-Path -LiteralPath (Join-Path $stage 'CSXS\manifest.xml'))) {
            throw 'Không tạo được folder tạm hợp lệ trên máy nhân viên.'
        }
        [xml]$stageManifest = Get-Content -LiteralPath (Join-Path $stage 'CSXS\manifest.xml') -Raw -Encoding UTF8
        if ($stageManifest.ExtensionManifest.ExtensionBundleId -ne $product) {
            throw 'Bản tạm trên máy nhân viên không đúng mã sản phẩm.'
        }
        if (Test-Path -LiteralPath $destination) {
            $backup = "$destination.backup-$([DateTime]::Now.ToString('yyyyMMddHHmmss'))"
            Move-Item -LiteralPath $destination -Destination $backup -Force
        }
        try {
            Move-Item -LiteralPath $stage -Destination $destination -Force
        } catch {
            if ((-not (Test-Path -LiteralPath $destination)) -and $backup -and (Test-Path -LiteralPath $backup)) {
                Move-Item -LiteralPath $backup -Destination $destination -Force
            }
            throw
        }
        Get-ChildItem -LiteralPath $extensions -Directory -Filter 'DanCardCEP.backup-*' |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip 1 |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        $results += [pscustomobject]@{ Computer = $machine.computer; Profile = $machine.profile; Result = 'Đã cập nhật'; Detail = "v$sourceVersion — có hiệu lực khi Illustrator mở lại" }
        Write-PushLog "Đã cập nhật $($machine.computer)." Green
    } catch {
        if ($stage -and (Test-Path -LiteralPath $stage)) {
            Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
        }
        $results += [pscustomobject]@{ Computer = $machine.computer; Profile = $machine.profile; Result = 'Lỗi'; Detail = $_.Exception.Message }
        Write-PushLog "Không cập nhật được $($machine.computer): $($_.Exception.Message)" Red
    } finally {
        if ($drive) { Remove-PSDrive -Name $drive -Force -ErrorAction SilentlyContinue }
    }
}

if (-not $Quiet) {
    Write-Host ''
    $results | Format-Table -AutoSize
}
$failed = @($results | Where-Object { $_.Result -eq 'Lỗi' }).Count
return [pscustomobject]@{ Total = $results.Count; Failed = $failed; Results = $results }
