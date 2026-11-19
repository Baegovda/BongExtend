//! 메일 인증번호(OTP) 찾기: src/modules/gmail/otp.js 의 extractMailOtp 를 그대로 옮겼어요.
//! 두 정규식(CONTEXT, CANDIDATE)을 자바스크립트 규칙대로 손으로 짰어요:
//! - CONTEXT 는 'gi'(유니코드 없음): 영문자만 대소문자 무시, \s 는 JS 공백, \b 는 [A-Za-z0-9_] 경계, 선택지는 적힌 순서대로.
//! - CANDIDATE 는 'giu': [A-Z0-9] 는 대소문자 접기로 ſ(U+017F)·K(U+212A)도 포함, 앞뒤 확인(lookbehind/lookahead).
//! 위치·길이는 자바스크립트처럼 UTF-16 칸으로 세요. 속도를 위해 글자 배열을 만들지 않고 UTF-8 바이트를 그대로 한 번 훑어요.
use crate::js::{is_js_space, Fallback, R};

#[inline]
fn char_at(s: &str, b: usize) -> Option<(char, usize)> {
    let c = s.get(b..)?.chars().next()?;
    Some((c, c.len_utf8()))
}

#[inline]
fn char_before(s: &str, b: usize) -> Option<char> {
    s[..b].chars().next_back()
}

// ---- CONTEXT ----

#[derive(Clone, Copy)]
enum P {
    /// 글자들(영문자는 대소문자 무시)
    Lit(&'static str),
    /// \s*
    Spaces,
    /// [ -]?
    OptSpaceDash,
    /// (?:a|b|c) — 적힌 순서대로
    Alt(&'static [&'static str]),
    /// \b
    Boundary,
}

const CONTEXT: &[&[P]] = &[
    &[P::Lit("인증"), P::Spaces, P::Alt(&["번호", "코드"])],
    &[P::Lit("확인"), P::Spaces, P::Alt(&["번호", "코드"])],
    &[P::Lit("일회용"), P::Spaces, P::Alt(&["번호", "코드", "비밀번호"])],
    &[P::Lit("보안"), P::Spaces, P::Alt(&["번호", "코드"])],
    &[P::Lit("verification"), P::Spaces, P::Lit("code")],
    &[P::Lit("security"), P::Spaces, P::Lit("code")],
    &[P::Lit("confirmation"), P::Spaces, P::Lit("code")],
    &[P::Lit("login"), P::Spaces, P::Lit("code")],
    &[P::Lit("sign"), P::OptSpaceDash, P::Lit("in"), P::Spaces, P::Lit("code")],
    &[P::Lit("one"), P::OptSpaceDash, P::Lit("time"), P::Spaces, P::Alt(&["code", "password", "passcode"])],
    &[P::Lit("passcode")],
    &[P::Boundary, P::Lit("otp"), P::Boundary],
    &[P::Lit("验证码")],
    &[P::Lit("驗證碼")],
    &[P::Lit("認証コード")],
];

/// 'i'(유니코드 없음): 영문자끼리만 대소문자를 무시해요. 바이트로 비교하면 한글·한자 바이트는 그대로, 영문자만 접혀서 정확히 같아요.
#[inline]
fn lit_at(s: &[u8], b: usize, word: &str) -> Option<usize> {
    let w = word.as_bytes();
    let end = b + w.len();
    (end <= s.len() && s[b..end].eq_ignore_ascii_case(w)).then_some(end)
}

#[inline]
fn is_word_byte(c: Option<&u8>) -> bool {
    // \b 의 낱말 글자는 [A-Za-z0-9_] 뿐이에요. 한글 등은 바이트가 모두 0x80 이상이라 낱말 글자가 아니에요.
    c.is_some_and(|c| c.is_ascii_alphanumeric() || *c == b'_')
}

/// 패턴 조각을 b 부터 맞춰 봐요(뒤 조각이 실패하면 앞 선택을 바꿔 다시 — 자바스크립트 되돌아가기와 같은 순서).
fn match_seq(text: &str, b: usize, seq: &[P]) -> Option<usize> {
    let s = text.as_bytes();
    let Some((first, rest)) = seq.split_first() else { return Some(b) };
    match *first {
        P::Lit(word) => lit_at(s, b, word).and_then(|e| match_seq(text, e, rest)),
        P::Spaces => {
            // 욕심껏 먹고, 안 되면 하나씩 덜 먹어요.
            let mut ends = vec![b];
            let mut e = b;
            while let Some((c, n)) = char_at(text, e) {
                if !is_js_space(c) { break; }
                e += n;
                ends.push(e);
            }
            ends.iter().rev().find_map(|&e| match_seq(text, e, rest))
        }
        P::OptSpaceDash => {
            let take = matches!(s.get(b), Some(b' ' | b'-')).then(|| match_seq(text, b + 1, rest)).flatten();
            take.or_else(|| match_seq(text, b, rest))
        }
        P::Alt(words) => words.iter().find_map(|w| lit_at(s, b, w).and_then(|e| match_seq(text, e, rest))),
        P::Boundary => {
            let before = if b == 0 { None } else { s.get(b - 1) };
            (is_word_byte(before) != is_word_byte(s.get(b))).then(|| match_seq(text, b, rest)).flatten()
        }
    }
}

/// 첫 글자로 맞을 수 있는 선택지만(CONTEXT 번호, 적힌 순서 그대로). 다른 선택지는 그 자리에서 절대 맞지 않아요.
fn starting_with(text: &str, b: usize) -> &'static [usize] {
    let s = text.as_bytes();
    match s[b] {
        b'v' | b'V' => &[4],
        b's' | b'S' => &[5, 8],
        b'c' | b'C' => &[6],
        b'l' | b'L' => &[7],
        b'o' | b'O' => &[9, 11],
        b'p' | b'P' => &[10],
        // 첫 글자 후보는 모두 3바이트 글자예요: 바이트 모양을 바로 비교해요(글자 해석 없이).
        0xE8..=0xED => match s.get(b..b + 3) {
            Some([0xEC, 0x9D, 0xB8]) => &[0],  // 인
            Some([0xED, 0x99, 0x95]) => &[1],  // 확
            Some([0xEC, 0x9D, 0xBC]) => &[2],  // 일
            Some([0xEB, 0xB3, 0xB4]) => &[3],  // 보
            Some([0xE9, 0xAA, 0x8C]) => &[12], // 验
            Some([0xE9, 0xA9, 0x97]) => &[13], // 驗
            Some([0xE8, 0xAA, 0x8D]) => &[14], // 認
            _ => &[],
        },
        _ => &[],
    }
}

fn utf16_of(text: &str, from: usize, to: usize) -> usize {
    text[from..to].chars().map(char::len_utf16).sum()
}

#[inline]
fn step(text: &str, b: usize) -> (usize, usize) {
    // (바이트 수, UTF-16 칸 수) — 올바른 UTF-8 이라 첫 바이트만 보면 알아요. 4바이트 글자(이모지 등)만 UTF-16 두 칸.
    match text.as_bytes()[b] {
        x if x < 0x80 => (1, 1),
        x if x < 0xE0 => (2, 1),
        x if x < 0xF0 => (3, 1),
        _ => (4, 2),
    }
}

/// CONTEXT 의 맞음: UTF-16 위치·길이와 바이트 시작.
#[derive(Clone, Copy)]
struct Ctx {
    u: usize,
    len: usize,
    b: usize,
}

fn contexts(text: &str) -> Vec<Ctx> {
    let s = text.as_bytes();
    let mut out = Vec::new();
    let (mut b, mut u) = (0usize, 0usize);
    while b < s.len() {
        let choices = starting_with(text, b);
        if !choices.is_empty() {
            if let Some(end) = choices.iter().find_map(|&k| match_seq(text, b, CONTEXT[k])) {
                if end > b {
                    let len = utf16_of(text, b, end);
                    out.push(Ctx { u, len, b });
                    b = end;
                    u += len;
                    continue;
                }
            }
        }
        let (n, w) = step(text, b);
        b += n;
        u += w;
    }
    out
}

// ---- CANDIDATE ----

#[inline]
fn is_cls(c: char) -> bool {
    // [A-Z0-9] + 'iu' 대소문자 접기: 영문 대소문자·숫자 + ſ(U+017F → s) + K(U+212A → k)
    c.is_ascii_alphanumeric() || c == '\u{17F}' || c == '\u{212A}'
}

/// b 의 글자가 후보 글자면 그 바이트 수.
#[inline]
fn cls_at(text: &str, b: usize) -> Option<usize> {
    match text.as_bytes().get(b)? {
        x if x.is_ascii_alphanumeric() => Some(1),
        x if *x < 0x80 => None,
        _ => char_at(text, b).filter(|(c, _)| is_cls(*c)).map(|(_, n)| n),
    }
}

#[inline]
fn digit_at(s: &[u8], b: usize) -> bool {
    s.get(b).is_some_and(u8::is_ascii_digit)
}

/// b 에서 CANDIDATE 가 맞으면 (끝 바이트, 글자 수). ſ·K 도 UTF-16 한 칸이라 글자 수 = UTF-16 길이.
fn candidate_at(text: &str, b: usize) -> Option<(usize, usize)> {
    let s = text.as_bytes();
    if b > 0 && char_before(text, b).is_some_and(is_cls) {
        return None; // (?<![A-Z0-9])
    }
    let ok_end = |end: usize| cls_at(text, end).is_none(); // (?![A-Z0-9])
    // 1) [0-9]{3}[ \t][0-9]{3}
    if (0..3).all(|k| digit_at(s, b + k)) && matches!(s.get(b + 3), Some(b' ' | b'\t')) && (4..7).all(|k| digit_at(s, b + k)) && ok_end(b + 7) {
        return Some((b + 7, 7));
    }
    // 후보 글자를 최대 8칸까지 세 둬요(각 칸의 끝 바이트).
    let mut ends = [0usize; 9];
    ends[0] = b;
    let mut cls = 0;
    while cls < 8 {
        match cls_at(text, ends[cls]) {
            Some(n) => { ends[cls + 1] = ends[cls] + n; cls += 1; }
            None => break,
        }
    }
    // 2) [A-Z0-9]{3}-[A-Z0-9]{3}
    if cls >= 3 && s.get(ends[3]) == Some(&b'-') {
        let mut e = ends[3] + 1;
        let mut ok = true;
        for _ in 0..3 {
            match cls_at(text, e) { Some(n) => e += n, None => { ok = false; break; } }
        }
        if ok && ok_end(e) {
            return Some((e, 7));
        }
    }
    // 3) [0-9]{4,8} (욕심껏, 안 되면 줄여요)
    let mut digits = 0;
    while digits < 8 && digit_at(s, b + digits) { digits += 1; }
    if let Some(n) = (4..=digits).rev().find(|n| ok_end(b + n)) {
        return Some((b + n, n));
    }
    // 4) [A-Z0-9]{6,8}
    (6..=cls).rev().find(|&n| ok_end(ends[n])).map(|n| (ends[n], n))
}

/// 후보가 걸칠 수 있는 글자(후보 글자, 공백, 탭, -). 이게 아닌 글자 바로 뒤는, 자바스크립트가 처음부터 읽었어도 끊어 읽는 위치가 같아요.
fn can_span(c: char) -> bool {
    is_cls(c) || c == ' ' || c == '\t' || c == '-'
}

fn otp_in(text: &str) -> Option<String> {
    let ctx = contexts(text);
    if ctx.is_empty() {
        return None;
    }
    let s = text.as_bytes();
    let mut ranked: Vec<(usize, String)> = Vec::new();
    // 후보는 문맥 단어에서 80칸 안에 있어야만 쓰여요. 그래서 문맥 단어 앞뒤(80 + 후보 최대 8칸)만 훑어요.
    // 훑기 시작점은 후보가 걸칠 수 없는 글자 바로 뒤로 물려서, 처음부터 읽은 자바스크립트와 끊어 읽는 위치가 같게 해요.
    const REACH: usize = 88;
    let (mut cursor_b, mut cursor_u, mut started) = (0usize, 0usize, false);
    for c in &ctx {
        let (mut p, mut pu, mut back) = (c.b, c.u, 0usize);
        while back < REACH && p > 0 {
            let ch = char_before(text, p).unwrap_or(' ');
            p -= ch.len_utf8();
            pu -= ch.len_utf16();
            back += ch.len_utf16();
        }
        while p > 0 {
            let ch = char_before(text, p).unwrap_or('.');
            if !can_span(ch) {
                break;
            }
            p -= ch.len_utf8();
            pu -= ch.len_utf16();
        }
        let end_u = c.u + c.len + REACH;
        let (mut b, mut u) = if started && cursor_b > p { (cursor_b, cursor_u) } else { (p, pu) };
        while b < s.len() && u < end_u {
            if cls_at(text, b).is_some() {
                if let Some((end, len)) = candidate_at(text, b) {
                    let word = &text[b..end];
                    if word.bytes().any(|c| c.is_ascii_digit()) {
                        let distance = ctx
                            .iter()
                            .map(|k| 0i64.max(u as i64 - k.u as i64 - k.len as i64).max(k.u as i64 - u as i64 - len as i64))
                            .min()
                            .unwrap_or(i64::MAX);
                        if distance <= 80 {
                            ranked.push((distance as usize, word.chars().filter(|c| *c != ' ' && *c != '\t').collect()));
                        }
                    }
                    b = end;
                    u += len;
                    continue;
                }
            }
            let (n, w) = step(text, b);
            b += n;
            u += w;
        }
        cursor_b = b;
        cursor_u = u;
        started = true;
    }
    ranked.sort_by_key(|r| r.0); // 안정 정렬(자바스크립트 sort 와 같음)
    match ranked.as_slice() {
        [] => None,
        [first, second, ..] if first.0 == second.0 && first.1 != second.1 => None,
        [first, ..] => Some(first.1.clone()),
    }
}

/// 본문은 앞 200,000 UTF-16 칸까지만(JS 의 slice). 이모지를 반으로 자르게 되면 예전 길로.
fn cut_body(body: &str) -> R<&str> {
    // UTF-8 바이트 수 ≥ UTF-16 칸 수라서, 바이트가 적으면 자를 필요가 없어요.
    if body.len() <= 200_000 {
        return Ok(body);
    }
    let mut used = 0usize;
    for (i, c) in body.char_indices() {
        let w = c.len_utf16();
        if used + w > 200_000 {
            return if used == 200_000 { Ok(&body[..i]) } else { Err(Fallback("surrogate split")) };
        }
        used += w;
    }
    Ok(body)
}

/// extractMailOtp(subject, body)
pub fn extract(subject: &str, body: &str) -> R<Option<String>> {
    let body = cut_body(body)?;
    for text in [subject, body] {
        if let Some(code) = otp_in(text) {
            return Ok(Some(code));
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn finds_codes_like_the_javascript() {
        assert_eq!(extract("Your verification code is 482913", "").unwrap(), Some("482913".into()));
        assert_eq!(extract("[알림]", "인증번호는 482 913 입니다").unwrap(), Some("482913".into()));
        assert_eq!(extract("login code: AB1-C2D", "").unwrap(), Some("AB1-C2D".into()));
        assert_eq!(extract("인증번호 123456 또는 654321", "").unwrap(), Some("123456".into()));
        assert_eq!(extract("코드 없음 123456", "").unwrap(), None, "문맥 단어가 없으면 없어요");
        assert_eq!(extract("OTP 123456789", "").unwrap(), None, "9자리는 후보가 아니에요");
        assert_eq!(extract("otpx 123456", "").unwrap(), None, "\\botp\\b");
        assert_eq!(extract("Sign-In Code 778899", "").unwrap(), Some("778899".into()));
        assert_eq!(extract("OTP \u{17F}12345", "").unwrap(), Some("\u{17F}12345".into()), "ſ 도 후보 글자예요(JS 와 같음)");
        assert_eq!(extract("OTP 1\u{17F}2345", "").unwrap(), Some("1\u{17F}2345".into()));
    }

    #[test]
    #[ignore]
    fn long_body_time() {
        let filler = "<td style=\"padding:4px\">안녕하세요 고객님, 주문 번호 20261120-778899 배송 안내입니다. Lorem ipsum dolor sit amet 12345 ABCDEF</td>\n".repeat(1500);
        let body = filler + "인증번호는 482913 입니다.";
        let t = std::time::Instant::now();
        for _ in 0..20 { let _ = extract("[알림] 로그인 안내", &body); }
        eprintln!("native extract: {:?} per call", t.elapsed() / 20);
    }
}
