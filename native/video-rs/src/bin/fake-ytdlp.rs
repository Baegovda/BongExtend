//! 시험 전용 가짜 yt-dlp. 인터넷 없이 보조 프로그램의 받기 흐름(진행률 · 파일 이름 · 실패 · 취소)을 확인해요.
//! 배포 묶음에는 넣지 않아요.
use std::io::Write;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out = args.iter().position(|a| a == "-P").and_then(|i| args.get(i + 1)).cloned().unwrap_or_else(|| ".".into());
    let url = args.last().cloned().unwrap_or_default();
    let mut stdout = std::io::stdout();
    if url.contains("failfailfai") {
        eprintln!("ERROR: [youtube] failfailfai: Video unavailable");
        std::process::exit(1);
    }
    let slow = url.contains("slowslowslo");
    for (i, pct) in ["  0.0%", " 12.5%", " 55.5%", "100%"].iter().enumerate() {
        let _ = writeln!(stdout, "[download] step {i}");
        let _ = writeln!(stdout, "BE_PROGRESS:{pct}");
        let _ = stdout.flush();
        if slow {
            std::thread::sleep(std::time::Duration::from_secs(30));
        }
    }
    let file = std::path::Path::new(&out).join("가짜 영상 [aqz-KE-bpKQ].mp3");
    let _ = std::fs::create_dir_all(&out);
    let _ = std::fs::write(&file, b"fake");
    let _ = writeln!(stdout, "BE_FILE:{}", file.display());
}
