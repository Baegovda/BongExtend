//! Gmail 페이지 HTML 에서 계정 프로필 사진 주소 찾기: src/modules/gmail/actions.js 의 profileFromHtml 을 그대로 옮겼어요.
//! 큰 페이지(수백 KB~2MB)에서 정규식 두 번 + toLowerCase 전체 복사를 하던 일을 바이트 단위 한 번 훑기로 해요.
//! 위치는 자바스크립트처럼 UTF-16 단위로 셉니다. toLowerCase 가 위치를 바꾸거나(U+0130) ASCII 로 바꾸는(U+212A)
//! 글자가 있으면 예전 길로 보내요.
use crate::js::{is_js_space, js_trim, Fallback, R};
use memchr::{memchr, memchr2_iter, memmem};

fn local_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'%' | b'+' | b'-')
}

fn domain_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-')
}

/// /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i 의 첫 맞음(ASCII 조각).
pub fn first_email(s: &[u8]) -> Option<(usize, usize)> {
    let mut from = 0;
    while let Some(off) = memchr(b'@', &s[from..]) {
        let at = from + off;
        from = at + 1;
        let mut start = at;
        while start > 0 && local_char(s[start - 1]) {
            start -= 1;
        }
        if start == at {
            continue;
        }
        let d0 = at + 1;
        let mut d1 = d0;
        while d1 < s.len() && domain_char(s[d1]) {
            d1 += 1;
        }
        let mut k = d1;
        while k > d0 + 1 {
            k -= 1;
            if s[k] == b'.' && s.get(k + 1).is_some_and(u8::is_ascii_alphabetic) && s.get(k + 2).is_some_and(u8::is_ascii_alphabetic) {
                let mut end = k + 1;
                while end < s.len() && s[end].is_ascii_alphabetic() {
                    end += 1;
                }
                return Some((start, end));
            }
        }
    }
    None
}

fn starts_ci(s: &[u8], at: usize, lit: &[u8]) -> bool {
    s.get(at..at + lit.len()).is_some_and(|w| w.eq_ignore_ascii_case(lit))
}

/// /https:\/\/lh3\.googleusercontent\.com\/a(?:-\/|\/)[A-Za-z0-9_\-=]+/gi 의 p 에서의 끝.
fn photo_in_page(s: &[u8], p: usize) -> Option<usize> {
    const LIT: &[u8] = b"https://lh3.googleusercontent.com/a";
    if !starts_ci(s, p, LIT) {
        return None;
    }
    let mut q = p + LIT.len();
    if s.get(q) == Some(&b'-') && s.get(q + 1) == Some(&b'/') {
        q += 2;
    } else if s.get(q) == Some(&b'/') {
        q += 1;
    } else {
        return None;
    }
    let start = q;
    while q < s.len() && (s[q].is_ascii_alphanumeric() || matches!(s[q], b'_' | b'-' | b'=')) {
        q += 1;
    }
    (q > start).then_some(q)
}

/// /https:\/\/mail\.google\.com\/mail\/u\/\d+\/[^"'\\\s<>]*photo[^"'\\\s<>]*/gi 의 p 에서의 끝.
fn photo_on_gmail(text: &str, p: usize) -> Option<usize> {
    const LIT: &[u8] = b"https://mail.google.com/mail/u/";
    let s = text.as_bytes();
    if !starts_ci(s, p, LIT) {
        return None;
    }
    let mut q = p + LIT.len();
    let d = q;
    while q < s.len() && s[q].is_ascii_digit() {
        q += 1;
    }
    if q == d || s.get(q) != Some(&b'/') {
        return None;
    }
    let run = q + 1;
    let mut end = run;
    for c in text[run..].chars() {
        if matches!(c, '"' | '\'' | '\\' | '<' | '>') || is_js_space(c) {
            break;
        }
        end += c.len_utf8();
    }
    memmem::find(&s[run..end].to_ascii_lowercase(), b"photo").map(|_| end)
}

/// UTF-8 바이트 조각의 UTF-16 길이(이어지는 바이트는 빼고, 4바이트 글자는 2로). 컴파일러가 묶어서 빠르게 세요.
fn utf16_units(bytes: &[u8]) -> usize {
    let continuation = bytes.iter().filter(|&&b| (b as i8) < -64).count();
    let four = bytes.iter().filter(|&&b| b >= 0xF0).count();
    bytes.len() - continuation + four
}

/// 대소문자 무시(ASCII) 찾기: needle 첫 글자 후보만 비교해요.
fn find_ci(s: &[u8], needle: &[u8]) -> Option<usize> {
    let first = *needle.first()?;
    memchr2_iter(first.to_ascii_lowercase(), first.to_ascii_uppercase(), s).find(|&p| starts_ci(s, p, needle))
}

/// profileFromHtml(html, knownEmail) → (photo, email)
pub fn profile(html: &str, known_email: &str) -> R<(String, String)> {
    let s = html.as_bytes();
    // toLowerCase 가 위치를 바꾸는 İ(U+0130 = C4 B0)·ASCII 로 바꾸는 K(U+212A = E2 84 AA)가 있으면 예전 길로.
    if memmem::find(s, &[0xC4, 0xB0]).is_some() || memmem::find(s, &[0xE2, 0x84, 0xAA]).is_some() {
        return Err(Fallback("case-changing char"));
    }
    let known = js_trim(known_email);
    let email: String = if !known.is_empty() {
        known.to_string()
    } else {
        first_email(s).map(|(a, b)| html[a..b].to_string()).unwrap_or_default()
    };
    // 두 정규식을 따로 돌린 것과 같아요: 앞 목록(사진 주소) 다음에 뒤 목록(Gmail 사진), 각자 겹치지 않게.
    let (mut page, mut gmail): (Vec<(usize, usize)>, Vec<(usize, usize)>) = (Vec::new(), Vec::new());
    let (mut last_page, mut last_gmail) = (0, 0);
    for p in memchr2_iter(b'h', b'H', s) {
        if p >= last_page {
            if let Some(end) = photo_in_page(s, p) {
                page.push((p, end));
                last_page = end;
            }
        }
        if p >= last_gmail {
            if let Some(end) = photo_on_gmail(html, p) {
                gmail.push((p, end));
                last_gmail = end;
            }
        }
    }
    page.extend(gmail);
    let photos = page;
    if photos.is_empty() {
        return Ok((String::new(), email));
    }
    let pick = |i: usize| html[photos[i].0..photos[i].1].to_string();
    if email.is_empty() {
        return Ok((pick(0), email));
    }
    if !email.is_ascii() {
        return Err(Fallback("email not ascii"));
    }
    let Some(byte_at) = find_ci(s, email.as_bytes()) else { return Ok((pick(0), email)) };
    if photos.len() == 1 {
        return Ok((pick(0), email));
    }
    // 거리는 UTF-16 위치로: 사진·메일 위치를 앞에서부터 차례로 셉니다.
    let mut marks: Vec<usize> = photos.iter().map(|p| p.0).chain(core::iter::once(byte_at)).collect();
    marks.sort_unstable();
    marks.dedup();
    let mut units = Vec::with_capacity(marks.len());
    let (mut prev, mut acc) = (0usize, 0usize);
    for &m in &marks {
        acc += utf16_units(&s[prev..m]);
        units.push((m, acc));
        prev = m;
    }
    let unit_of = |b: usize| units[units.binary_search_by_key(&b, |u| u.0).unwrap_or(0)].1 as i64;
    let at = unit_of(byte_at);
    let mut best = 0;
    for i in 1..photos.len() {
        if (unit_of(photos[i].0) - at).abs() < (unit_of(photos[best].0) - at).abs() {
            best = i;
        }
    }
    Ok((pick(best), email))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn picks_the_photo_nearest_the_account() {
        let html = r#"<img src="https://lh3.googleusercontent.com/a-/OTHER"> x <b>ada@gmail.com</b><img src="https://lh3.googleusercontent.com/a-/MINE">"#;
        assert_eq!(profile(html, "ada@gmail.com").unwrap(), ("https://lh3.googleusercontent.com/a-/MINE".into(), "ada@gmail.com".into()));
        assert_eq!(profile("<html>nope</html>", "").unwrap(), (String::new(), String::new()));
        let gmail = "x https://mail.google.com/mail/u/0/?ui=2&view=photo&x=1\" a@b.cd";
        assert_eq!(profile(gmail, "").unwrap(), ("https://mail.google.com/mail/u/0/?ui=2&view=photo&x=1".into(), "a@b.cd".into()));
        assert!(profile("İ https://lh3.googleusercontent.com/a/X", "").is_err());
    }
    #[test]
    #[ignore]
    fn big_page_time() {
        let filler = "<div class=\"a b c\" data-x=\"1\"><span>Lorem ipsum 내용 sample text</span><script>var q={\"k\":[1,2,3],\"s\":\"value\"};</script></div>\n";
        let html = format!("{}<img src=\"https://lh3.googleusercontent.com/a/ACg8ocSample=s64\">sample@example.invalid", filler.repeat(2_000_000 / filler.len()));
        let t = std::time::Instant::now();
        for _ in 0..10 {
            let _ = profile(&html, "");
        }
        eprintln!("profile 2MB: {:?}", t.elapsed() / 10);
    }
}
