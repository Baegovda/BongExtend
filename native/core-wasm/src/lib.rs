//! BongExtend 규칙·분석 로직의 Rust 판(WebAssembly). 자바스크립트와 한 다리로 이어져요.
//! 요청: {"f": 함수 이름, "a": [인자…]} (JSON) → 답: {"v": 결과} 또는 {"x": "예전 길로"}.
//! "x" 는 자바스크립트 규칙과 똑같이 만들 수 없는 드문 입력이라는 뜻이고, 그때는 예전 자바스크립트가 처리해요.
pub mod atom;
pub mod extra;
pub mod js;
pub mod otp;
pub mod profile;
pub mod zip;

use js::Fallback;
use serde_json::{json, Value};

/// 함수 이름 → 처리. 결과가 JS 와 다를 수 있으면 Fallback.
pub fn dispatch(name: &str, args: &[Value]) -> Result<Value, Fallback> {
    let arg = |i: usize| args.get(i);
    match name {
        // String(subject || ""), String(body || "") — 글자가 아닌 값은 예전 길로.
        "gmail.extractOtp" => otp::extract(&js::str_or_empty(arg(0))?, &js::str_or_empty(arg(1))?).map(|code| json!(code)),
        // 다운로드 규칙은 옮겨 봤지만, 계산이 너무 짧아서 다리를 건너는 비용 때문에 4배쯤 느려져서 자바스크립트에 두었어요.
        _ => Err(Fallback("unknown function")),
    }
}

/// 한 번의 요청 처리(글자 → 글자). 잘못된 요청도 "x" 로 답해서 자바스크립트가 예전 길을 쓰게 해요.
pub fn handle(request: &[u8]) -> Vec<u8> {
    let reply = match serde_json::from_slice::<Value>(request) {
        Ok(req) => {
            let name = req.get("f").and_then(Value::as_str).unwrap_or("");
            let args = req.get("a").and_then(Value::as_array).cloned().unwrap_or_default();
            match dispatch(name, &args) {
                Ok(v) => json!({"v": v}),
                Err(Fallback(why)) => json!({"x": why}),
            }
        }
        Err(_) => json!({"x": "bad request"}),
    };
    serde_json::to_vec(&reply).unwrap_or_else(|_| br#"{"x":"encode"}"#.to_vec())
}

// ---- WebAssembly 경계: 포인터·길이만 주고받아요 ----

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len.max(1));
    let ptr = buf.as_mut_ptr();
    core::mem::forget(buf);
    ptr
}

/// # Safety
/// ptr 은 alloc(len) 또는 call 의 답 주소여야 해요.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len.max(1)));
}

/// 긴 글을 받는 함수용: JSON 대신 글자를 그대로 받아요(긴 메일 본문에서 JSON 바꾸기 비용을 없애려고).
pub fn dispatch_text(name: &str, texts: &[&str]) -> Result<Value, Fallback> {
    let text = |i: usize| texts.get(i).copied().unwrap_or("");
    match name {
        "gmail.extractOtp" => otp::extract(text(0), text(1)).map(|code| json!(code)),
        "gmail.parseAtom" => atom::parse_atom(text(0)),
        // actions.js profileFromHtml(html, knownEmail)
        "gmail.profile" => profile::profile(text(0), text(1)).map(|(photo, email)| json!({"photo": photo, "email": email})),
        // 이식 실험(extra.rs, cargo 기능 experiments 일 때만 들어가요). 숫자는 JS String(x) 글자 그대로(−0 은 "-0").
        #[cfg(feature = "experiments")]
        "num.ko" => {
            let min: usize = text(1).parse().map_err(|_| Fallback("digits"))?;
            let max: usize = text(2).parse().map_err(|_| Fallback("digits"))?;
            extra::ko_number(text(0), min, max).map(|s| json!(s))
        }
        #[cfg(feature = "experiments")]
        "trans.target" => extra::target_language(text(0), text(1)).map(|b| json!(b)),
        #[cfg(feature = "experiments")]
        "image.original" => extra::original_image_url(text(0)).map(|s| json!(s)),
        #[cfg(feature = "experiments")]
        "shop.originalImage" => extra::original_product_image(text(0)).map(|s| json!(s)),
        #[cfg(feature = "experiments")]
        "dl.batch" => {
            let limit: usize = text(1).parse().map_err(|_| Fallback("limit"))?;
            extra::batch_urls(text(0), limit).map(|v| json!(v))
        }
        // 설치 순서 정렬(installPlan.ts orderFiles). 줄마다 "순위\t열쇠", text(1) = 줄 수
        "update.order" => {
            let n: usize = text(1).parse().map_err(|_| Fallback("count"))?;
            let mut items = Vec::with_capacity(n);
            for line in text(0).split('\n') {
                let (rank, key) = line.split_once('\t').ok_or(Fallback("line"))?;
                items.push((rank.parse::<i64>().map_err(|_| Fallback("rank"))?, key));
            }
            if items.len() != n {
                return Err(Fallback("count"));
            }
            extra::order_keys(&items).map(|v| json!(v))
        }
        // 줄마다 "top\theight\tid", text(1) = "up"|"down", text(2) = 줄 수
        #[cfg(feature = "experiments")]
        "trans.wiper" => {
            let n: usize = text(2).parse().map_err(|_| Fallback("count"))?;
            let mut boxes = Vec::with_capacity(n);
            for line in text(0).split('\n') {
                let mut parts = line.splitn(3, '\t');
                let top: f64 = parts.next().unwrap_or("").parse().map_err(|_| Fallback("top"))?;
                let height: f64 = parts.next().unwrap_or("").parse().map_err(|_| Fallback("height"))?;
                let id = parts.next().ok_or(Fallback("id"))?;
                boxes.push(extra::WiperBox { id, top, height });
            }
            if boxes.len() != n {
                return Err(Fallback("count"));
            }
            let (from, to, span, amin, amax, ls, le, order) = extra::wiper_order(&boxes, text(1) == "up")?;
            let order: Vec<Value> = order.into_iter().map(|(i, at, band, top, height)| json!([i, at, band, top, height])).collect();
            Ok(json!([from, to, span, amin, amax, ls, le, order]))
        }
        _ => Err(Fallback("unknown function")),
    }
}

/// 글자 묶음 풀기: [u32 이름 길이][이름][u32 개수][(u32 길이, 글자)…] — 길이는 리틀 엔디언 바이트 수.
pub fn handle_text(request: &[u8]) -> Vec<u8> {
    fn take<'a>(buf: &'a [u8], at: &mut usize) -> Option<&'a str> {
        let len = u32::from_le_bytes(buf.get(*at..*at + 4)?.try_into().ok()?) as usize;
        *at += 4;
        let bytes = buf.get(*at..*at + len)?;
        *at += len;
        core::str::from_utf8(bytes).ok()
    }
    let parsed = (|| {
        let mut at = 0usize;
        let name = take(request, &mut at)?;
        let count = u32::from_le_bytes(request.get(at..at + 4)?.try_into().ok()?) as usize;
        at += 4;
        let mut texts = Vec::with_capacity(count.min(16));
        for _ in 0..count {
            texts.push(take(request, &mut at)?);
        }
        Some((name, texts))
    })();
    // 피드 읽기는 결과 JSON 을 바로 써서 돌려줘요(객체를 거치지 않아 빨라요).
    if let Some(("gmail.parseAtom", texts)) = parsed.as_ref().map(|(n, t)| (*n, t)) {
        return match atom::parse_atom_json(texts.first().copied().unwrap_or("")) {
            Ok(raw) => format!("{{\"v\":{raw}}}").into_bytes(),
            Err(Fallback(why)) => serde_json::to_vec(&json!({"x": why})).unwrap_or_default(),
        };
    }
    let reply = match parsed {
        Some((name, texts)) => match dispatch_text(name, &texts) {
            Ok(v) => json!({"v": v}),
            Err(Fallback(why)) => json!({"x": why}),
        },
        None => json!({"x": "bad request"}),
    };
    serde_json::to_vec(&reply).unwrap_or_else(|_| br#"{"x":"encode"}"#.to_vec())
}

static mut REPLY_LEN: usize = 0;

/// 글자 묶음 요청(ptr,len) 처리. 답은 call 과 같은 방식(주소를 돌려주고 길이는 reply_len).
/// # Safety
/// ptr..ptr+len 은 alloc 으로 받은 메모리여야 해요.
#[no_mangle]
pub unsafe extern "C" fn call_text(ptr: *const u8, len: usize) -> *mut u8 {
    let request = core::slice::from_raw_parts(ptr, len);
    let reply = handle_text(request).into_boxed_slice();
    let out_len = reply.len();
    let out = Box::into_raw(reply) as *mut u8;
    REPLY_LEN = out_len;
    out
}

/// 요청(ptr,len)을 처리하고 답 주소를 돌려줘요. 답 길이는 reply_len() 으로 읽고, 다 읽으면 dealloc(답 주소, 답 길이).
/// # Safety
/// ptr..ptr+len 은 alloc 으로 받은 메모리여야 해요.
#[no_mangle]
pub unsafe extern "C" fn call(ptr: *const u8, len: usize) -> *mut u8 {
    let request = core::slice::from_raw_parts(ptr, len);
    let mut reply = handle(request);
    reply.shrink_to_fit();
    let out_len = reply.len();
    let mut boxed = reply.into_boxed_slice();
    let out = boxed.as_mut_ptr();
    core::mem::forget(boxed);
    REPLY_LEN = out_len;
    out
}

/// zip 파일 바이트(ptr,len)를 풀어요. 답은 [u32 JSON 길이][JSON][풀린 데이터] (zip::extract_reply), 길이는 reply_len.
/// # Safety
/// ptr..ptr+len 은 alloc 으로 받은 메모리여야 해요.
#[no_mangle]
pub unsafe extern "C" fn extract_zip(ptr: *const u8, len: usize) -> *mut u8 {
    let request = core::slice::from_raw_parts(ptr, len);
    let reply = zip::extract_reply(request).into_boxed_slice();
    let out_len = reply.len();
    let out = Box::into_raw(reply) as *mut u8;
    REPLY_LEN = out_len;
    out
}

#[no_mangle]
pub extern "C" fn reply_len() -> usize {
    unsafe { REPLY_LEN }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bridge_answers_value_or_fallback() {
        let unknown = handle(br#"{"f":"nope","a":[]}"#);
        assert_eq!(serde_json::from_slice::<Value>(&unknown).unwrap()["x"], "unknown function");
        let broken = handle(b"{");
        assert_eq!(serde_json::from_slice::<Value>(&broken).unwrap()["x"], "bad request");
    }
}
