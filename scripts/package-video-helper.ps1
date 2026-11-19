$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot
$dir=Join-Path $repo 'native\video'
$rustDir=Join-Path $repo 'native\video-rs'
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /codepage:65001 "/out:$dir\BongExtendVideo.exe" "$dir\Launcher.cs"
if ($LASTEXITCODE -ne 0) {throw 'Native launcher compilation failed'}
# Rust 보조 프로그램(기본). 실행기는 이게 없으면 예전 파이썬(host.py)으로 돌아가요.
$cargo=(Get-Command cargo -ErrorAction SilentlyContinue).Source
if (!$cargo -and (Test-Path "$env:USERPROFILE\.cargo\bin\cargo.exe")) { $cargo="$env:USERPROFILE\.cargo\bin\cargo.exe" }
if (!$cargo) {throw 'Rust (cargo) is required to build the video helper'}
& $cargo build --release --manifest-path (Join-Path $rustDir 'Cargo.toml') --bin bongextend-video-host
if ($LASTEXITCODE -ne 0) {throw 'Rust video helper build failed'}
$rustExe=Join-Path $rustDir 'target\release\bongextend-video-host.exe'
New-Item -ItemType Directory -Force -Path (Join-Path $repo '.output') | Out-Null
Compress-Archive -Path $rustExe,"$dir\host.py","$dir\BongExtendVideo.exe","$dir\Launcher.cs","$dir\install.ps1","$dir\install.cmd","$dir\README.txt",(Join-Path $repo 'LICENSE') -DestinationPath (Join-Path $repo '.output\bongextend-video-helper-windows.zip') -Force
