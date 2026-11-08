$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot
$dir=Join-Path $repo 'native\video'
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /codepage:65001 "/out:$dir\BongExtendVideo.exe" "$dir\Launcher.cs"
if ($LASTEXITCODE -ne 0) {throw 'Native launcher compilation failed'}
$wpf=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\WPF'
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /codepage:65001 "/reference:$wpf\UIAutomationClient.dll" "/reference:$wpf\UIAutomationTypes.dll" "/reference:$wpf\WindowsBase.dll" "/out:$dir\BongExtendBrowser.exe" "$dir\BrowserShortcut.cs"
if ($LASTEXITCODE -ne 0) {throw 'Browser shortcut helper compilation failed'}
New-Item -ItemType Directory -Force -Path (Join-Path $repo '.output') | Out-Null
Compress-Archive -Path "$dir\BrowserShortcut.cs","$dir\BongExtendBrowser.exe","$dir\host.py","$dir\BongExtendVideo.exe","$dir\Launcher.cs","$dir\install.ps1","$dir\install.cmd","$dir\README.txt",(Join-Path $repo 'LICENSE') -DestinationPath (Join-Path $repo '.output\bongextend-video-helper-windows.zip') -Force
