//! 골든 테스트: 같은 요청을 예전 파이썬 보조 프로그램(native/video/host.py)과 새 Rust 프로그램에 보내고 답이 같은지 봐요.
//! 파이썬이 없는 PC에서는 Rust 쪽 답이 예상과 맞는지만 확인해요.

use serde_json::{json, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

fn framed(messages: &[Vec<u8>]) -> Vec<u8> {
    let mut out = Vec::new();
    for body in messages {
        out.extend((body.len() as u32).to_le_bytes());
        out.extend(body);
    }
    out
}

fn parse_frames(mut raw: &[u8]) -> Vec<Value> {
    let mut out = Vec::new();
    while raw.len() >= 4 {
        let n = u32::from_le_bytes(raw[..4].try_into().unwrap()) as usize;
        assert!(raw.len() >= 4 + n, "잘린 응답이에요");
        out.push(serde_json::from_slice(&raw[4..4 + n]).expect("응답은 JSON이어야 해요"));
        raw = &raw[4 + n..];
    }
    assert!(raw.is_empty(), "틀 밖의 글자가 섞였어요");
    out
}

fn run(program: &str, args: &[&str], home: &Path, input: &[u8]) -> Vec<Value> {
    let mut child = Command::new(program)
        .args(args)
        .env("USERPROFILE", home)
        .env("HOME", home)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap_or_else(|e| panic!("{program} 실행 실패: {e}"));
    child.stdin.take().unwrap().write_all(input).unwrap();
    let output = child.wait_with_output().unwrap();
    parse_frames(&output.stdout)
}

fn python() -> Option<String> {
    for name in ["python", "python3"] {
        let ok = Command::new(name).args(["-c", "import sys; assert sys.version_info >= (3,10)"]).stdout(Stdio::null()).stderr(Stdio::null()).status();
        if ok.is_ok_and(|s| s.success()) {
            return Some(name.to_string());
        }
    }
    None
}

fn fixture_home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("bong-golden-{name}-{}", std::process::id()));
    let day = home.join(".codex").join("sessions").join("2026").join("11").join("19");
    std::fs::create_dir_all(&day).unwrap();
    let record = json!({"timestamp": "2026-11-19T02:00:00Z", "payload": {"rate_limits": {"primary": {"used_percent": 42.5, "window_minutes": 300, "resets_at": 1794000000u64, "extra": "x"}, "secondary": null}}, "text": "private"});
    std::fs::write(day.join("rollout-a.jsonl"), format!("{record}\n")).unwrap();
    home
}

/// 오류 문구가 언어마다 달라질 수밖에 없는 경우(잘못된 JSON 등)는 종류만 비교해요.
fn normalize(values: Vec<Value>, loose_errors: &[usize]) -> Vec<Value> {
    values.into_iter().enumerate().map(|(i, mut v)| {
        if loose_errors.contains(&i) && v["type"] == "error" {
            v["message"] = json!("…");
        }
        v
    }).collect()
}

#[test]
fn same_answers_as_the_python_helper() {
    let home = fixture_home("same");
    let messages: Vec<Vec<u8>> = vec![
        br#"{"type":"ping"}"#.to_vec(),
        br#"{"type":"codex-usage"}"#.to_vec(),
        br#"{"type":"usage-local"}"#.to_vec(),
        br#"{"type":"collapse-tabs","url":"https://chzzk.naver.com/live/test"}"#.to_vec(),
        br#"{"type":"nope"}"#.to_vec(),
        b"{not json".to_vec(),
        br#"{"type":"cancel"}"#.to_vec(),
    ];
    let input = framed(&messages);
    let rust = run(env!("CARGO_BIN_EXE_bongextend-video-host"), &[], &home, &input);
    let folder = home.join("Downloads").join("BongExtend").display().to_string();
    let expected_rust = vec![
        json!({"type": "ready", "version": 2, "folder": folder}),
        json!({"type": "codex-usage", "primary": {"used_percent": 42.5, "window_minutes": 300, "resets_at": 1794000000u64}, "secondary": null, "recordedAt": "2026-11-19T02:00:00Z"}),
        json!({"type": "usage-local", "claude": {"status": "none"}, "codex": {"api": {"status": "none"}, "log": {"type": "codex-usage", "primary": {"used_percent": 42.5, "window_minutes": 300, "resets_at": 1794000000u64}, "secondary": null, "recordedAt": "2026-11-19T02:00:00Z"}}}),
        json!({"type": "error", "message": "지원하지 않는 요청이에요."}),
        json!({"type": "error", "message": "지원하지 않는 요청이에요."}),
        json!({"type": "error", "message": "…"}),
    ];
    assert_eq!(normalize(rust.clone(), &[5]), expected_rust);
    match python() {
        Some(py) => {
            let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("video").join("host.py");
            let old = run(&py, &["-u", script.to_str().unwrap()], &home, &input);
            assert_eq!(normalize(rust, &[5]), normalize(old, &[5]), "파이썬과 Rust의 답이 달라요");
        }
        None => eprintln!("파이썬이 없어서 Rust 쪽만 확인했어요."),
    }
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn bad_url_downloads_fail_the_same_way() {
    let home = fixture_home("bad-url");
    // 받기는 따로 도는 작업이라, 답이 올 때까지 입력을 열어 두고 기다려요(빨리 닫으면 답 전에 끝날 수 있어요).
    let cases = |program: &str, args: &[&str]| -> Vec<Vec<Value>> {
        [br#"{"type":"download","url":"file:///C:/secret"}"#.to_vec(), br#"{"type":"download","url":"https://youtube.com/playlist?list=abc"}"#.to_vec()]
            .into_iter()
            .map(|message| conversation(program, args, &home, &home, &[(message, &finished)]))
            .collect()
    };
    let rust = cases(env!("CARGO_BIN_EXE_bongextend-video-host"), &[]);
    assert_eq!(rust, vec![
        vec![json!({"type": "error", "message": "http 또는 https 영상 페이지 주소를 입력해 주세요."})],
        vec![json!({"type": "error", "message": "올바른 YouTube 영상 주소가 아니에요."})],
    ]);
    if let Some(py) = python() {
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("video").join("host.py");
        assert_eq!(rust, cases(&py, &["-u", script.to_str().unwrap()]));
    }
    let _ = std::fs::remove_dir_all(&home);
}

#[test]
fn oversized_or_cut_messages_end_quietly() {
    let home = fixture_home("oversized");
    let mut too_big = (70_000u32).to_le_bytes().to_vec();
    too_big.extend(vec![b' '; 10]);
    assert!(run(env!("CARGO_BIN_EXE_bongextend-video-host"), &[], &home, &too_big).is_empty());
    assert!(run(env!("CARGO_BIN_EXE_bongextend-video-host"), &[], &home, &[5, 0]).is_empty());
    let _ = std::fs::remove_dir_all(&home);
}

// ---- 받기 흐름: 가짜 yt-dlp를 물린 같은 폴더에서 두 프로그램을 돌려요 ----

use std::io::Read;
use std::sync::mpsc;
use std::time::{Duration, Instant};

type Until<'a> = &'a dyn Fn(&[Value]) -> bool;

/// 표준 입력을 열어 둔 채(닫으면 진행 중인 받기가 멈춰요) 답을 하나씩 읽어요.
fn conversation(program: &str, args: &[&str], home: &Path, dir: &Path, steps: &[(Vec<u8>, Until)]) -> Vec<Value> {
    let mut child = Command::new(program).args(args).current_dir(dir).env("USERPROFILE", home).env("HOME", home)
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let mut stdout = child.stdout.take().unwrap();
    let (tx, rx) = mpsc::channel::<Value>();
    std::thread::spawn(move || loop {
        let mut head = [0u8; 4];
        if stdout.read_exact(&mut head).is_err() { break; }
        let mut body = vec![0u8; u32::from_le_bytes(head) as usize];
        if stdout.read_exact(&mut body).is_err() { break; }
        if tx.send(serde_json::from_slice(&body).unwrap()).is_err() { break; }
    });
    let mut seen = Vec::new();
    for (message, done) in steps {
        stdin.write_all(&framed(std::slice::from_ref(message))).unwrap();
        stdin.flush().unwrap();
        let end = Instant::now() + Duration::from_secs(20);
        while !done(&seen) {
            match rx.recv_timeout(end.saturating_duration_since(Instant::now())) {
                Ok(v) => seen.push(v),
                Err(_) => panic!("{program}: 답을 기다리다 시간이 지났어요. 지금까지: {seen:?}"),
            }
        }
    }
    drop(stdin);
    let _ = child.wait();
    seen
}

fn workspace(name: &str) -> (PathBuf, PathBuf) {
    let dir = std::env::temp_dir().join(format!("bong-golden-dl-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let exe = if cfg!(windows) { ".exe" } else { "" };
    std::fs::copy(env!("CARGO_BIN_EXE_bongextend-video-host"), dir.join(format!("bongextend-video-host{exe}"))).unwrap();
    std::fs::copy(env!("CARGO_BIN_EXE_fake-ytdlp"), dir.join("yt-dlp.exe")).unwrap();
    std::fs::copy(Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("video").join("host.py"), dir.join("host.py")).unwrap();
    std::fs::write(dir.join("config.json"), "\u{feff}{\"runtime\": \"node:node.exe\"}").unwrap();
    let home = dir.join("home");
    std::fs::create_dir_all(&home).unwrap();
    (dir, home)
}

fn finished(values: &[Value]) -> bool {
    values.last().is_some_and(|v| v["type"] == "done" || v["type"] == "error")
}

fn download_cases(program: &str, args: &[&str], dir: &Path, home: &Path) -> Vec<Vec<Value>> {
    let ok = br#"{"type":"download","url":"https://youtu.be/aqz-KE-bpKQ","quality":"audio"}"#.to_vec();
    let fail = br#"{"type":"download","url":"https://youtu.be/failfailfai"}"#.to_vec();
    let slow = br#"{"type":"download","url":"https://youtu.be/slowslowslo"}"#.to_vec();
    let started = |v: &[Value]| v.iter().any(|x| x["type"] == "progress");
    let refused = |v: &[Value]| v.iter().any(|x| x["type"] == "error");
    let stopped = |v: &[Value]| v.iter().filter(|x| x["type"] == "error").count() >= 2;
    vec![
        conversation(program, args, home, dir, &[(ok, &finished)]),
        conversation(program, args, home, dir, &[(fail, &finished)]),
        // 받는 중에 두 번째 받기 요청은 거절하고, 취소하면 멈춰요.
        conversation(program, args, home, dir, &[(slow.clone(), &started), (slow, &refused), (br#"{"type":"cancel"}"#.to_vec(), &stopped)]),
    ]
}

#[test]
fn downloads_progress_fail_and_cancel_like_the_python_helper() {
    let (dir, home) = workspace("flow");
    let exe = dir.join(if cfg!(windows) { "bongextend-video-host.exe" } else { "bongextend-video-host" });
    let rust = download_cases(exe.to_str().unwrap(), &[], &dir, &home);
    let file = home.join("Downloads").join("BongExtend").join("가짜 영상 [aqz-KE-bpKQ].mp3").display().to_string();
    assert_eq!(rust[0], vec![json!({"type": "started"}), json!({"type": "progress", "percent": 0.0}), json!({"type": "progress", "percent": 12.5}), json!({"type": "progress", "percent": 55.5}), json!({"type": "progress", "percent": 100.0}), json!({"type": "done", "filename": file})]);
    assert_eq!(rust[1], vec![json!({"type": "started"}), json!({"type": "error", "message": "ERROR: [youtube] failfailfai: Video unavailable"})]);
    assert_eq!(rust[2][0], json!({"type": "started"}));
    assert!(rust[2].contains(&json!({"type": "error", "message": "진행 중인 다운로드가 있어요."})));
    assert_eq!(rust[2].last().unwrap(), &json!({"type": "error", "message": "다운로드가 중단됐어요."}));
    if let Some(py) = python() {
        let old = download_cases(&py, &["-u", "host.py"], &dir, &home);
        assert_eq!(rust, old, "받기 흐름의 답이 파이썬과 달라요");
    }
    let _ = std::fs::remove_dir_all(&dir);
}
