//! 이식 실험(2026-11-20): 판정표에서 "옮기면 느려지거나 같게 못 만든다"고 한 함수들을 실제로 Rust 로 만들어
//! 골든 테스트와 시간으로 확인해요. 자바스크립트와 똑같이 만들 수 없는 입력은 Fallback(예전 길로)이에요.
//! - ko_number: Intl.NumberFormat("ko-KR") 의 정수·소수 표기(가장 짧은 십진 표현에서 반올림, 반은 올림)
//! - target_language: trans/content/content.js isAlreadyTargetLanguage
//! - wiper_order: trans/content/content.js planWiperOrder
//! - batch_urls: downloads/settings.js expandBatchUrls
//! - order_keys: core/update/installPlan.ts orderFiles 의 정렬(localeCompare 의 ICU 기본 규칙, 출력 가능한 ASCII 만)
use crate::js::{Fallback, R};
#[cfg(feature = "experiments")]
use crate::js::{is_js_space, js_trim};
#[cfg(feature = "experiments")]
use unicode_script::{Script, UnicodeScript};

// ---------- 숫자 표기 ----------

/// JS String(x) 글자(가장 짧은 십진 표현, 예: "1234.5", "1e+21", "5e-7")를 (정수부, 소수부) 숫자 글자로.
/// Rust 의 가장 짧은 표현은 딱 가운데 값에서 JS 와 다른 자리를 고를 수 있어서(예: 276589714642614.125 → JS ".12", Rust ".13")
/// 반드시 JS 가 만든 글자를 그대로 써요.
#[cfg(feature = "experiments")]
fn shortest_digits(js: &str) -> R<(String, String)> {
    let (mant, exp) = js.split_once('e').unwrap_or((js, "0"));
    let exp: i32 = exp.trim_start_matches('+').parse().map_err(|_| Fallback("number"))?;
    if !mant.bytes().all(|b| b.is_ascii_digit() || b == b'.') || mant.is_empty() {
        return Err(Fallback("number"));
    }
    let (ip, fp) = mant.split_once('.').unwrap_or((mant, ""));
    let digits = format!("{ip}{fp}");
    let exp = exp + ip.len() as i32 - 1; // 첫 자리 기준 지수
    let digits = digits.as_str();
    Ok(if exp >= 0 {
        let cut = exp as usize + 1;
        if digits.len() <= cut {
            (format!("{digits}{}", "0".repeat(cut - digits.len())), String::new())
        } else {
            (digits[..cut].to_string(), digits[cut..].to_string())
        }
    } else {
        ("0".to_string(), format!("{}{digits}", "0".repeat((-exp - 1) as usize)))
    })
}

/// "ko-KR" 표기: 천 단위 쉼표, 소수점 ".", 음수(-0 포함)는 "-". js 는 JS String(x)(−0 은 "-0").
#[cfg(feature = "experiments")]
pub fn ko_number(js: &str, min_frac: usize, max_frac: usize) -> R<String> {
    let negative = js.starts_with('-');
    let body = js.trim_start_matches('-');
    if body.is_empty() || body.contains("Infinity") || body == "NaN" || min_frac > max_frac || max_frac > 20 {
        return Err(Fallback("number"));
    }
    let (mut int, mut frac) = shortest_digits(body)?;
    if frac.len() > max_frac {
        let up = frac.as_bytes()[max_frac] >= b'5';
        frac.truncate(max_frac);
        if up {
            let mut all: Vec<u8> = format!("{int}{frac}").into_bytes();
            let mut i = all.len();
            loop {
                if i == 0 {
                    all.insert(0, b'1');
                    break;
                }
                i -= 1;
                if all[i] == b'9' {
                    all[i] = b'0';
                } else {
                    all[i] += 1;
                    break;
                }
            }
            let split = all.len() - frac.len();
            int = String::from_utf8_lossy(&all[..split]).into_owned();
            frac = String::from_utf8_lossy(&all[split..]).into_owned();
        }
    }
    while frac.len() > min_frac && frac.ends_with('0') {
        frac.pop();
    }
    while frac.len() < min_frac {
        frac.push('0');
    }
    let int = int.trim_start_matches('0');
    let int = if int.is_empty() { "0" } else { int };
    let mut out = String::with_capacity(int.len() + int.len() / 3 + frac.len() + 2);
    if negative {
        out.push('-');
    }
    for (i, c) in int.chars().enumerate() {
        if i > 0 && (int.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    if !frac.is_empty() {
        out.push('.');
        out.push_str(&frac);
    }
    Ok(out)
}

// ---------- 목표 언어 판단 ----------

#[cfg(feature = "experiments")]
fn word(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

/// /https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi 가 p 에서 맞으면 끝 위치(글자 번호).
#[cfg(feature = "experiments")]
fn protected_at(s: &[char], p: usize) -> Option<usize> {
    let lower = |i: usize| s.get(i).map(|c| c.to_ascii_lowercase());
    // https?://\S+
    if lower(p) == Some('h') && lower(p + 1) == Some('t') && lower(p + 2) == Some('t') && lower(p + 3) == Some('p') {
        let mut q = p + 4;
        if lower(q) == Some('s') {
            q += 1;
        }
        if s.get(q) == Some(&':') && s.get(q + 1) == Some(&'/') && s.get(q + 2) == Some(&'/') {
            let start = q + 3;
            let mut end = start;
            while end < s.len() && !is_js_space(s[end]) {
                end += 1;
            }
            if end > start {
                return Some(end);
            }
        }
    }
    // [\w.+-]+@[\w.-]+\.[a-z]{2,}
    let mut q = p;
    while q < s.len() && (word(s[q]) || matches!(s[q], '.' | '+' | '-')) {
        q += 1;
    }
    if q == p || s.get(q) != Some(&'@') {
        return None;
    }
    let d0 = q + 1;
    let mut d1 = d0;
    while d1 < s.len() && (word(s[d1]) || matches!(s[d1], '.' | '-')) {
        d1 += 1;
    }
    let mut k = d1;
    while k > d0 + 1 {
        k -= 1;
        if s[k] == '.' && s.get(k + 1).is_some_and(char::is_ascii_alphabetic) && s.get(k + 2).is_some_and(char::is_ascii_alphabetic) {
            let mut end = k + 1;
            while end < s.len() && s[end].is_ascii_alphabetic() {
                end += 1;
            }
            return Some(end);
        }
    }
    None
}

#[cfg(feature = "experiments")]
pub fn target_language(text: &str, language: &str) -> R<bool> {
    if !language.is_ascii() {
        return Err(Fallback("language"));
    }
    let s: Vec<char> = text.chars().collect();
    // 보호할 주소·메일을 뺀 나머지에 로마자가 있으면 아니에요.
    let mut p = 0;
    while p < s.len() {
        if let Some(end) = protected_at(&s, p) {
            p = end;
            continue;
        }
        if s[p].script() == Script::Latin {
            return Ok(false);
        }
        p += 1;
    }
    let (mut hangul, mut han, mut kana, mut cyrillic, mut thai) = (0u32, 0u32, 0u32, 0u32, 0u32);
    for c in &s {
        match c.script() {
            Script::Hangul => hangul += 1,
            Script::Han => han += 1,
            Script::Hiragana | Script::Katakana => kana += 1,
            Script::Cyrillic => cyrillic += 1,
            Script::Thai => thai += 1,
            _ => {}
        }
    }
    let letters = hangul + han + kana + cyrillic + thai;
    if letters == 0 {
        return Ok(false);
    }
    let mostly = |n: u32| n as f64 / letters as f64 >= 0.8;
    Ok(match language.to_ascii_lowercase().as_str() {
        "ko" => mostly(hangul) && han + kana == 0,
        "ja" => kana > 0 && mostly(kana + han) && hangul == 0,
        "zh" | "zh-cn" | "zh-tw" => mostly(han) && hangul + kana == 0,
        "ru" => mostly(cyrillic),
        "th" => mostly(thai),
        _ => false,
    })
}

// ---------- localeCompare(ICU 기본 규칙) — 출력 가능한 ASCII 만 ----------

/// ICU 기본(root) 정렬의 1차 순서. 크롬·bun 의 localeCompare 로 한 글자씩 정렬해서 얻은 순서예요(테스트가 다시 확인해요).
const PRIMARY_ORDER: &str = " _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz";

fn primary_table() -> [u8; 128] {
    let mut t = [0u8; 128];
    for (i, b) in PRIMARY_ORDER.bytes().enumerate() {
        t[b as usize] = i as u8 + 1;
    }
    for b in b'A'..=b'Z' {
        t[b as usize] = t[(b + 32) as usize];
    }
    t
}

/// 비교 열쇠: (1차 무게들, 대문자 표시들). 출력 가능한 ASCII 가 아니면 None.
fn collation_key(s: &str, table: &[u8; 128]) -> Option<(Vec<u8>, Vec<u8>)> {
    let mut primary = Vec::with_capacity(s.len());
    let mut tertiary = Vec::with_capacity(s.len());
    for b in s.bytes() {
        if !(0x20..0x7f).contains(&b) {
            return None;
        }
        primary.push(table[b as usize]);
        tertiary.push(b.is_ascii_uppercase() as u8);
    }
    Some((primary, tertiary))
}

/// (순위, 열쇠) 들을 순위 → localeCompare 순으로 안정 정렬한 순번.
pub fn order_keys(items: &[(i64, &str)]) -> R<Vec<usize>> {
    let table = primary_table();
    let mut keyed = Vec::with_capacity(items.len());
    for (i, (rank, key)) in items.iter().enumerate() {
        let k = collation_key(key, &table).ok_or(Fallback("not ascii"))?;
        keyed.push((*rank, k, i));
    }
    keyed.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1 .0.cmp(&b.1 .0)).then_with(|| a.1 .1.cmp(&b.1 .1)));
    Ok(keyed.into_iter().map(|(_, _, i)| i).collect())
}

/// 두 글자의 localeCompare 부호(같은 규칙). 출력 가능한 ASCII 가 아니면 None.
pub fn locale_cmp(a: &str, b: &str) -> Option<core::cmp::Ordering> {
    let table = primary_table();
    let (ka, kb) = (collation_key(a, &table)?, collation_key(b, &table)?);
    Some(ka.0.cmp(&kb.0).then_with(|| ka.1.cmp(&kb.1)))
}

// ---------- 번역 훑기 순서 ----------

#[cfg(feature = "experiments")]
pub struct WiperBox<'a> {
    pub id: &'a str,
    pub top: f64,
    pub height: f64,
}

/// planWiperOrder (상자가 하나 이상일 때). 답: (from, to, span, anchorMin, anchorMax, lineStart, lineEnd, [(번호, at, band, top, height)])
#[allow(clippy::type_complexity)]
#[cfg(feature = "experiments")]
pub fn wiper_order(boxes: &[WiperBox], up: bool) -> R<(f64, f64, f64, f64, f64, f64, f64, Vec<(usize, f64, f64, f64, f64)>)> {
    if boxes.is_empty() || boxes.iter().any(|b| !b.top.is_finite() || !b.height.is_finite()) {
        return Err(Fallback("boxes"));
    }
    let clamp01 = |n: f64| if !(n > 0.0) { 0.0 } else if n > 1.0 { 1.0 } else { n };
    let mut anchor_min = boxes[0].top;
    let mut anchor_max = boxes[0].top + boxes[0].height;
    for b in boxes {
        if b.top < anchor_min {
            anchor_min = b.top;
        }
        let bottom = b.top + b.height;
        if bottom > anchor_max {
            anchor_max = bottom;
        }
    }
    let span = (anchor_max - anchor_min).max(1.0);
    let mut order: Vec<(usize, f64, f64, f64, f64)> = boxes
        .iter()
        .enumerate()
        .map(|(i, b)| {
            let mid = b.top + b.height / 2.0;
            let band = 1f64.min((b.height / span).max(0.04));
            let at = if up { (anchor_max - mid) / span } else { (mid - anchor_min) / span };
            (i, clamp01(at), band, b.top, b.height)
        })
        .collect();
    let mut unsupported = false;
    order.sort_by(|a, b| {
        let d = a.1 - b.1;
        if d != 0.0 {
            return if d < 0.0 { core::cmp::Ordering::Less } else { core::cmp::Ordering::Greater };
        }
        locale_cmp(boxes[a.0].id, boxes[b.0].id).unwrap_or_else(|| {
            unsupported = true;
            core::cmp::Ordering::Equal
        })
    });
    if unsupported {
        return Err(Fallback("id"));
    }
    let mut lead: f64 = 0.04;
    let mut tail: f64 = 0.0;
    for o in &order {
        lead = lead.max(o.2 / 2.0);
        tail = tail.max(o.1 + o.2 / 2.0);
    }
    let (from, to) = if up { (anchor_max, anchor_min) } else { (anchor_min, anchor_max) };
    Ok((from, to, span, anchor_min, anchor_max, -lead, tail.max(lead), order))
}

// ---------- 여러 주소 펼치기 ----------

#[cfg(feature = "experiments")]
fn int_of(s: &str) -> R<i64> {
    let digits = s.trim_start_matches('-');
    if digits.is_empty() || digits.len() > 15 {
        return Err(Fallback("number"));
    }
    let v: i64 = digits.parse().map_err(|_| Fallback("number"))?;
    Ok(if s.starts_with('-') { -v } else { v })
}

/// /\{(-?\d+)\.\.(-?\d+)(?:,(-?\d+))?\}/ 의 첫 맞음: (시작, 끝, from, to, step 글자)
#[cfg(feature = "experiments")]
fn range_match(raw: &str) -> Option<(usize, usize, &str, &str, Option<&str>)> {
    let b = raw.as_bytes();
    let num = |at: usize| -> Option<usize> {
        let mut q = at;
        if b.get(q) == Some(&b'-') {
            q += 1;
        }
        let d = q;
        while q < b.len() && b[q].is_ascii_digit() {
            q += 1;
        }
        (q > d).then_some(q)
    };
    for start in 0..b.len() {
        if b[start] != b'{' {
            continue;
        }
        let Some(e1) = num(start + 1) else { continue };
        if b.get(e1) != Some(&b'.') || b.get(e1 + 1) != Some(&b'.') {
            continue;
        }
        let Some(e2) = num(e1 + 2) else { continue };
        if b.get(e2) == Some(&b',') {
            if let Some(e3) = num(e2 + 1) {
                if b.get(e3) == Some(&b'}') {
                    return Some((start, e3 + 1, &raw[start + 1..e1], &raw[e1 + 2..e2], Some(&raw[e2 + 1..e3])));
                }
            }
        }
        if b.get(e2) == Some(&b'}') {
            return Some((start, e2 + 1, &raw[start + 1..e1], &raw[e1 + 2..e2], None));
        }
    }
    None
}

#[cfg(feature = "experiments")]
pub fn batch_urls(text: &str, limit: usize) -> R<Vec<String>> {
    if !text.is_ascii() {
        return Err(Fallback("not ascii"));
    }
    let mut output: Vec<String> = Vec::new();
    for line in text.split('\n') {
        let line = line.strip_suffix('\r').unwrap_or(line);
        let raw = js_trim(line);
        if raw.is_empty() {
            continue;
        }
        let mut values: Vec<String> = Vec::new();
        if let Some((s, e, m1, m2, m3)) = range_match(raw) {
            let from = int_of(m1)?;
            let to = int_of(m2)?;
            let step_abs = match m3 { Some(t) => int_of(t)?.abs(), None => 1 }.max(1);
            let step = if from <= to { step_abs } else { -step_abs };
            let digits = m1.trim_start_matches('-').len().max(m2.trim_start_matches('-').len());
            let mut current = from;
            while (if step > 0 { current <= to } else { current >= to }) && output.len() + values.len() < limit {
                let sign = if current < 0 { "-" } else { "" };
                values.push(format!("{}{sign}{:0>digits$}{}", &raw[..s], current.unsigned_abs(), &raw[e..]));
                current += step;
            }
        } else {
            values.push(raw.to_string());
        }
        for value in values {
            if output.len() >= limit {
                break;
            }
            if let Ok(url) = url::Url::parse(&value) {
                if (url.scheme() == "http" || url.scheme() == "https") && !output.iter().any(|o| o == url.as_str()) {
                    output.push(url.as_str().to_string());
                }
            }
        }
        if output.len() >= limit {
            break;
        }
    }
    Ok(output)
}

// ---------- 사진 원본 주소(image/toolbar.js originalImageUrl, shop/shop.js originalProductImage) ----------

/// (\.(?:jpe?g|png|webp|gif)) 가 at 에서 맞으면 확장자 끝.
#[cfg(feature = "experiments")]
fn image_ext_at(b: &[u8], at: usize) -> Option<usize> {
    if b.get(at) != Some(&b'.') {
        return None;
    }
    let low = |i: usize| b.get(i).map(u8::to_ascii_lowercase);
    let p = at + 1;
    match (low(p), low(p + 1), low(p + 2), low(p + 3)) {
        (Some(b'j'), Some(b'p'), Some(b'e'), Some(b'g')) => Some(p + 4),
        (Some(b'j'), Some(b'p'), Some(b'g'), _) => Some(p + 3),
        (Some(b'p'), Some(b'n'), Some(b'g'), _) => Some(p + 3),
        (Some(b'w'), Some(b'e'), Some(b'b'), Some(b'p')) => Some(p + 4),
        (Some(b'g'), Some(b'i'), Some(b'f'), _) => Some(p + 3),
        _ => None,
    }
}

/// 경로 꼬리 자르기. tail(b, e) 가 확장자 끝 e 뒤 꼬리가 맞는지 보고, 맞으면 처음 맞는 곳의 확장자 끝을 돌려줘요.
#[cfg(feature = "experiments")]
fn cut_after_ext(path: &str, tail: impl Fn(&[u8], usize) -> bool) -> Option<usize> {
    let b = path.as_bytes();
    (0..b.len()).find_map(|at| image_ext_at(b, at).filter(|&e| tail(b, e)))
}

#[cfg(feature = "experiments")]
fn no_slash_after(b: &[u8], from: usize) -> bool {
    !b[from.min(b.len())..].contains(&b'/')
}

/// URLSearchParams 를 건드린 것과 같게: 조회를 폼 형식으로 다시 쓰고 names 를 지워요(비면 '?' 도 없어요).
#[cfg(feature = "experiments")]
fn rewrite_query(url: &mut url::Url, remove: &[&str]) {
    let pairs: Vec<(String, String)> = url.query_pairs().filter(|(k, _)| !remove.contains(&k.as_ref())).map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
    let mut ser = url::form_urlencoded::Serializer::new(String::new());
    for (k, v) in &pairs {
        ser.append_pair(k, v);
    }
    let s = ser.finish();
    url.set_query(if s.is_empty() { None } else { Some(&s) });
}

#[cfg(feature = "experiments")]
pub fn original_image_url(src: &str) -> R<String> {
    if !src.is_ascii() {
        return Err(Fallback("not ascii"));
    }
    let Ok(mut url) = url::Url::parse(src) else { return Ok(src.to_string()) };
    if url.cannot_be_a_base() || !matches!(url.scheme(), "http" | "https") {
        return Err(Fallback("scheme"));
    }
    let mut path = url.path().to_string();
    // /(\.(?:jpe?g|png|webp|gif))_[0-9]+x[0-9]+[^/]*$/i → "$1"
    if let Some(e) = cut_after_ext(&path, |b, e| {
        let mut q = e;
        if b.get(q) != Some(&b'_') {
            return false;
        }
        q += 1;
        let d = q;
        while q < b.len() && b[q].is_ascii_digit() {
            q += 1;
        }
        if q == d || !matches!(b.get(q), Some(b'x' | b'X')) {
            return false;
        }
        q += 1;
        let d2 = q;
        while q < b.len() && b[q].is_ascii_digit() {
            q += 1;
        }
        q > d2 && no_slash_after(b, q)
    }) {
        path.truncate(e);
    }
    // /(\.(?:jpe?g|png|webp|gif))_\.(?:avif|webp)$/i → "$1"
    if let Some(e) = cut_after_ext(&path, |b, e| {
        let rest = &b[e..];
        rest.eq_ignore_ascii_case(b"_.avif") || rest.eq_ignore_ascii_case(b"_.webp")
    }) {
        path.truncate(e);
    }
    url.set_path(&path);
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    let mut remove = vec!["w", "h", "width", "height", "resize", "quality"];
    if host == "pstatic.net" || host.ends_with(".pstatic.net") {
        remove.push("type");
    }
    rewrite_query(&mut url, &remove);
    Ok(url.as_str().to_string())
}

#[cfg(feature = "experiments")]
pub fn original_product_image(value: &str) -> R<String> {
    if !value.is_ascii() {
        return Err(Fallback("not ascii"));
    }
    let text = js_trim(value);
    let full = if text.starts_with("//") { format!("https:{text}") } else { text.to_string() };
    let Ok(mut url) = url::Url::parse(&full) else { return Ok(String::new()) };
    if !matches!(url.scheme(), "http" | "https") {
        return Ok(String::new());
    }
    if url.set_scheme("https").is_err() {
        return Err(Fallback("scheme"));
    }
    let mut path = url.path().to_string();
    // /\.(jpe?g|png|webp|gif)_[^/]*$/i → ".$1"
    if let Some(e) = cut_after_ext(&path, |b, e| b.get(e) == Some(&b'_') && no_slash_after(b, e)) {
        path.truncate(e);
    }
    url.set_path(&path);
    url.set_query(None);
    url.set_fragment(None);
    Ok(url.as_str().to_string())
}

#[cfg(all(test, feature = "experiments"))]
mod experiment_tests {
    use super::*;
    #[test]
    fn numbers() {
        assert_eq!(ko_number("1234567", 0, 3).unwrap(), "1,234,567");
        assert_eq!(ko_number("1.005", 0, 2).unwrap(), "1.01");
        assert_eq!(ko_number("999.995", 0, 2).unwrap(), "1,000");
        assert_eq!(ko_number("-0", 0, 0).unwrap(), "-0");
        assert_eq!(ko_number("0.5", 2, 2).unwrap(), "0.50");
        assert_eq!(ko_number("1e+21", 0, 0).unwrap(), "1,000,000,000,000,000,000,000");
        assert_eq!(ko_number("5e-7", 0, 8).unwrap(), "0.0000005");
        assert_eq!(ko_number("276589714642614.12", 0, 2).unwrap(), "276,589,714,642,614.12");
    }
    #[test]
    fn language() {
        assert!(!target_language("Forwarded from sample@example.invalid 배송 확인", "ko").unwrap());
        assert!(target_language("배송 확인 sample@example.invalid", "ko").unwrap());
        assert!(!target_language("免费配送", "ko").unwrap());
        assert!(target_language("こんにちは", "ja").unwrap());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn collation() {
        let items = [(1, "_locales/en/messages.json"), (1, "_locales/en_GB/messages.json"), (0, "b"), (1, "A"), (1, "a")];
        // 순위 0 이 먼저, 그다음 "_" < "/" < 글자, 같은 글자는 소문자가 먼저
        assert_eq!(order_keys(&items).unwrap(), vec![2, 1, 0, 4, 3]);
        assert!(order_keys(&[(0, "한글")]).is_err(), "출력 가능한 ASCII 가 아니면 예전 길로");
        assert_eq!(locale_cmp("a", "A"), Some(core::cmp::Ordering::Less));
    }
}

#[cfg(all(test, feature = "experiments"))]
mod batch_tests {
    use super::*;
    #[test]
    fn batch() {
        assert_eq!(batch_urls("https://ex.com/{1..3}.jpg", 100).unwrap(), vec!["https://ex.com/1.jpg", "https://ex.com/2.jpg", "https://ex.com/3.jpg"]);
        assert_eq!(batch_urls("https://ex.com/{08..10,2}\nftp://x\nHTTP://EX.com/a b", 100).unwrap(), vec!["https://ex.com/08", "https://ex.com/10", "http://ex.com/a%20b"]);
    }
}
