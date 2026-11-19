# BongExtend 규칙·분석 로직(Rust, native/core-wasm → WebAssembly)을 빌드해서 src/modules/core-wasm-bytes.js 로 담아요.
# 매니페스트(웹 접근 리소스)를 늘리지 않으려고 WebAssembly 파일을 글자(base64)로 넣어요.
# Rust 코드(native/core-wasm)를 고쳤을 때만 다시 돌리면 돼요. 결과 파일은 저장소에 함께 올려요.
# -Experiments: 이식 실험 함수(extra.rs)까지 넣은 엔진을 만들어요(측정 전용, 저장소에 올리지 않아요).
param([switch]$Experiments)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot
$crate=Join-Path $repo 'native\core-wasm'
$cargo=(Get-Command cargo -ErrorAction SilentlyContinue).Source
if (!$cargo -and (Test-Path "$env:USERPROFILE\.cargo\bin\cargo.exe")) { $cargo="$env:USERPROFILE\.cargo\bin\cargo.exe" }
if (!$cargo) {throw 'Rust (cargo) is required'}
$features = if ($Experiments) { @('--features', 'experiments') } else { @() }
# WebAssembly SIMD(동시 처리 명령)를 켜요. 크롬 91부터 되고 이 확장은 크롬 109 이상만 받아요. 찾기(memchr)가 여러 바이트를 한 번에 봐서 빨라져요.
$oldFlags = $env:RUSTFLAGS
$env:RUSTFLAGS = '-C target-feature=+simd128'
try { & $cargo build --release --target wasm32-unknown-unknown --manifest-path (Join-Path $crate 'Cargo.toml') @features } finally { $env:RUSTFLAGS = $oldFlags }
if ($LASTEXITCODE -ne 0) {throw 'WebAssembly build failed'}
$wasm=Join-Path $crate 'target\wasm32-unknown-unknown\release\bongextend_core.wasm'
$bytes=[IO.File]::ReadAllBytes($wasm)
$hash=(Get-FileHash -LiteralPath $wasm -Algorithm SHA256).Hash.ToLower()
$b64=[Convert]::ToBase64String($bytes)
$out=Join-Path $repo 'src\modules\core-wasm-bytes.js'
$text="// 자동 생성 파일이에요. 고치지 말고 scripts/build-core-wasm.ps1 을 다시 돌려요.`n// 소스: native/core-wasm (Rust), 크기 $($bytes.Length) 바이트, SHA256 $hash`nexport const CORE_WASM_SHA256 = `"$hash`";`nexport const CORE_WASM_BASE64 = `"$b64`";`n"
[IO.File]::WriteAllText($out,$text,(New-Object Text.UTF8Encoding($false)))
Write-Host "Wrote $out ($($bytes.Length) bytes)"
