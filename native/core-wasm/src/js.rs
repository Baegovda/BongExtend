//! 자바스크립트 문자열 규칙 흉내. 결과가 예전 자바스크립트와 똑같아야 해서, 애매하면 Fallback 을 돌려줘요.
use serde_json::Value;

/// "이 입력은 예전 자바스크립트 길로 처리해 주세요"라는 뜻.
#[derive(Debug, PartialEq)]
pub struct Fallback(pub &'static str);
pub type R<T> = Result<T, Fallback>;

/// JS 의 trim() / \s 가 공백으로 보는 글자(WhiteSpace + LineTerminator).
pub fn is_js_space(c: char) -> bool {
    matches!(c, '\u{9}' | '\u{A}' | '\u{B}' | '\u{C}' | '\u{D}' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'..='\u{200A}' | '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}' | '\u{FEFF}')
}

pub fn js_trim(s: &str) -> &str {
    s.trim_matches(is_js_space)
}

/// UTF-16 기준 길이(JS 의 .length).
pub fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

/// JS 의 s.slice(0, n). 이모지 같은 두 칸 글자를 반으로 자르게 되면 JS 는 깨진 글자를 남겨서 똑같이 만들 수 없어요 → Fallback.
pub fn slice_utf16(s: &str, n: usize) -> R<String> {
    let mut used = 0usize;
    for (i, c) in s.char_indices() {
        let w = c.len_utf16();
        if used + w > n {
            return if used == n { Ok(s[..i].to_string()) } else { Err(Fallback("surrogate split")) };
        }
        used += w;
    }
    Ok(s.to_string())
}

/// JS 참/거짓 판단(JSON 값 기준).
pub fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f != 0.0 && !f.is_nan()),
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}

/// JS 의 String(v || "") 를 글자 값에만 맞춰요. 거짓이면 "", 글자면 그대로, 그 밖(숫자·객체 등)은 Fallback.
pub fn str_or_empty(v: Option<&Value>) -> R<String> {
    if !truthy(v) {
        return Ok(String::new());
    }
    match v {
        Some(Value::String(s)) => Ok(s.clone()),
        Some(Value::Bool(true)) => Ok("true".to_string()),
        _ => Err(Fallback("non-string value")),
    }
}

/// JS 의 /\.\.+/g → "." (점 두 개 이상을 하나로)
pub fn collapse_dots(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut run = 0usize;
    for c in s.chars() {
        if c == '.' {
            run += 1;
        } else {
            if run > 0 { out.push('.'); }
            run = 0;
            out.push(c);
        }
    }
    if run > 0 { out.push('.'); }
    out
}

/// JS 의 /[\\/:*?"<>|]/g → "_"
pub fn replace_unsafe_name_chars(s: &str) -> String {
    s.chars().map(|c| if matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn slicing_and_spaces() {
        assert_eq!(slice_utf16("가나다", 2).unwrap(), "가나");
        assert_eq!(slice_utf16("a😀b", 3).unwrap(), "a😀");
        assert!(slice_utf16("a😀b", 2).is_err());
        assert_eq!(js_trim("\u{FEFF} x \u{3000}"), "x");
        assert_eq!(js_trim("\u{85}x"), "\u{85}x", "JS 는 U+0085 를 공백으로 보지 않아요");
        assert_eq!(collapse_dots("a..b...c."), "a.b.c.");
        assert_eq!(utf16_len("😀"), 2);
    }
}
