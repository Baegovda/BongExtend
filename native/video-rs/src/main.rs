//! BongExtend 영상 보조 프로그램(네이티브 메시징 호스트). native/video/host.py 를 Rust로 옮긴 것이에요.
//! 표준 입력으로 4바이트 길이 + JSON 요청을 받고, 표준 출력으로 같은 틀의 답만 보내요(다른 글자는 절대 쓰지 않아요).

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use video_host::*;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// 표준 출력은 여러 스레드가 함께 써서 한 번에 한 메시지만 쓰게 잠가요.
static OUT_LOCK: Mutex<()> = Mutex::new(());

fn emit(value: &Value) {
    let _guard = OUT_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(&frame(value));
    let _ = out.flush();
}

fn error(message: &str) -> Value {
    json!({"type": "error", "message": cut(message, 500)})
}

struct State {
    pid: Mutex<Option<u32>>,
    cancelled: AtomicBool,
}

fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"]).stdout(Stdio::null()).stderr(Stdio::null()).creation_flags(CREATE_NO_WINDOW).status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill").arg(pid.to_string()).status();
    }
}

fn stop_process(state: &State) {
    state.cancelled.store(true, Ordering::SeqCst);
    let pid = *state.pid.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(pid) = pid {
        kill_tree(pid);
    }
}

fn download(message: Value, base: PathBuf, out: PathBuf, state: Arc<State>) {
    let result = (|| -> Result<String, String> {
        let args = command(&message, &base, &out, &system_resolve)?;
        if state.cancelled.load(Ordering::SeqCst) {
            return Err("다운로드를 중단했어요.".to_string());
        }
        std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        let mut cmd = Command::new(&args[0]);
        cmd.args(&args[1..]).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        let mut child = cmd.spawn().map_err(|e| e.to_string())?;
        *state.pid.lock().unwrap_or_else(|e| e.into_inner()) = Some(child.id());
        if state.cancelled.load(Ordering::SeqCst) {
            stop_process(&state);
        }
        emit(&json!({"type": "started"}));
        // 파이썬처럼 표준 출력과 오류 출력을 한 줄 흐름으로 합쳐 읽어요(진행·파일 이름·오류 줄이 어느 쪽으로 와도 잡게).
        let (sender, lines) = std::sync::mpsc::channel::<String>();
        let mut readers = Vec::new();
        let pipes: Vec<Box<dyn Read + Send>> = [child.stdout.take().map(|p| Box::new(p) as Box<dyn Read + Send>), child.stderr.take().map(|p| Box::new(p) as Box<dyn Read + Send>)].into_iter().flatten().collect();
        for pipe in pipes {
            let sender = sender.clone();
            readers.push(std::thread::spawn(move || {
                for line in BufReader::new(pipe).split(b'\n').map_while(Result::ok) {
                    if sender.send(String::from_utf8_lossy(&line).to_string()).is_err() {
                        break;
                    }
                }
            }));
        }
        drop(sender);
        let mut filename = String::new();
        let mut errors = Vec::<String>::new();
        for line in lines {
            if line.starts_with("BE_PROGRESS:") {
                if let Some(percent) = progress_percent(&line) {
                    emit(&json!({"type": "progress", "percent": percent}));
                }
            } else if line.starts_with("BE_FILE:") {
                filename = line.trim()[8..].to_string();
            } else if line.starts_with("ERROR:") {
                errors.push(cut(line.trim(), 400));
            }
        }
        for reader in readers {
            let _ = reader.join();
        }
        let status = child.wait().map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(errors.last().cloned().unwrap_or_else(|| "다운로드가 중단됐어요.".to_string()));
        }
        if filename.is_empty() || !Path::new(&filename).is_file() {
            return Err("완료된 파일을 확인하지 못했어요.".to_string());
        }
        Ok(filename)
    })();
    *state.pid.lock().unwrap_or_else(|e| e.into_inner()) = None;
    match result {
        Ok(filename) => emit(&json!({"type": "done", "filename": filename})),
        Err(message) => emit(&error(&message)),
    }
}

fn read_exact_or_end(input: &mut impl Read, buf: &mut [u8]) -> bool {
    let mut read = 0;
    while read < buf.len() {
        match input.read(&mut buf[read..]) {
            Ok(0) | Err(_) => return false,
            Ok(n) => read += n,
        }
    }
    true
}

fn handle(message: &Value, base: &Path, out: &Path, home: &Path, state: &Arc<State>, worker: &mut Option<JoinHandle<()>>) -> Result<(), String> {
    let kind = message.as_object().ok_or_else(|| "'list' object has no attribute 'get'".to_string())?.get("type").and_then(Value::as_str).unwrap_or("");
    match kind {
        "ping" => emit(&json!({"type": "ready", "version": 2, "folder": out.display().to_string()})),
        "codex-usage" => emit(&codex_usage(&home.join(".codex").join("sessions"))),
        "usage-local" => emit(&usage_local(home, &UreqHttp, now_seconds())),
        "cancel" => stop_process(state),
        "download" => {
            if worker.as_ref().is_some_and(|w| !w.is_finished()) {
                return Err("진행 중인 다운로드가 있어요.".to_string());
            }
            state.cancelled.store(false, Ordering::SeqCst);
            let (message, base, out, state) = (message.clone(), base.to_path_buf(), out.to_path_buf(), state.clone());
            *worker = Some(std::thread::spawn(move || {
                // 한 요청이 잘못돼도 프로그램 전체가 멈추지 않게 붙잡아요.
                if std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| download(message, base, out, state))).is_err() {
                    emit(&error("다운로드 중 예기치 못한 오류가 났어요."));
                }
            }));
        }
        _ => return Err("지원하지 않는 요청이에요.".to_string()),
    }
    Ok(())
}

fn main() {
    let base = std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)).unwrap_or_else(|| PathBuf::from("."));
    let home = home_dir();
    let out = output_folder(&home);
    let state = Arc::new(State { pid: Mutex::new(None), cancelled: AtomicBool::new(false) });
    let mut worker: Option<JoinHandle<()>> = None;
    let mut input = std::io::stdin().lock();
    loop {
        let mut size = [0u8; 4];
        if !read_exact_or_end(&mut input, &mut size) {
            break;
        }
        let length = u32::from_le_bytes(size);
        if length > MAX_MESSAGE {
            break;
        }
        let mut raw = vec![0u8; length as usize];
        if !read_exact_or_end(&mut input, &mut raw) {
            break;
        }
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match serde_json::from_slice::<Value>(&raw) {
            Ok(message) => handle(&message, &base, &out, &home, &state, &mut worker),
            Err(e) => Err(e.to_string()),
        }));
        match outcome {
            Ok(Ok(())) => {}
            Ok(Err(message)) => emit(&error(&message)),
            Err(_) => emit(&error("요청을 처리하지 못했어요.")),
        }
    }
    stop_process(&state);
}
