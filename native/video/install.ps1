param([string]$ExtensionId)
$ErrorActionPreference='Stop'
if (!$ExtensionId) {
 $file=Get-ChildItem -LiteralPath ([IO.Path]::Combine($env:USERPROFILE,'Downloads')) -Filter 'bongextend-video-connection*.json' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
 if ($file) { $ExtensionId=(Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json).extensionId }
}
if ($ExtensionId -notmatch '^[a-p]{32}$') { throw 'Open the video downloader tab and download the connection file first.' }
$dest=Join-Path $env:LOCALAPPDATA 'BongExtend\video-helper'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$python=(Get-Command python -ErrorAction Stop).Source
& $python -c "import sys; assert sys.version_info >= (3,10)"
if ($LASTEXITCODE -ne 0) {throw 'Python 3.10 or newer is required.'}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'host.py') -Destination $dest -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'BongExtendVideo.exe') -Destination $dest -Force
[IO.File]::WriteAllText((Join-Path $dest 'python.txt'),$python)
function Get-Asset($repo,$name) {
 $release=Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
 $asset=$release.assets | Where-Object name -eq $name | Select-Object -First 1
 if (!$asset -or $asset.digest -notmatch '^sha256:([a-f0-9]{64})$') {throw "Missing published SHA256: $name"}
 $hash=$Matches[1];$path=Join-Path $dest $name
 if (!(Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower() -ne $hash) {
  Write-Host "Downloading $name...";Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $path -UseBasicParsing
 }
 if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower() -ne $hash) {throw "SHA256 mismatch: $name"}
 return $path
}
Get-Asset 'yt-dlp/yt-dlp' 'yt-dlp.exe' | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $dest 'ffmpeg.exe'))) {
 $zip=Get-Asset 'yt-dlp/FFmpeg-Builds' 'ffmpeg-master-latest-win64-gpl.zip'
 $unpack=Join-Path $dest 'ffmpeg-package';Expand-Archive -LiteralPath $zip -DestinationPath $unpack -Force
 foreach ($name in @('ffmpeg.exe','ffprobe.exe')) { $exe=Get-ChildItem -LiteralPath $unpack -Recurse -Filter $name | Select-Object -First 1;Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $dest $name) -Force }
}
$node=Get-Command node -ErrorAction SilentlyContinue
if ($node) {$runtime='node:'+$node.Source} else {
 $zip=Get-Asset 'denoland/deno' 'deno-x86_64-pc-windows-msvc.zip';Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force;$runtime='deno:'+(Join-Path $dest 'deno.exe')
}
@{runtime=$runtime} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dest 'config.json') -Encoding UTF8
$manifest=Join-Path $dest 'com.bongextend.video.json'
$origins=@("chrome-extension://$ExtensionId/")
if (Test-Path -LiteralPath $manifest) { $origins+=@((Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).allowed_origins) }
$nativeManifest=@{name='com.bongextend.video';description='BongExtend local video downloader';path=(Join-Path $dest 'BongExtendVideo.exe');type='stdio';allowed_origins=@($origins | Sort-Object -Unique)} | ConvertTo-Json
[IO.File]::WriteAllText($manifest,$nativeManifest,(New-Object Text.UTF8Encoding($false)))
$reg='HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.bongextend.video'
New-Item -Path $reg -Force | Out-Null;Set-Item -LiteralPath $reg -Value $manifest
Write-Host 'Installed. Return to BongExtend and press Connect.'
