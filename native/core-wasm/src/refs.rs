//! 업데이트 설치 때 먼저 써야 할 파일 찾기의 무거운 부분: src/core/update/installPlan.ts 의 세 정규식이 잡는 글자(match[1])를
//! 파일 바이트에서 바로 찾아요(글자로 바꾸기 + 정규식 대신). 결과는 자바스크립트 정규식과 똑같은 순서·글자여야 해서
//! 탐욕(greedy)·게으른(lazy) 반복, 선택 그룹, 대소문자 무시(i, ASCII 만), 유니코드 공백(\s)을 되짚기 순서까지 그대로 따라 해요.
//! UTF-8 이 아닌 바이트(TextDecoder 가 바꿔 넣는 경우)는 Fallback.
use crate::js::{Fallback, R};

/// JS \s(유니코드 공백·줄바꿈)이면 그 바이트 길이.
fn space_at(b: &[u8], i: usize) -> Option<usize> {
    match *b.get(i)? {
        b'\t' | b'\n' | 0x0B | 0x0C | b'\r' | b' ' => Some(1),
        0xC2 if b.get(i + 1) == Some(&0xA0) => Some(2),
        0xE1 if b.get(i + 1) == Some(&0x9A) && b.get(i + 2) == Some(&0x80) => Some(3),
        0xE2 => {
            let (x, y) = (*b.get(i + 1)?, *b.get(i + 2)?);
            let ok = (x == 0x80 && ((0x80..=0x8A).contains(&y) || y == 0xA8 || y == 0xA9 || y == 0xAF)) || (x == 0x81 && y == 0x9F);
            ok.then_some(3)
        }
        0xE3 if b.get(i + 1) == Some(&0x80) && b.get(i + 2) == Some(&0x80) => Some(3),
        0xEF if b.get(i + 1) == Some(&0xBB) && b.get(i + 2) == Some(&0xBF) => Some(3),
        _ => None,
    }
}

/// \s* 탐욕: 끝날 수 있는 위치들(긴 것부터)
fn spaces_greedy(b: &[u8], from: usize) -> Vec<usize> {
    let mut ends = vec![from];
    let mut i = from;
    while let Some(n) = space_at(b, i) {
        i += n;
        ends.push(i);
    }
    ends.reverse();
    ends
}

fn skip_spaces(b: &[u8], mut i: usize) -> usize {
    while let Some(n) = space_at(b, i) {
        i += n;
    }
    i
}

fn starts_ci(b: &[u8], at: usize, lit: &[u8]) -> bool {
    b.get(at..at + lit.len()).is_some_and(|w| w.eq_ignore_ascii_case(lit))
}

fn quote(c: u8) -> bool {
    c == b'"' || c == b'\''
}

/// ["']([^"']+)["'] 가 t 에서 맞으면 (잡은 조각, 끝)
fn quoted(b: &[u8], t: usize) -> Option<(usize, usize, usize)> {
    if !quote(*b.get(t)?) {
        return None;
    }
    let mut e = t + 1;
    while e < b.len() && !quote(b[e]) {
        e += 1;
    }
    (e > t + 1 && e < b.len()).then_some((t + 1, e, e + 1))
}

fn word(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_'
}

/// 공백(\s)들 바로 앞 위치: i 에서 뒤로 공백을 건너뛰어요.
fn back_over_spaces(b: &[u8], mut i: usize) -> usize {
    loop {
        let one = i >= 1 && space_at(b, i - 1) == Some(1);
        let two = i >= 2 && space_at(b, i - 2) == Some(2);
        let three = i >= 3 && space_at(b, i - 3) == Some(3);
        if one {
            i -= 1;
        } else if two {
            i -= 2;
        } else if three {
            i -= 3;
        } else {
            return i;
        }
    }
}

/// /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi — 맞는 곳은 반드시 '=' 를 지나서, '=' 만 빠르게 찾고 뒤로 이름을 확인해요.
pub fn html_refs(b: &[u8]) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    let mut last = 0;
    for eq in memchr::memchr_iter(b'=', b) {
        if eq < last {
            continue;
        }
        let name_end = back_over_spaces(b, eq);
        let start = if name_end >= 3 && starts_ci(b, name_end - 3, b"src") {
            name_end - 3
        } else if name_end >= 4 && starts_ci(b, name_end - 4, b"href") {
            name_end - 4
        } else {
            continue;
        };
        if start < last || (start > 0 && word(b[start - 1])) {
            continue;
        }
        if let Some((s, t, end)) = quoted(b, skip_spaces(b, eq + 1)) {
            out.push((s, t));
            last = end;
        }
    }
    out
}

/// [^'"\n;] 한 글자(바이트 기준: UTF-8 여러 바이트 글자는 모두 이 모임에 들어요)
fn lazy_class(c: u8) -> bool {
    !matches!(c, b'\'' | b'"' | b'\n' | b';')
}

/// [^'"\n;]*?\sfrom\s* 다음 ["']…["'] — 게으른 반복을 x 에서 시작해 한 글자씩 늘리며 시도
fn lazy_from_quoted(b: &[u8], x0: usize) -> Option<(usize, usize, usize)> {
    let mut x = x0;
    loop {
        if let Some(n) = space_at(b, x) {
            if b.get(x + n..x + n + 4) == Some(b"from") {
                let f = x + n + 4;
                // \s* 탐욕 뒤 따옴표: 가장 긴 것만 맞을 수 있어요(공백은 따옴표가 아니니까)
                if let Some(r) = quoted(b, skip_spaces(b, f)) {
                    return Some(r);
                }
            }
        }
        if x < b.len() && lazy_class(b[x]) {
            // 한 글자(UTF-8 이면 여러 바이트) 늘리기
            x += 1;
            while x < b.len() && (b[x] & 0xC0) == 0x80 {
                x += 1;
            }
        } else {
            return None;
        }
    }
}

/// /(?:import\s*(?:[^'"\n;]*?\sfrom\s*)?|export\s+[^'"\n;]*?\sfrom\s*|import\s*\(\s*)["']([^"']+)["']/g
pub fn js_refs(b: &[u8]) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    // "import"·"export" 가 나오는 곳만 차례로(고정 글자 찾기 도구로) 봐요.
    let mut starts: Vec<usize> = memchr::memmem::find_iter(b, b"import").chain(memchr::memmem::find_iter(b, b"export")).collect();
    starts.sort_unstable();
    let mut last = 0;
    for p in starts {
        if p < last {
            continue;
        }
        let hit = if b[p..].starts_with(b"import") {
            // 갈래 1: import\s*(…)? 다음 따옴표 — \s* 를 긴 것부터 되짚어요.
            let mut found = None;
            for s in spaces_greedy(b, p + 6) {
                if let Some(r) = lazy_from_quoted(b, s) {
                    found = Some(r);
                    break;
                }
                if let Some(r) = quoted(b, s) {
                    found = Some(r);
                    break;
                }
            }
            // 갈래 3: import\s*\(\s*["']
            found.or_else(|| {
                let e = skip_spaces(b, p + 6);
                (b.get(e) == Some(&b'(')).then(|| quoted(b, skip_spaces(b, e + 1))).flatten()
            })
        } else if b[p..].starts_with(b"export") {
            // 갈래 2: export\s+[^'"\n;]*?\sfrom\s*["'] — \s+ 를 긴 것부터(적어도 하나)
            let ends = spaces_greedy(b, p + 6);
            ends.into_iter().filter(|&s| s > p + 6).find_map(|s| lazy_from_quoted(b, s))
        } else {
            None
        };
        if let Some((s, t, end)) = hit {
            out.push((s, t));
            last = end;
        }
    }
    out
}

/// /url\(\s*["']?([^"')]+)["']?\s*\)/gi
pub fn css_refs(b: &[u8]) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    let mut last = 0;
    'scan: for p in memchr::memchr2_iter(b'u', b'U', b) {
        if p < last {
            continue;
        }
        if starts_ci(b, p, b"url(") {
            for s in spaces_greedy(b, p + 4) {
                for take in [true, false] {
                    if take && !b.get(s).copied().is_some_and(quote) {
                        continue;
                    }
                    let r0 = s + take as usize;
                    let mut r = r0;
                    while r < b.len() && !matches!(b[r], b'"' | b'\'' | b')') {
                        r += 1;
                    }
                    if r == r0 {
                        continue;
                    }
                    // 닫는 따옴표(있으면 먼저 가져가요) → \s* → ')'
                    let mut tails = Vec::with_capacity(2);
                    if b.get(r).copied().is_some_and(quote) {
                        tails.push(r + 1);
                    }
                    tails.push(r);
                    for q in tails {
                        let w = skip_spaces(b, q);
                        if b.get(w) == Some(&b')') {
                            out.push((r0, r));
                            last = w + 1;
                            continue 'scan;
                        }
                    }
                }
            }
        }
    }
    out
}

/// kind: "html" | "css" | "js" — 파일 바이트에서 잡은 글자들
pub fn refs(kind: &str, bytes: &[u8]) -> R<Vec<String>> {
    let text = core::str::from_utf8(bytes).map_err(|_| Fallback("not utf-8"))?;
    let spans = match kind {
        "html" => html_refs(bytes),
        "css" => css_refs(bytes),
        "js" => js_refs(bytes),
        _ => return Err(Fallback("kind")),
    };
    Ok(spans.into_iter().map(|(s, e)| text[s..e].to_string()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn t(kind: &str, s: &str) -> Vec<String> {
        refs(kind, s.as_bytes()).unwrap()
    }
    #[test]
    fn same_as_the_javascript_regexes() {
        assert_eq!(t("html", r#"<script src="./a.js"></script><link HREF = 'b.css'><a xsrc="no">"#), vec!["./a.js", "b.css"]);
        assert_eq!(t("js", r#"import a from "./a.js";import "./b.js";export {x} from './c.js';import("./d.js");import from 'e'"#), vec!["./a.js", "./b.js", "./c.js", "./d.js", "e"]);
        assert_eq!(t("css", r#"a{background:url( "x.png" )} b{src:url(y.woff2)} c{url(  ")}"#), vec!["x.png", "y.woff2", " "]);
    }
}
