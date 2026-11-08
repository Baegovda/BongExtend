$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot
$dir=Join-Path $repo 'native\video'
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe "/out:$dir\BongExtendVideo.exe" "$dir\Launcher.cs"
if ($LASTEXITCODE -ne 0) {throw 'Native launcher compilation failed'}
New-Item -ItemType Directory -Force -Path (Join-Path $repo '.output') | Out-Null
Compress-Archive -Path "$dir\host.py","$dir\BongExtendVideo.exe","$dir\Launcher.cs","$dir\install.ps1","$dir\install.cmd","$dir\README.txt",(Join-Path $repo 'LICENSE') -DestinationPath (Join-Path $repo '.output\bongextend-video-helper-windows.zip') -Force
