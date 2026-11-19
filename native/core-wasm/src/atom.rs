//! Gmail Atom 피드 읽기: src/modules/gmail/atom.js 의 parseAtom 을 그대로 옮겼어요.
//! 정규식마다 자바스크립트가 찾는 순서(가장 왼쪽 시작, 욕심/게으른 반복, 되돌아가기)를 그대로 따라 짰어요.
//! 태그 이름 비교는 'i'(유니코드 없음)라 영문자만 대소문자를 무시해요 — 바이트로 비교하면 정확히 같아요.
//! 자바스크립트가 오류를 던지는 입력(&#99999999; 같은 범위 밖 글자, 깨진 %XX)은 Fallback 으로 예전 길에 맡겨요.
use crate::js::{is_js_space, js_trim, Fallback, R};
use serde_json::{json, Value};

/// hay 안에서 needle(영문자 대소문자 무시)을 from 부터 찾아요(바이트 위치).
/// 첫 글자가 영문자가 아니면(대부분 '<') 그 바이트를 memchr 로 빠르게 찾아서 그 자리만 비교해요.
fn find_ci(hay: &str, needle: &str, from: usize) -> Option<usize> {
    let h = hay.as_bytes();
    let n = needle.as_bytes();
    if n.is_empty() || from > h.len() {
        return None;
    }
    let first = n[0];
    let mut i = from;
    if !first.is_ascii_alphabetic() {
        while let Some(k) = memchr::memchr(first, &h[i..]) {
            let at = i + k;
            if at + n.len() > h.len() {
                return None;
            }
            if h[at..at + n.len()].eq_ignore_ascii_case(n) {
                return Some(at);
            }
            i = at + 1;
        }
        return None;
    }
    let (lo, up) = (first.to_ascii_lowercase(), first.to_ascii_uppercase());
    while let Some(k) = memchr::memchr2(lo, up, &h[i..]) {
        let at = i + k;
        if at + n.len() > h.len() {
            return None;
        }
        if h[at..at + n.len()].eq_ignore_ascii_case(n) {
            return Some(at);
        }
        i = at + 1;
    }
    None
}

/// tagText(block, name): `<name[^>]*>([\s\S]*?)</name>` (i) 의 첫 맞음 안쪽을 JS trim 해서.
fn tag_text<'a>(block: &'a str, name: &str) -> &'a str {
    let open = format!("<{name}");
    let close = format!("</{name}>");
    let Some(p) = find_ci(block, &open, 0) else { return "" };
    // [^>]* 는 첫 '>' 까지만 갈 수 있어요. 첫 '<name' 에서 실패하면 뒤의 '<name' 도 반드시 실패해요.
    let Some(gt) = block[p + open.len()..].find('>').map(|k| p + open.len() + k) else { return "" };
    match find_ci(block, &close, gt + 1) {
        Some(c) => js_trim(&block[gt + 1..c]),
        None => "",
    }
}

/// decodeXml: CDATA 풀기 → &#숫자; → &lt; &gt; &quot; &apos; &amp; (이 순서대로, 각각 전체 바꾸기)
fn decode_xml(value: &str) -> R<String> {
    // 바꿀 거리가 없으면(CDATA 는 '<', 글자 참조는 '&' 가 있어야 해요) 그대로예요.
    if memchr::memchr2(b'&', b'<', value.as_bytes()).is_none() {
        return Ok(value.to_string());
    }
    // 1) <![CDATA[ ... ]]> (게으른 반복: 다음 ']]>' 까지)
    let mut out = String::with_capacity(value.len());
    let mut rest = value;
    while let Some(start) = rest.find("<![CDATA[") {
        let inner_from = start + "<![CDATA[".len();
        match rest[inner_from..].find("]]>") {
            Some(end) => {
                out.push_str(&rest[..start]);
                out.push_str(&rest[inner_from..inner_from + end]);
                rest = &rest[inner_from + end + 3..];
            }
            None => {
                // 이 자리에서 맞지 않으면 다음 글자부터 다시 찾아요(뒤에도 ']]>' 가 없으니 더 바뀌지 않아요).
                break;
            }
        }
    }
    out.push_str(rest);
    // 2) &#(\d+); — '&#' 가 없으면 건너뛰어요.
    let s = out;
    let s = if s.contains("&#") { decode_numeric(&s)? } else { s };
    // 3) &lt; &gt; &quot; &apos; &amp; — 차례대로 전체 바꾸기와 결과가 같아요: 바뀐 글자(< > " ' &)는 새 참조를 만들지 못하고,
    //    &amp; 가 마지막이라 "&amp;lt;" 는 "&lt;" 로 남아요. 그래서 한 번 훑으며 한꺼번에 바꿔요(바꾼 결과는 다시 보지 않아요).
    if !s.contains('&') {
        return Ok(s);
    }
    let b = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut last = 0;
    let mut i = 0;
    while let Some(k) = memchr::memchr(b'&', &b[i..]) {
        let at = i + k;
        let rest = &b[at..];
        let (pat_len, ch) = if rest.starts_with(b"&lt;") { (4, '<') } else if rest.starts_with(b"&gt;") { (4, '>') } else if rest.starts_with(b"&quot;") { (6, '"') } else if rest.starts_with(b"&apos;") { (6, '\'') } else if rest.starts_with(b"&amp;") { (5, '&') } else { (0, ' ') };
        if pat_len > 0 {
            out.push_str(&s[last..at]);
            out.push(ch);
            last = at + pat_len;
            i = last;
        } else {
            i = at + 1;
        }
    }
    out.push_str(&s[last..]);
    Ok(out)
}

fn decode_numeric(s: &str) -> R<String> {
    let b = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let (mut i, mut last) = (0usize, 0usize);
    while let Some(k) = memchr::memchr(b'&', &b[i..]) {
        let at = i + k;
        i = at + 1;
        if b.get(at + 1) != Some(&b'#') {
            continue;
        }
        let mut j = at + 2;
        while j < b.len() && b[j].is_ascii_digit() {
            j += 1;
        }
        if j == at + 2 || b.get(j) != Some(&b';') {
            continue;
        }
        // Number(code): 아주 긴 숫자는 Infinity 가 되어 그대로 둬요.
        let n: f64 = s[at + 2..j].parse().unwrap_or(f64::INFINITY);
        if !n.is_finite() {
            i = j + 1;
            continue;
        }
        if n > 0x10FFFF as f64 {
            return Err(Fallback("fromCodePoint range")); // JS 는 RangeError 를 던져요.
        }
        let c = char::from_u32(n as u32).ok_or(Fallback("lone surrogate"))?; // JS 는 깨진 글자를 만들어요.
        out.push_str(&s[last..at]);
        out.push(c);
        last = j + 1;
        i = last;
    }
    out.push_str(&s[last..]);
    Ok(out)
}

/// stripTags: decodeXml → /<[^>]+>/g 지우기 → /\s+/g 를 " " 로 → trim
fn strip_tags(value: &str) -> R<String> {
    let decoded = decode_xml(value)?;
    if memchr::memchr(b'<', decoded.as_bytes()).is_none() {
        return Ok(collapse_spaces(&decoded));
    }
    // /<[^>]+>/g: '<' 바로 다음이 '>' 가 아니고, 뒤에 '>' 가 있으면 그 '>' 까지 지워요. 사이 글자는 통째로 옮겨요.
    let mut no_tags = String::with_capacity(decoded.len());
    let b = decoded.as_bytes();
    let (mut i, mut last) = (0usize, 0usize);
    while let Some(k) = memchr::memchr(b'<', &b[i..]) {
        let at = i + k;
        if b.get(at + 1).is_some_and(|c| *c != b'>') {
            if let Some(g) = memchr::memchr(b'>', &b[at + 1..]) {
                no_tags.push_str(&decoded[last..at]);
                last = at + 1 + g + 1;
                i = last;
                continue;
            }
            break; // 뒤에 '>' 가 없으면 더는 지울 게 없어요.
        }
        i = at + 1;
    }
    no_tags.push_str(&decoded[last..]);
    Ok(collapse_spaces(&no_tags))
}

/// /\s+/g → " " 다음 trim. 공백이 아닌 글자 묶음은 통째로 옮겨요.
fn collapse_spaces(text: &str) -> String {
    let mut spaced = String::with_capacity(text.len());
    let mut run_start = 0usize;
    let mut in_space = false;
    for (i, ch) in text.char_indices() {
        if is_js_space(ch) {
            if !in_space {
                spaced.push_str(&text[run_start..i]);
                spaced.push(' ');
                in_space = true;
            }
            run_start = i + ch.len_utf8();
        } else {
            in_space = false;
        }
    }
    spaced.push_str(&text[run_start..]);
    js_trim(&spaced).to_string()
}

fn is_word(c: Option<char>) -> bool {
    c.is_some_and(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// `<link\b[^>]*\bhref="([^"]+)"` (i) 의 첫 맞음 값.
fn link_href(block: &str) -> String {
    let mut from = 0;
    while let Some(p) = find_ci(block, "<link", from) {
        from = p + 1;
        let after = p + "<link".len();
        // \b: 'k' 다음 글자는 낱말 글자가 아니어야 해요.
        if is_word(block[after..].chars().next()) {
            continue;
        }
        // [^>]* 는 첫 '>' 전까지. 욕심껏 먹고 뒤에서부터 \bhref="…" 를 찾아요(가장 오른쪽이 먼저).
        let limit = block[after..].find('>').map(|k| after + k).unwrap_or(block.len());
        let region = &block[after..limit];
        let mut best: Option<String> = None;
        let mut search = 0;
        let mut hits = Vec::new();
        while let Some(k) = find_ci(region, "href=\"", search) {
            hits.push(after + k);
            search = k + 1;
        }
        for &k in hits.iter().rev() {
            let before = block[..k].chars().next_back();
            if is_word(before) {
                continue; // \b 아님
            }
            let value_from = k + "href=\"".len();
            if let Some(q) = block[value_from..].find('"') {
                if q > 0 {
                    best = Some(block[value_from..value_from + q].to_string());
                    break;
                }
            }
        }
        if let Some(v) = best {
            return v;
        }
    }
    String::new()
}

/// decodeURIComponent — 깨진 %XX·잘못된 UTF-8 이면 JS 는 URIError 를 던져요 → Fallback.
fn decode_uri_component(s: &str) -> R<String> {
    let b = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    let hex = |c: u8| (c as char).to_digit(16);
    while i < b.len() {
        if b[i] != b'%' {
            let ch = s[i..].chars().next().unwrap_or('\u{FFFD}');
            out.push(ch);
            i += ch.len_utf8();
            continue;
        }
        let mut bytes = Vec::new();
        let read = |at: usize| -> Option<u8> {
            if b.get(at) != Some(&b'%') { return None; }
            Some((hex(*b.get(at + 1)?)? * 16 + hex(*b.get(at + 2)?)?) as u8)
        };
        let first = read(i).ok_or(Fallback("URIError"))?;
        bytes.push(first);
        i += 3;
        let need = match first {
            0x00..=0x7F => 0,
            0xC0..=0xDF => 1,
            0xE0..=0xEF => 2,
            0xF0..=0xF7 => 3,
            _ => return Err(Fallback("URIError")),
        };
        for _ in 0..need {
            let next = read(i).ok_or(Fallback("URIError"))?;
            if next & 0xC0 != 0x80 { return Err(Fallback("URIError")); }
            bytes.push(next);
            i += 3;
        }
        // Rust 의 UTF-8 검사는 너무 긴 표현·서로게이트·범위 밖을 막아요(JS 와 같은 규칙).
        out.push_str(core::str::from_utf8(&bytes).map_err(|_| Fallback("URIError"))?);
    }
    Ok(out)
}

fn thread_from_link(link: &str, id: &str) -> R<String> {
    let hash = link.split('#').nth(1).unwrap_or("");
    let piece = hash.split('/').filter(|p| !p.is_empty()).last().unwrap_or("");
    if !piece.is_empty() && piece != "inbox" && piece != "all" {
        return decode_uri_component(piece);
    }
    // /:(\d+)\s*$/ — 끝의 JS 공백을 지우고, ':' 바로 뒤가 숫자들로 끝나야 해요.
    let trimmed = id.trim_end_matches(is_js_space);
    let digits_start = trimmed.trim_end_matches(|c: char| c.is_ascii_digit()).len();
    if digits_start < trimmed.len() && trimmed[..digits_start].ends_with(':') {
        return Ok(trimmed[digits_start..].to_string());
    }
    Ok(String::new())
}

fn is_local(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '%' | '+' | '-')
}

fn is_domain(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '.' | '-')
}

/// /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i 의 첫 맞음.
fn email_from_title(title: &str) -> String {
    let chars: Vec<char> = title.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if !is_local(chars[i]) {
            i += 1;
            continue;
        }
        // 욕심껏 로컬 부분 → 바로 '@' 여야 해요(짧게 해도 다음 글자가 로컬 글자라 '@' 가 될 수 없어요).
        let mut j = i;
        while j < chars.len() && is_local(chars[j]) { j += 1; }
        if chars.get(j) == Some(&'@') {
            let mut k = j + 1;
            while k < chars.len() && is_domain(chars[k]) { k += 1; }
            // 도메인을 뒤에서부터 줄여 가며 '.' + 영문자 2개 이상을 찾아요.
            let mut m = k;
            while m > j + 2 {
                m -= 1;
                if chars[m] == '.' {
                    let mut t = m + 1;
                    while t < chars.len() && chars[t].is_ascii_alphabetic() { t += 1; }
                    if t - (m + 1) >= 2 {
                        return chars[i..t].iter().collect();
                    }
                }
            }
        }
        // 같은 로컬 묶음 안의 다른 시작점도 같은 결과라 묶음 끝까지는 건너뛰지 않고 한 칸씩 가요(정확성 우선).
        i += 1;
    }
    String::new()
}

/// parseAtom(xml)
/// JSON 글자 쓰기(따옴표·역슬래시·제어 문자만 바꿔요).
fn push_json_str(out: &mut String, s: &str) {
    out.push('"');
    let b = s.as_bytes();
    let mut last = 0;
    for (i, &c) in b.iter().enumerate() {
        let esc = match c {
            b'"' => "\\\"",
            b'\\' => "\\\\",
            0x00..=0x1F => "",
            _ => continue,
        };
        out.push_str(&s[last..i]);
        if esc.is_empty() {
            out.push_str(&format!("\\u{:04x}", c));
        } else {
            out.push_str(esc);
        }
        last = i + 1;
    }
    out.push_str(&s[last..]);
    out.push('"');
}

/// parseAtom(xml) 결과를 JSON 글자로 바로 써요(객체를 만들었다가 다시 바꾸는 비용을 없애려고). 피드가 아니면 "null".
pub fn parse_atom_json(text: &str) -> R<String> {
    if !text.contains("<feed") {
        return Ok("null".to_string());
    }
    // /<fullcount>\s*(\d+)\s*<\/fullcount>/i
    let mut full = 0f64;
    let mut from = 0;
    while let Some(p) = find_ci(text, "<fullcount>", from) {
        from = p + 1;
        let skip_spaces = |mut k: usize| { while let Some(c) = text[k..].chars().next() { if is_js_space(c) { k += c.len_utf8(); } else { break; } } k };
        let k = skip_spaces(p + "<fullcount>".len());
        let mut e = k;
        while text.as_bytes().get(e).is_some_and(u8::is_ascii_digit) { e += 1; }
        if e == k { continue; }
        let k2 = skip_spaces(e);
        if find_ci(text, "</fullcount>", k2) == Some(k2) {
            full = text[k..e].parse::<f64>().unwrap_or(f64::INFINITY);
            break;
        }
    }
    let head = text.split("<entry>").next().unwrap_or("");
    let feed_title = strip_tags(tag_text(if head.is_empty() { text } else { head }, "title"))?;
    let mut list = String::with_capacity(text.len() / 2);
    let mut count = 0usize;
    let mut from = 0;
    while let Some(p) = find_ci(text, "<entry>", from) {
        let inner = p + "<entry>".len();
        let Some(end) = find_ci(text, "</entry>", inner) else { break };
        let block = &text[inner..end];
        from = end + "</entry>".len();
        let link = link_href(block);
        let id = strip_tags(tag_text(block, "id"))?;
        let thread = thread_from_link(&link, &id)?;
        let subject = strip_tags(tag_text(block, "title"))?;
        let snippet = strip_tags(tag_text(block, "summary"))?;
        let from_name = strip_tags(tag_text(block, "name"))?;
        let from_email = strip_tags(tag_text(block, "email"))?;
        let issued_raw = tag_text(block, "issued");
        let issued = strip_tags(if issued_raw.is_empty() { tag_text(block, "modified") } else { issued_raw })?;
        if id.is_empty() {
            continue;
        }
        if count > 0 { list.push(','); }
        count += 1;
        let subject = if subject.is_empty() { "(제목 없음)".to_string() } else { subject };
        for (i, (key, value)) in [("id", &id), ("thread", &thread), ("subject", &subject), ("snippet", &snippet), ("fromName", &from_name), ("fromEmail", &from_email), ("issued", &issued), ("link", &link)].into_iter().enumerate() {
            list.push(if i == 0 { '{' } else { ',' });
            list.push('"');
            list.push_str(key);
            list.push_str("\":");
            push_json_str(&mut list, value);
        }
        list.push('}');
    }
    let count_f = count as f64;
    let unread = if full.is_finite() { full.max(count_f) } else { count_f };
    let unread_text = if unread.fract() == 0.0 && unread.abs() < 1e15 { format!("{}", unread as i64) } else { serde_json::to_string(&unread).unwrap_or_else(|_| "0".into()) };
    let mut out = String::with_capacity(list.len() + 64);
    out.push_str("{\"unread\":");
    out.push_str(&unread_text);
    out.push_str(",\"email\":");
    push_json_str(&mut out, &email_from_title(&feed_title));
    out.push_str(",\"messages\":[");
    out.push_str(&list);
    out.push_str("]}");
    Ok(out)
}

/// 시험·비교용: JSON 글자를 값으로.
pub fn parse_atom(text: &str) -> R<Value> {
    serde_json::from_str(&parse_atom_json(text)?).map_err(|_| Fallback("encode"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_a_feed() {
        let feed = r#"<?xml version="1.0"?><feed><title>Gmail - Inbox for a.b@mail.example.com</title><fullcount> 3 </fullcount><entry><title>안녕 &amp; &#128512; <![CDATA[<b>x</b>]]></title><summary>  미리   보기 </summary><link rel="alternate" href="https://mail.google.com/mail/u/0?x=1&amp;y=2#inbox/18c%ED%95%9C" type="text/html" /><issued>2026-11-20</issued><id>tag:gmail.google.com,2004:1700</id><author><name>보낸이</name><email>s@ex.com</email></author></entry><entry><id></id></entry></feed>"#;
        let v = parse_atom(feed).unwrap();
        assert_eq!(v["unread"], json!(3));
        assert_eq!(v["email"], "a.b@mail.example.com");
        assert_eq!(v["messages"][0]["subject"], "안녕 & 😀 x");
        assert_eq!(v["messages"][0]["snippet"], "미리 보기");
        assert_eq!(v["messages"][0]["thread"], "18c한");
        assert_eq!(v["messages"].as_array().unwrap().len(), 1);
        assert_eq!(parse_atom("no feed").unwrap(), Value::Null);
        assert!(parse_atom("<feed><entry><title>&#99999999;</title><id>1</id></entry></feed>").is_err());
        assert!(parse_atom("<feed><entry><link href=\"x#inbox/%E0%A4\"/><id>1</id></entry></feed>").is_err());
    }
}

#[cfg(test)]
mod timing {
    #[test]
    #[ignore]
    fn feed_time() {
        let one = |i: usize| format!("<entry><title>제목 {i} &amp; 안내 &#128512;</title><summary>미리보기 글 {i} &lt;b&gt;굵게&lt;/b&gt; {}</summary><link rel=\"alternate\" href=\"https://mail.google.com/mail/u/0?account_id=a@b.com&amp;message_id=18c{i}&amp;view=conv&amp;extsrc=atom#inbox/18c{i}\" type=\"text/html\" /><modified>2026-11-20T01:00:00Z</modified><issued>2026-11-20T01:00:00Z</issued><id>tag:gmail.google.com,2004:17{i}</id><author><name>보낸이 {i}</name><email>s{i}@ex.com</email></author></entry>", "내용 ".repeat(20));
        let xml = format!("<?xml version=\"1.0\"?><feed version=\"0.3\"><title>Gmail - Inbox for a@b.com</title><fullcount>20</fullcount>{}</feed>", (0..20).map(one).collect::<String>());
        let t = std::time::Instant::now();
        for _ in 0..200 { let _ = super::parse_atom(&xml); }
        eprintln!("native parse: {:?}", t.elapsed() / 200);
        let v = super::parse_atom(&xml).unwrap();
        let t = std::time::Instant::now();
        for _ in 0..200 { let _ = serde_json::to_vec(&serde_json::json!({"v": v})); }
        eprintln!("native to_json: {:?}", t.elapsed() / 200);
        let block = &xml[xml.find("<entry>").unwrap() + 7..xml.find("</entry>").unwrap()];
        let n = 20000;
        let t = std::time::Instant::now();
        for _ in 0..n { let _ = super::tag_text(block, "summary"); }
        eprintln!("  tag_text: {:?}", t.elapsed() / n);
        let summary = super::tag_text(block, "summary");
        let t = std::time::Instant::now();
        for _ in 0..n { let _ = super::strip_tags(summary); }
        eprintln!("  strip_tags(summary): {:?}", t.elapsed() / n);
        let t = std::time::Instant::now();
        for _ in 0..n { let _ = super::link_href(block); }
        eprintln!("  link_href: {:?}", t.elapsed() / n);
        let t = std::time::Instant::now();
        for _ in 0..n { let _ = super::email_from_title("Gmail - Inbox for a@b.com"); }
        eprintln!("  email: {:?}", t.elapsed() / n);
        let t = std::time::Instant::now();
        for _ in 0..n { let _ = super::decode_xml(summary); }
        eprintln!("  decode_xml(summary): {:?}", t.elapsed() / n);
    }
}
