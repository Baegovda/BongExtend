//! 자동 업데이트의 zip 풀기: src/core/update/zip.ts 의 extractAll 을 그대로 옮겼어요.
//! 결과가 자바스크립트와 같아야 해서, 자바스크립트가 오류를 내는 zip(위험한 경로, 손상, 크기 불일치, 압축 뒤 찌꺼기,
//! 지원하지 않는 방식, manifest 없음)은 전부 Fallback 으로 돌려 예전 길이 똑같은 오류를 내게 해요.
//! WebAssembly 는 32비트라서 위치 계산은 모두 넘침 검사(checked)를 해요.
use crate::js::{Fallback, R};
use miniz_oxide::inflate::core::{decompress, inflate_flags, DecompressorOxide};
use miniz_oxide::inflate::TINFLStatus;

const SIG_EOCD: u32 = 0x0605_4b50;
const SIG_CEN: u32 = 0x0201_4b50;
const SIG_LOC: u32 = 0x0403_4b50;
const ZIP64_MAGIC: u32 = 0xffff_ffff;

/// need(): bytes[at..at+size] 가 있어야 해요(없으면 자바스크립트는 "zip이 잘렸어요").
fn range(b: &[u8], at: usize, size: usize) -> R<&[u8]> {
    let end = at.checked_add(size).ok_or(Fallback("truncated"))?;
    b.get(at..end).ok_or(Fallback("truncated"))
}

fn u16_at(b: &[u8], at: usize) -> R<usize> {
    let s = range(b, at, 2)?;
    Ok(u16::from_le_bytes([s[0], s[1]]) as usize)
}

fn u32_at(b: &[u8], at: usize) -> R<u32> {
    let s = range(b, at, 4)?;
    Ok(u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
}

fn add(a: usize, b: usize) -> R<usize> {
    a.checked_add(b).ok_or(Fallback("truncated"))
}

struct Entry {
    name: String,
    method: usize,
    comp_size: usize,
    size: usize,
    offset: usize,
}

/// listEntries
fn list_entries(b: &[u8]) -> R<Vec<Entry>> {
    if b.len() < 22 {
        return Err(Fallback("not zip"));
    }
    let min = b.len().saturating_sub(22 + 65535);
    let mut eocd = None;
    let mut i = b.len() - 22;
    loop {
        if u32_at(b, i)? == SIG_EOCD {
            eocd = Some(i);
            break;
        }
        if i == min {
            break;
        }
        i -= 1;
    }
    let eocd = eocd.ok_or(Fallback("not zip"))?;
    let count = u16_at(b, eocd + 10)?;
    let cd_offset = u32_at(b, eocd + 16)?;
    if u32_at(b, eocd + 12)? == ZIP64_MAGIC || cd_offset == ZIP64_MAGIC {
        return Err(Fallback("zip64"));
    }
    let mut cursor = cd_offset as usize;
    let mut out = Vec::with_capacity(count);
    for _ in 0..count {
        range(b, cursor, 46)?;
        if u32_at(b, cursor)? != SIG_CEN {
            return Err(Fallback("central directory"));
        }
        let method = u16_at(b, cursor + 10)?;
        let comp_size = u32_at(b, cursor + 20)?;
        let size = u32_at(b, cursor + 24)?;
        let name_len = u16_at(b, cursor + 28)?;
        let extra_len = u16_at(b, cursor + 30)?;
        let comment_len = u16_at(b, cursor + 32)?;
        let offset = u32_at(b, cursor + 42)?;
        if comp_size == ZIP64_MAGIC || size == ZIP64_MAGIC || offset == ZIP64_MAGIC {
            return Err(Fallback("zip64"));
        }
        let raw = range(b, cursor + 46, name_len)?;
        // TextDecoder 는 깨진 바이트를 바꿔 넣고, 맨 앞 BOM 을 지워요. 그런 이름은 드물어서 예전 길에 맡겨요.
        if raw.starts_with(&[0xEF, 0xBB, 0xBF]) {
            return Err(Fallback("name bom"));
        }
        let name = core::str::from_utf8(raw).map_err(|_| Fallback("name not utf-8"))?.to_string();
        out.push(Entry { name, method, comp_size: comp_size as usize, size: size as usize, offset: offset as usize });
        cursor = add(cursor + 46, name_len + extra_len + comment_len)?;
    }
    Ok(out)
}

/// safePath: 안전하면 조각들, 아니면 None(자바스크립트는 오류).
fn safe_path(name: &str) -> Option<Vec<String>> {
    let normalized = name.replace('\\', "/");
    let b = normalized.as_bytes();
    if normalized.is_empty()
        || normalized.starts_with('/')
        || (b.len() >= 2 && b[0].is_ascii_alphabetic() && b[1] == b':')
        || normalized.contains('\0')
    {
        return None;
    }
    let parts: Vec<String> = normalized.split('/').filter(|p| !p.is_empty() && *p != ".").map(str::to_string).collect();
    if parts.is_empty() || parts.iter().any(|p| p == "..") {
        return None;
    }
    Some(parts)
}

/// 압축 해제: 출력이 정확히 size 바이트이고, 입력을 끝까지 다 쓴 경우만 받아요(브라우저는 뒤 찌꺼기를 거부해요).
fn inflate_exact(input: &[u8], size: usize, out: &mut Vec<u8>) -> R<()> {
    if input.is_empty() {
        return Err(Fallback("empty deflate"));
    }
    let start = out.len();
    let room = add(size, 1)?; // +1: 더 나오는지 알아보려고
    out.resize(add(start, room)?, 0);
    let mut state = DecompressorOxide::new();
    let flags = inflate_flags::TINFL_FLAG_USING_NON_WRAPPING_OUTPUT_BUF;
    let (status, consumed, written) = decompress(&mut state, input, &mut out[start..], 0, flags);
    if status != TINFLStatus::Done || consumed != input.len() || written != size {
        out.truncate(start);
        return Err(Fallback("inflate"));
    }
    out.truncate(start + size);
    Ok(())
}

pub struct Extracted {
    /// (경로 조각들, 데이터 시작, 길이)
    pub files: Vec<(Vec<String>, usize, usize)>,
    pub data: Vec<u8>,
}

/// extractAll
pub fn extract_all(b: &[u8]) -> R<Extracted> {
    let entries = list_entries(b)?;
    // 풀린 크기는 압축 파일 안의 숫자라서 믿지 않고, 미리 잡는 메모리는 적당히만 잡아요.
    let hint = entries.iter().fold(0usize, |n, e| n.saturating_add(e.size)).min(b.len().saturating_mul(8)).min(256 << 20);
    let mut data = Vec::with_capacity(hint);
    let mut files = Vec::new();
    for e in &entries {
        let parts = safe_path(&e.name).ok_or(Fallback("unsafe path"))?;
        if e.name.ends_with('/') {
            continue;
        }
        range(b, e.offset, 30)?;
        if u32_at(b, e.offset)? != SIG_LOC {
            return Err(Fallback("local header"));
        }
        let name_len = u16_at(b, e.offset + 26)?;
        let extra_len = u16_at(b, e.offset + 28)?;
        let start = add(e.offset + 30, name_len + extra_len)?;
        let raw = range(b, start, e.comp_size)?;
        let at = data.len();
        match e.method {
            0 => {
                if raw.len() != e.size {
                    return Err(Fallback("size"));
                }
                data.extend_from_slice(raw);
            }
            8 => inflate_exact(raw, e.size, &mut data)?,
            _ => return Err(Fallback("method")),
        }
        files.push((parts, at, e.size));
    }
    if files.is_empty() {
        return Err(Fallback("empty zip"));
    }
    let root = files[0].0[0].clone();
    let has_root_manifest = files.iter().any(|f| f.0.len() == 1 && f.0[0] == "manifest.json");
    let wrapped = files.iter().all(|f| f.0.len() > 1 && f.0[0] == root);
    if !has_root_manifest && wrapped {
        for f in &mut files {
            f.0.remove(0);
        }
    }
    if !files.iter().any(|f| f.0.join("/") == "manifest.json") {
        return Err(Fallback("no manifest"));
    }
    Ok(Extracted { files, data })
}

/// 다리용 답: [u32 JSON 길이][JSON][풀린 데이터]. JSON 은 {"v":[[경로 조각들, 시작, 길이]…]} 또는 {"x":"이유"}.
pub fn extract_reply(b: &[u8]) -> Vec<u8> {
    let (json, data) = match extract_all(b) {
        Ok(Extracted { files, data }) => {
            let list: Vec<serde_json::Value> = files.into_iter().map(|(p, s, l)| serde_json::json!([p, s, l])).collect();
            (serde_json::json!({ "v": list }), data)
        }
        Err(Fallback(why)) => (serde_json::json!({ "x": why }), Vec::new()),
    };
    let json = serde_json::to_vec(&json).unwrap_or_else(|_| br#"{"x":"encode"}"#.to_vec());
    let mut out = Vec::with_capacity(4 + json.len() + data.len());
    out.extend_from_slice(&(json.len() as u32).to_le_bytes());
    out.extend_from_slice(&json);
    out.extend_from_slice(&data);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 시험용 zip 만들기. method 8 이면 deflate 로 눌러요.
    pub fn make_zip(entries: &[(&str, &[u8], u16)]) -> Vec<u8> {
        let mut out = Vec::new();
        let mut central = Vec::new();
        for (name, body, method) in entries {
            let packed = if *method == 8 { miniz_oxide::deflate::compress_to_vec(body, 6) } else { body.to_vec() };
            let offset = out.len() as u32;
            out.extend_from_slice(&SIG_LOC.to_le_bytes());
            out.extend_from_slice(&[20, 0, 0, 0]);
            out.extend_from_slice(&method.to_le_bytes());
            out.extend_from_slice(&[0, 0, 0, 0, 0, 0, 0, 0]);
            out.extend_from_slice(&(packed.len() as u32).to_le_bytes());
            out.extend_from_slice(&(body.len() as u32).to_le_bytes());
            out.extend_from_slice(&(name.len() as u16).to_le_bytes());
            out.extend_from_slice(&0u16.to_le_bytes());
            out.extend_from_slice(name.as_bytes());
            out.extend_from_slice(&packed);
            central.extend_from_slice(&SIG_CEN.to_le_bytes());
            central.extend_from_slice(&[20, 0, 20, 0, 0, 0]);
            central.extend_from_slice(&method.to_le_bytes());
            central.extend_from_slice(&[0, 0, 0, 0, 0, 0, 0, 0]);
            central.extend_from_slice(&(packed.len() as u32).to_le_bytes());
            central.extend_from_slice(&(body.len() as u32).to_le_bytes());
            central.extend_from_slice(&(name.len() as u16).to_le_bytes());
            central.extend_from_slice(&[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            central.extend_from_slice(&offset.to_le_bytes());
            central.extend_from_slice(name.as_bytes());
        }
        let cd_offset = out.len() as u32;
        out.extend_from_slice(&central);
        out.extend_from_slice(&SIG_EOCD.to_le_bytes());
        out.extend_from_slice(&[0, 0, 0, 0]);
        out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        out.extend_from_slice(&(central.len() as u32).to_le_bytes());
        out.extend_from_slice(&cd_offset.to_le_bytes());
        out.extend_from_slice(&[0, 0]);
        out
    }

    #[test]
    fn extracts_and_unwraps() {
        let big = "hello zip ".repeat(500);
        let z = make_zip(&[("pkg/manifest.json", b"{}", 0), ("pkg/a/b.js", big.as_bytes(), 8)]);
        let r = extract_all(&z).unwrap();
        assert_eq!(r.files[0].0, vec!["manifest.json"]);
        assert_eq!(r.files[1].0, vec!["a", "b.js"]);
        assert_eq!(&r.data[r.files[1].1..r.files[1].1 + r.files[1].2], big.as_bytes());
    }

    #[test]
    fn javascript_errors_stay_javascript() {
        assert!(extract_all(&make_zip(&[("../x", b"1", 0), ("manifest.json", b"{}", 0)])).is_err());
        assert!(extract_all(&make_zip(&[("C:/x", b"1", 0), ("manifest.json", b"{}", 0)])).is_err());
        assert!(extract_all(&make_zip(&[("a.js", b"1", 0)])).is_err(), "manifest 없음");
        assert!(extract_all(&make_zip(&[("\u{feff}manifest.json", b"{}", 0)])).is_err(), "BOM");
        assert!(extract_all(&make_zip(&[("manifest.json", b"{}", 9)])).is_err(), "방식");
        assert!(extract_all(b"not a zip at all, sorry!!").is_err());
        assert!(extract_all(&[]).is_err());
        // 압축 뒤 찌꺼기: 압축 크기를 늘리고 뒤에 바이트를 붙이면 브라우저는 거부해요.
        let mut z = make_zip(&[("manifest.json", "{}".repeat(50).as_bytes(), 8)]);
        let comp = u32::from_le_bytes(z[18..22].try_into().unwrap());
        let cut = 30 + "manifest.json".len() + comp as usize;
        z.insert(cut, 0x00);
        z[18..22].copy_from_slice(&(comp + 1).to_le_bytes());
        // 중앙 디렉터리 위치·압축 크기도 맞춰 줘요
        let cd = cut + 1;
        z[cd + 20..cd + 24].copy_from_slice(&(comp + 1).to_le_bytes());
        let eocd = z.len() - 22;
        let cdo = u32::from_le_bytes(z[eocd + 16..eocd + 20].try_into().unwrap()) + 1;
        z[eocd + 16..eocd + 20].copy_from_slice(&cdo.to_le_bytes());
        assert!(matches!(extract_all(&z), Err(Fallback("inflate"))));
        // 큰 위치 값이 넘치지 않아야 해요
        let mut z = make_zip(&[("manifest.json", b"{}", 0)]);
        let eocd = z.len() - 22;
        z[eocd + 16..eocd + 20].copy_from_slice(&0xffff_fff0u32.to_le_bytes());
        assert!(extract_all(&z).is_err());
    }

    #[test]
    fn reply_layout() {
        let z = make_zip(&[("manifest.json", b"{}", 0)]);
        let r = extract_reply(&z);
        let n = u32::from_le_bytes(r[0..4].try_into().unwrap()) as usize;
        assert_eq!(&r[4..4 + n], br#"{"v":[[["manifest.json"],0,2]]}"#);
        assert_eq!(&r[4 + n..], b"{}");
        let bad = extract_reply(b"nope");
        let n = u32::from_le_bytes(bad[0..4].try_into().unwrap()) as usize;
        assert_eq!(&bad[4..4 + n], br#"{"x":"not zip"}"#);
    }

    #[test]
    #[ignore]
    fn real_zip_time() {
        let path = std::env::var("BONG_ZIP").expect("BONG_ZIP");
        let bytes = std::fs::read(path).unwrap();
        let t = std::time::Instant::now();
        let r = extract_all(&bytes).unwrap();
        eprintln!("native extract: {:?}, files {}, bytes {}", t.elapsed(), r.files.len(), r.data.len());
    }
}
