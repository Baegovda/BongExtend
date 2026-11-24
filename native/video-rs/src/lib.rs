//! BongExtend 영상 보조 프로그램(네이티브 메시징 호스트)의 규칙.
//! native/video/host.py 를 그대로 옮겼어요. 메시지 모양·검사 규칙·오류 문구가 같아야 해요(골든 테스트로 비교).
//! 셸은 쓰지 않고, 로그인 토큰은 공식 두 주소(api.anthropic.com, chatgpt.com)로만 보내고 돌려주지 않아요.

use serde_json::{json, Map, Value};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_MESSAGE: u32 = 65536;
pub const QUALITIES: [&str; 5] = ["720", "1080", "1440", "2160", "audio"];
pub const USAGE_HOSTS: [&str; 2] = ["api.anthropic.com", "chatgpt.com"];

/// 사용자 폴더(파이썬 pathlib.Path.home()과 같은 규칙: 윈도에서는 USERPROFILE, 그 밖에서는 HOME).
pub fn home_dir() -> PathBuf {
    let keys: &[&str] = if cfg!(windows) { &["USERPROFILE", "HOME"] } else { &["HOME", "USERPROFILE"] };
    for key in keys {
        if let Some(value) = std::env::var_os(key) {
            if !value.is_empty() {
                return PathBuf::from(value);
            }
        }
    }
    PathBuf::from(".")
}

pub fn output_folder(home: &Path) -> PathBuf {
    home.join("Downloads").join("BongExtend")
}

/// 문자 단위로 자르기(파이썬 str[:n] 과 같아요).
pub fn cut(text: &str, n: usize) -> String {
    text.chars().take(n).collect()
}

// ---- 주소 검사 ----

fn is_global_v4(ip: Ipv4Addr) -> bool {
    let o = ip.octets();
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_multicast()
        || o[0] == 0
        || (o[0] == 100 && (o[1] & 0xc0) == 64) // 100.64.0.0/10 공유 주소
        || (o[0] == 192 && o[1] == 0 && o[2] == 0) // 192.0.0.0/24
        || (o[0] == 198 && (o[1] & 0xfe) == 18) // 198.18.0.0/15 측정용
        || o[0] >= 240)
}

fn is_global_v6(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return is_global_v4(v4);
    }
    let s = ip.segments();
    !(ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        || (s[0] & 0xffc0) == 0xfe80 // 링크 로컬
        || (s[0] & 0xfe00) == 0xfc00 // 고유 로컬
        || (s[0] == 0x2001 && s[1] == 0x0db8) // 문서용
        || (s[0] == 0x0064 && s[1] == 0xff9b) // 64:ff9b::/96
        || (s[0] == 0x2001 && s[1] < 0x0200)) // 2001::/23 특수 용도
}

pub fn is_global(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_global_v4(v4),
        IpAddr::V6(v6) => is_global_v6(v6),
    }
}

/// 실제 이름 풀이. 시험에서는 가짜 풀이를 넣어요.
pub fn system_resolve(host: &str, port: u16) -> Vec<IpAddr> {
    (host, port).to_socket_addrs().map(|it| it.map(|a| a.ip()).collect()).unwrap_or_default()
}

fn youtube_id_ok(key: &str) -> bool {
    key.len() == 11 && key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

/// 영상 페이지 주소 검사(host.py video_url). 유튜브는 영상 하나 주소로 고치고, 그 밖은 공개 인터넷 주소만 받아요.
pub fn video_url(value: &Value, resolve: &dyn Fn(&str, u16) -> Vec<IpAddr>) -> Result<String, String> {
    let text = match value {
        Value::String(s) => s.clone(),
        Value::Null => "None".to_string(),
        other => other.to_string(),
    };
    let bad = || "http 또는 https 영상 페이지 주소를 입력해 주세요.".to_string();
    let parsed = url::Url::parse(&text).map_err(|_| bad())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(bad());
    }
    let host = match parsed.host_str() {
        Some(h) if !h.is_empty() => h.trim_start_matches('[').trim_end_matches(']').to_ascii_lowercase(),
        _ => return Err(bad()),
    };
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(bad());
    }
    let path = parsed.path().to_string();
    let key = if matches!(host.as_str(), "youtube.com" | "www.youtube.com" | "m.youtube.com") {
        if path == "/watch" {
            parsed.query_pairs().find(|(k, _)| k == "v").map(|(_, v)| v.into_owned()).unwrap_or_default()
        } else if path.starts_with("/shorts/") || path.starts_with("/live/") || path.starts_with("/embed/") {
            path.rsplit('/').next().unwrap_or("").to_string()
        } else {
            String::new()
        }
    } else if host == "youtu.be" {
        path.trim_matches('/').to_string()
    } else {
        let port = parsed.port_or_known_default().unwrap_or(if parsed.scheme() == "https" { 443 } else { 80 });
        let addresses = resolve(&host, port);
        if addresses.is_empty() || addresses.iter().any(|ip| !is_global(*ip)) {
            return Err("공개된 인터넷 영상 주소만 지원해요.".to_string());
        }
        return Ok(text);
    };
    if !youtube_id_ok(&key) {
        return Err("올바른 YouTube 영상 주소가 아니에요.".to_string());
    }
    Ok(format!("https://www.youtube.com/watch?v={key}"))
}

/// BOM이 있어도 읽는 JSON 파일(파이썬 utf-8-sig).
pub fn read_json(path: &Path) -> Option<Value> {
    let bytes = fs::read(path).ok()?;
    let text = String::from_utf8(bytes).ok()?;
    serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()
}

/// 영상을 찾은 페이지 주소(출처). yt-dlp --referer 로 넘겨요. http(s)만, 제어 문자 없이, 2000자까지.
pub fn referer(value: Option<&Value>) -> Option<String> {
    let text = value?.as_str()?;
    if text.len() > 2000 || text.chars().any(char::is_control) {
        return None;
    }
    let parsed = url::Url::parse(text).ok()?;
    if !matches!(parsed.scheme(), "http" | "https") || !parsed.username().is_empty() || parsed.password().is_some() {
        return None;
    }
    Some(parsed.to_string())
}

/// yt-dlp가 그 사이트를 몰라서 못 받은 오류인지(이때만 페이지에서 찾은 영상 주소로 다시 해 봐요).
pub fn worth_fallback(error: &str) -> bool {
    let e = error.to_ascii_lowercase();
    ["unsupported url", "no video formats", "unable to extract", "no media found"].iter().any(|k| e.contains(k))
}

/// 사이트를 몰라서 못 받았을 때 보여 줄 쉬운 안내.
pub fn unsupported_hint(error: &str) -> String {
    if worth_fallback(error) {
        "이 사이트는 주소만으로는 받을 수 없어요. 영상 페이지에서 영상을 잠깐 재생한 뒤, 그 탭에서 BongExtend → 다운로더 → '영상 받기'를 눌러 주세요.".to_string()
    } else {
        error.to_string()
    }
}

/// 확장 프로그램이 페이지에서 찾아 둔 예비 영상 주소 요청. 화질은 원래 요청을 따라요.
pub fn fallback_message(message: &Value) -> Option<Value> {
    let fallback = message.get("fallback")?;
    let url = fallback.get("url")?.as_str()?;
    let mut next = Map::new();
    next.insert("url".into(), json!(url));
    if let Some(r) = fallback.get("referer") {
        next.insert("referer".into(), r.clone());
    }
    if let Some(q) = message.get("quality") {
        next.insert("quality".into(), q.clone());
    }
    Some(Value::Object(next))
}

/// yt-dlp 실행 인자(host.py command). base = 보조 프로그램 폴더, out = 저장 폴더.
pub fn command(message: &Value, base: &Path, out: &Path, resolve: &dyn Fn(&str, u16) -> Vec<IpAddr>) -> Result<Vec<String>, String> {
    let url = video_url(message.get("url").unwrap_or(&Value::Null), resolve)?;
    let quality = match message.get("quality") {
        None => "1080".to_string(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        Some(_) => String::new(),
    };
    if !QUALITIES.contains(&quality.as_str()) {
        return Err("지원하지 않는 화질이에요.".to_string());
    }
    let cfg = read_json(&base.join("config.json")).ok_or_else(|| "설정 파일(config.json)을 읽지 못했어요.".to_string())?;
    let runtime = cfg.get("runtime").and_then(Value::as_str).ok_or_else(|| "'runtime'".to_string())?.to_string();
    let s = |v: &str| v.to_string();
    let mut args = vec![
        base.join("yt-dlp.exe").display().to_string(),
        s("--ignore-config"), s("--encoding"), s("utf-8"), s("--no-playlist"), s("--no-overwrites"), s("--windows-filenames"),
        s("--socket-timeout"), s("20"), s("--retries"), s("2"), s("--fragment-retries"), s("2"),
        s("--ffmpeg-location"), base.display().to_string(), s("--js-runtimes"), runtime, s("--newline"), s("--progress"),
        s("--progress-template"), s("download:BE_PROGRESS:%(progress._percent_str)s"),
        s("--no-simulate"), s("--print"), s("after_move:BE_FILE:%(filepath)s"), s("-P"), out.display().to_string(),
        s("-o"), s("%(title).160B [%(id)s].%(ext)s"),
    ];
    if quality == "audio" {
        args.extend([s("-x"), s("--audio-format"), s("mp3")]);
    } else {
        args.extend([s("-f"), format!("bv*[height<=?{quality}]+ba/b[height<=?{quality}]"), s("--merge-output-format"), s("mkv")]);
    }
    if let Some(page) = referer(message.get("referer")) {
        args.extend([s("--referer"), page]);
    }
    args.extend([s("--"), url]);
    Ok(args)
}

/// yt-dlp 진행 줄에서 퍼센트 숫자(host.py: (\d+(?:\.\d+)?)%).
pub fn progress_percent(line: &str) -> Option<f64> {
    let bytes = line.as_bytes();
    let pct = line.find('%')?;
    let mut start = pct;
    while start > 0 && (bytes[start - 1].is_ascii_digit() || bytes[start - 1] == b'.') {
        start -= 1;
    }
    let mut number = &line[start..pct];
    // "1.2.3%" 같은 모양은 정규식처럼 마지막 올바른 숫자만 써요.
    while number.starts_with('.') {
        number = &number[1..];
    }
    if number.is_empty() || number.ends_with('.') {
        return None;
    }
    let parts: Vec<&str> = number.split('.').collect();
    let number = if parts.len() > 2 { format!("{}.{}", parts[parts.len() - 2], parts[parts.len() - 1]) } else { number.to_string() };
    number.parse::<f64>().ok()
}

// ---- Codex 기록 ----

fn keep(row: Option<&Value>, keys: &[&str]) -> Value {
    match row {
        Some(Value::Object(map)) => {
            let mut out = Map::new();
            for key in keys {
                out.insert((*key).to_string(), map.get(*key).cloned().unwrap_or(Value::Null));
            }
            Value::Object(out)
        }
        _ => Value::Null,
    }
}

fn collect_rollouts(dir: &Path, out: &mut Vec<(SystemTime, PathBuf)>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_dir() {
            collect_rollouts(&path, out);
        } else if kind.is_file() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("rollout-") && name.ends_with(".jsonl") {
                let modified = entry.metadata().and_then(|m| m.modified()).unwrap_or(UNIX_EPOCH);
                out.push((modified, path));
            }
        }
    }
}

/// Codex가 PC에 남긴 기록에서 마지막 사용 한도(퍼센트·초기화 시각)만 읽어요. 대화 내용은 보내지 않아요.
pub fn codex_usage(root: &Path) -> Value {
    let empty = || json!({"type": "codex-usage", "empty": true});
    if !root.is_dir() {
        return empty();
    }
    let mut files = Vec::new();
    collect_rollouts(root, &mut files);
    files.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, path) in files.into_iter().take(12) {
        let Ok(mut handle) = fs::File::open(&path) else { continue };
        let Ok(end) = handle.seek(SeekFrom::End(0)) else { continue };
        if handle.seek(SeekFrom::Start(end.saturating_sub(2_000_000))).is_err() {
            continue;
        }
        let mut raw = Vec::new();
        if handle.read_to_end(&mut raw).is_err() {
            continue;
        }
        let text = String::from_utf8_lossy(&raw);
        for line in text.lines().rev() {
            if !line.contains("\"rate_limits\"") {
                continue;
            }
            let Ok(record) = serde_json::from_str::<Value>(line) else { continue };
            let Some(limits) = record.get("payload").filter(|p| p.is_object()).and_then(|p| p.get("rate_limits")).filter(|l| l.is_object()) else { continue };
            let primary = limits.get("primary");
            let secondary = limits.get("secondary");
            if !primary.is_some_and(Value::is_object) && !secondary.is_some_and(Value::is_object) {
                continue;
            }
            let keys = ["used_percent", "window_minutes", "resets_at"];
            return json!({
                "type": "codex-usage",
                "primary": keep(primary, &keys),
                "secondary": keep(secondary, &keys),
                "recordedAt": record.get("timestamp").cloned().unwrap_or(Value::Null)
            });
        }
    }
    empty()
}

// ---- 로그인으로 한도 읽기 ----

/// HTTP 실패: 상태 번호가 있으면 서버가 답한 오류예요(401·403이면 로그인 만료).
#[derive(Debug)]
pub struct HttpError {
    pub status: Option<u16>,
}

pub trait Http {
    fn get_json(&self, url: &str, headers: &[(&str, String)]) -> Result<Value, HttpError>;
}

/// 공식 두 주소, https만 허용(host.py _get_json). 리디렉션은 따라가지 않아요.
pub fn allowed_usage_url(url: &str) -> bool {
    match url::Url::parse(url) {
        Ok(u) => u.scheme() == "https" && u.host_str().is_some_and(|h| USAGE_HOSTS.contains(&h)),
        Err(_) => false,
    }
}

pub struct UreqHttp;

impl Http for UreqHttp {
    fn get_json(&self, url: &str, headers: &[(&str, String)]) -> Result<Value, HttpError> {
        if !allowed_usage_url(url) {
            return Err(HttpError { status: None });
        }
        let agent = ureq::AgentBuilder::new().redirects(0).timeout(std::time::Duration::from_secs(10)).build();
        let mut request = agent.get(url);
        for (name, value) in headers {
            request = request.set(name, value);
        }
        match request.call() {
            Ok(response) => {
                if !(200..300).contains(&response.status()) {
                    return Err(HttpError { status: Some(response.status()) });
                }
                let mut body = Vec::new();
                response.into_reader().take(300_000).read_to_end(&mut body).map_err(|_| HttpError { status: None })?;
                serde_json::from_slice(&body).map_err(|_| HttpError { status: None })
            }
            Err(ureq::Error::Status(code, _)) => Err(HttpError { status: Some(code) }),
            Err(_) => Err(HttpError { status: None }),
        }
    }
}

fn status_of(error: &HttpError) -> &'static str {
    if matches!(error.status, Some(401) | Some(403)) { "expired" } else { "error" }
}

pub fn now_seconds() -> f64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs_f64()).unwrap_or(0.0)
}

/// 이 PC의 Claude Code 로그인으로 한도(퍼센트·초기화 시각)만 읽어요. 토큰은 돌려주지 않아요.
pub fn claude_usage_local(home: &Path, http: &dyn Http, now: f64) -> Value {
    let cred = read_json(&home.join(".claude").join(".credentials.json"));
    let oauth = cred.as_ref().and_then(|c| c.get("claudeAiOauth")).filter(|o| o.is_object());
    let token = oauth.and_then(|o| o.get("accessToken")).and_then(Value::as_str).filter(|t| !t.is_empty());
    let Some(token) = token else { return json!({"status": "none"}) };
    if let Some(expires) = oauth.and_then(|o| o.get("expiresAt")).and_then(Value::as_f64) {
        if expires / 1000.0 < now {
            return json!({"status": "expired"});
        }
    }
    let headers = [
        ("Authorization", format!("Bearer {token}")),
        ("anthropic-beta", "oauth-2025-04-20".to_string()),
        ("Accept", "application/json".to_string()),
        ("User-Agent", "BongExtend-usage".to_string()),
    ];
    let data = match http.get_json("https://api.anthropic.com/api/oauth/usage", &headers) {
        Ok(data) => data,
        Err(error) => return json!({"status": status_of(&error)}),
    };
    let Value::Object(map) = data else { return json!({"status": "error"}) };
    let mut usage = Map::new();
    for (key, value) in map {
        if let Value::Object(row) = &value {
            if row.contains_key("utilization") {
                usage.insert(key, json!({"utilization": row.get("utilization").cloned().unwrap_or(Value::Null), "resets_at": row.get("resets_at").cloned().unwrap_or(Value::Null)}));
            }
        }
    }
    json!({"status": "ok", "usage": Value::Object(usage)})
}

/// 이 PC의 Codex(ChatGPT) 로그인으로 지금 한도를 읽어요. 토큰은 돌려주지 않아요.
pub fn codex_usage_api(home: &Path, http: &dyn Http) -> Value {
    let auth = read_json(&home.join(".codex").join("auth.json"));
    let tokens = auth.as_ref().and_then(|a| a.get("tokens")).filter(|t| t.is_object());
    let token = tokens.and_then(|t| t.get("access_token")).and_then(Value::as_str).filter(|t| !t.is_empty());
    let Some(token) = token else { return json!({"status": "none"}) };
    let mut headers = vec![
        ("Authorization", format!("Bearer {token}")),
        ("Accept", "application/json".to_string()),
        ("User-Agent", "BongExtend-usage".to_string()),
    ];
    if let Some(account) = tokens.and_then(|t| t.get("account_id")).and_then(Value::as_str).filter(|a| !a.is_empty()) {
        headers.push(("ChatGPT-Account-Id", account.to_string()));
    }
    let data = match http.get_json("https://chatgpt.com/backend-api/wham/usage", &headers) {
        Ok(data) => data,
        Err(error) => return json!({"status": status_of(&error)}),
    };
    let Some(limit) = data.get("rate_limit").filter(|l| l.is_object()) else { return json!({"status": "error"}) };
    let keys = ["used_percent", "limit_window_seconds", "reset_after_seconds", "reset_at"];
    json!({"status": "ok", "data": {
        "plan_type": data.get("plan_type").cloned().unwrap_or(Value::Null),
        "rate_limit": {"primary_window": keep(limit.get("primary_window"), &keys), "secondary_window": keep(limit.get("secondary_window"), &keys)}
    }})
}

pub fn usage_local(home: &Path, http: &dyn Http, now: f64) -> Value {
    json!({
        "type": "usage-local",
        "claude": claude_usage_local(home, http, now),
        "codex": {"api": codex_usage_api(home, http), "log": codex_usage(&home.join(".codex").join("sessions"))}
    })
}

/// 네이티브 메시징 틀: 4바이트 길이(리틀 엔디언) + UTF-8 JSON.
pub fn frame(value: &Value) -> Vec<u8> {
    let body = serde_json::to_vec(value).unwrap_or_else(|_| b"{}".to_vec());
    let mut out = (body.len() as u32).to_le_bytes().to_vec();
    out.extend(body);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;

    fn no_dns(_: &str, _: u16) -> Vec<IpAddr> {
        panic!("YouTube 주소는 이름 풀이를 하지 않아야 해요")
    }

    #[test]
    fn youtube_normalizes_single_video() {
        for url in ["https://youtu.be/aqz-KE-bpKQ?t=10", "https://www.youtube.com/shorts/aqz-KE-bpKQ", "https://www.youtube.com/embed/aqz-KE-bpKQ", "https://m.youtube.com/watch?v=aqz-KE-bpKQ&list=x"] {
            assert_eq!(video_url(&json!(url), &no_dns).unwrap(), "https://www.youtube.com/watch?v=aqz-KE-bpKQ");
        }
        assert!(video_url(&json!("https://youtube.com/playlist?list=abc"), &no_dns).is_err());
    }

    #[test]
    fn invalid_and_private_sources() {
        for url in ["file:///C:/secret", "https://user:pass@example.com/a", "--exec=bad"] {
            assert!(video_url(&json!(url), &no_dns).is_err(), "{url}");
        }
        let local = |_: &str, _: u16| vec![IpAddr::from([127, 0, 0, 1])];
        assert_eq!(video_url(&json!("http://localhost/video.mp4"), &local).unwrap_err(), "공개된 인터넷 영상 주소만 지원해요.");
        for ip in ["10.0.0.1", "192.168.1.2", "172.20.0.1", "169.254.1.1", "100.64.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"] {
            assert!(!is_global(ip.parse().unwrap()), "{ip}");
        }
        for ip in ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"] {
            assert!(is_global(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn public_direct_video_and_quality() {
        let public = |_: &str, _: u16| vec![IpAddr::from([8, 8, 8, 8])];
        assert_eq!(video_url(&json!("https://example.com/video.mp4"), &public).unwrap(), "https://example.com/video.mp4");
        let dir = std::env::temp_dir().join(format!("bong-video-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("config.json"), "\u{feff}{\"runtime\":\"node:node.exe\"}").unwrap();
        let out = dir.join("out");
        let args = command(&json!({"url": "https://youtu.be/aqz-KE-bpKQ", "quality": "2160"}), &dir, &out, &no_dns).unwrap();
        assert!(args.contains(&"bv*[height<=?2160]+ba/b[height<=?2160]".to_string()));
        assert_eq!(args[args.len() - 2], "--");
        assert!(args.contains(&"--no-simulate".to_string()));
        // 한글 제목 파일 이름이 깨지지 않게 yt-dlp 출력을 UTF-8로 받아요.
        assert!(args.windows(2).any(|w| w[0] == "--encoding" && w[1] == "utf-8"));
        assert!(args.contains(&"node:node.exe".to_string()));
        let audio = command(&json!({"url": args.last().unwrap(), "quality": "audio"}), &dir, &out, &no_dns).unwrap();
        assert!(audio.contains(&"mp3".to_string()));
        assert!(command(&json!({"url": args.last().unwrap(), "quality": "--exec=bad"}), &dir, &out, &no_dns).is_err());
        let default = command(&json!({"url": args.last().unwrap()}), &dir, &out, &no_dns).unwrap();
        assert!(default.contains(&"bv*[height<=?1080]+ba/b[height<=?1080]".to_string()));
        // 페이지에서 찾은 영상 주소는 출처 페이지를 --referer 로 함께 넘겨요.
        let message = json!({"url": "https://site.example/page", "quality": "720", "fallback": {"url": "https://cdn.example/v/master.m3u8", "referer": "https://site.example/page?id=1"}});
        let fallback = fallback_message(&message).unwrap();
        assert_eq!(fallback["quality"], "720");
        let hls = command(&fallback, &dir, &out, &public).unwrap();
        assert_eq!(hls.last().unwrap(), "https://cdn.example/v/master.m3u8");
        assert!(hls.windows(2).any(|w| w[0] == "--referer" && w[1] == "https://site.example/page?id=1"));
        assert!(fallback_message(&json!({"url": "https://a.example/"})).is_none());
        assert!(referer(Some(&json!("javascript:alert(1)"))).is_none());
        assert!(referer(Some(&Value::String(format!("https://a.example/{}X: 1", '\n')))).is_none());
        assert!(worth_fallback("ERROR: Unsupported URL: https://a.example/"));
        assert!(!worth_fallback("ERROR: HTTP Error 403: Forbidden"));
        assert!(unsupported_hint("ERROR: Unsupported URL: x").contains("주소만으로는"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn progress_lines() {
        assert_eq!(progress_percent("BE_PROGRESS:  42.5%"), Some(42.5));
        assert_eq!(progress_percent("BE_PROGRESS:100%"), Some(100.0));
        assert_eq!(progress_percent("BE_PROGRESS: N/A%"), None);
        assert_eq!(progress_percent("BE_PROGRESS:  7%  "), Some(7.0));
    }

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("bong-video-{name}-{}-{}", std::process::id(), now_seconds() as u64));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn codex_log_reads_latest_limits_only() {
        let root = temp("codex");
        let day = root.join("2026").join("11").join("11");
        fs::create_dir_all(&day).unwrap();
        let old = json!({"timestamp": "2026-11-11T01:00:00Z", "payload": {"rate_limits": {"primary": {"used_percent": 10.0, "window_minutes": 300, "resets_at": 1}, "secondary": null}}});
        let new = json!({"timestamp": "2026-11-11T02:00:00Z", "payload": {"rate_limits": {"primary": {"used_percent": 42.5, "window_minutes": 300, "resets_at": 1794000000u64, "extra": "x"}, "secondary": {"used_percent": 7, "window_minutes": 10080, "resets_at": 1794600000u64}}}, "text": "private"});
        let empty = json!({"payload": {"rate_limits": {"primary": null, "secondary": null}}});
        fs::write(day.join("rollout-a.jsonl"), format!("{old}\n{new}\n{empty}\n")).unwrap();
        let result = codex_usage(&root);
        assert_eq!(result["primary"], json!({"used_percent": 42.5, "window_minutes": 300, "resets_at": 1794000000u64}));
        assert_eq!(result["secondary"]["window_minutes"], json!(10080));
        assert!(!result.to_string().contains("private"));
        assert_eq!(result["recordedAt"], json!("2026-11-11T02:00:00Z"));
        assert_eq!(codex_usage(Path::new("/definitely/not/here"))["empty"], json!(true));
        let blank = temp("codex-empty");
        assert_eq!(codex_usage(&blank)["empty"], json!(true));
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&blank);
    }

    struct FakeHttp {
        responses: HashMap<String, Result<Value, Option<u16>>>,
        calls: RefCell<Vec<(String, Vec<(String, String)>)>>,
    }

    impl Http for FakeHttp {
        fn get_json(&self, url: &str, headers: &[(&str, String)]) -> Result<Value, HttpError> {
            self.calls.borrow_mut().push((url.to_string(), headers.iter().map(|(k, v)| (k.to_string(), v.clone())).collect()));
            match self.responses.get(url) {
                Some(Ok(v)) => Ok(v.clone()),
                Some(Err(status)) => Err(HttpError { status: *status }),
                None => Err(HttpError { status: None }),
            }
        }
    }

    fn fake(url: &str, response: Result<Value, Option<u16>>) -> FakeHttp {
        FakeHttp { responses: HashMap::from([(url.to_string(), response)]), calls: RefCell::new(Vec::new()) }
    }

    #[test]
    fn claude_reads_percent_only() {
        let home = temp("claude");
        fs::create_dir_all(home.join(".claude")).unwrap();
        fs::write(home.join(".claude/.credentials.json"), json!({"claudeAiOauth": {"accessToken": "secret-token", "expiresAt": 4102444800000u64}}).to_string()).unwrap();
        let http = fake("https://api.anthropic.com/api/oauth/usage", Ok(json!({"five_hour": {"utilization": 12.5, "resets_at": "2026-11-12T10:00:00Z", "x": 1}, "name": "q", "extra": {"is_enabled": false}})));
        let result = claude_usage_local(&home, &http, now_seconds());
        assert_eq!(result, json!({"status": "ok", "usage": {"five_hour": {"utilization": 12.5, "resets_at": "2026-11-12T10:00:00Z"}}}));
        assert!(!result.to_string().contains("secret-token"));
        assert!(http.calls.borrow()[0].1.contains(&("Authorization".to_string(), "Bearer secret-token".to_string())));
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn claude_statuses() {
        let home = temp("claude-status");
        let none = fake("x", Ok(json!({})));
        assert_eq!(claude_usage_local(&home, &none, now_seconds())["status"], "none");
        fs::create_dir_all(home.join(".claude")).unwrap();
        let path = home.join(".claude/.credentials.json");
        fs::write(&path, json!({"claudeAiOauth": {"accessToken": "t", "expiresAt": 1000}}).to_string()).unwrap();
        assert_eq!(claude_usage_local(&home, &none, now_seconds())["status"], "expired");
        fs::write(&path, json!({"claudeAiOauth": {"accessToken": "t"}}).to_string()).unwrap();
        assert_eq!(claude_usage_local(&home, &fake("https://api.anthropic.com/api/oauth/usage", Err(Some(401))), now_seconds())["status"], "expired");
        assert_eq!(claude_usage_local(&home, &fake("https://api.anthropic.com/api/oauth/usage", Err(None)), now_seconds())["status"], "error");
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn codex_api_filters_and_never_returns_the_token() {
        let home = temp("codex-api");
        fs::create_dir_all(home.join(".codex")).unwrap();
        fs::write(home.join(".codex/auth.json"), json!({"tokens": {"access_token": "codex-secret", "account_id": "acct"}}).to_string()).unwrap();
        let body = json!({"plan_type": "pro", "email": "private@example.com", "rate_limit": {"primary_window": {"used_percent": 40, "limit_window_seconds": 18000, "reset_after_seconds": 60, "reset_at": 5, "junk": 1}, "secondary_window": null}});
        let http = fake("https://chatgpt.com/backend-api/wham/usage", Ok(body));
        let result = codex_usage_api(&home, &http);
        assert_eq!(result["status"], "ok");
        assert_eq!(result["data"]["rate_limit"]["primary_window"]["used_percent"], json!(40));
        assert!(!result.to_string().contains("codex-secret"));
        assert!(!result.to_string().contains("private@example.com"));
        assert!(http.calls.borrow()[0].1.contains(&("ChatGPT-Account-Id".to_string(), "acct".to_string())));
        assert_eq!(codex_usage_api(&home.join("missing"), &http)["status"], "none");
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn other_hosts_are_blocked() {
        assert!(!allowed_usage_url("https://example.com/x"));
        assert!(!allowed_usage_url("http://api.anthropic.com/x"));
        assert!(allowed_usage_url("https://api.anthropic.com/api/oauth/usage"));
        assert!(UreqHttp.get_json("https://example.com/x", &[]).is_err());
    }

    #[test]
    fn framing_is_length_prefixed_utf8() {
        let framed = frame(&json!({"type": "ready", "folder": "C:\\사용자"}));
        let length = u32::from_le_bytes(framed[..4].try_into().unwrap()) as usize;
        assert_eq!(framed.len() - 4, length);
        assert_eq!(serde_json::from_slice::<Value>(&framed[4..]).unwrap()["folder"], "C:\\사용자");
    }
}
