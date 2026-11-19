//! 다크 모드: 투명 아이콘·로고의 어두운 무채색 글자를 읽기 쉽게 밝혀요.
//! src/modules/dark/icon-contrast.js 의 repairIconPixels 를 그대로 옮긴 것이에요(결과가 바이트 단위로 같아야 해요).
//!
//! 자바스크립트와 결과를 똑같이 맞추려고, 거듭제곱(**)이 들어가는 채널 밝기 표(0~255, 256개)와
//! 배경 밝기는 자바스크립트가 계산해서 넘겨줘요. 여기서는 곱셈·덧셈·나눗셈·비교만 해서 IEEE 754 결과가 같아요.

/// 채널 값(0~255) → 선형 밝기. 자바스크립트가 채워 줘요.
pub struct Table(pub [f64; 256]);

const W: [f64; 3] = [0.2126, 0.7152, 0.0722];

#[inline]
fn luminance(t: &Table, r: u8, g: u8, b: u8) -> f64 {
    // JS: [r,g,b].map(lin).reduce((sum, v, i) => sum + v * w[i], 0) — 같은 순서로 더해요.
    let mut sum = 0.0f64;
    sum += t.0[r as usize] * W[0];
    sum += t.0[g as usize] * W[1];
    sum += t.0[b as usize] * W[2];
    sum
}

#[inline]
fn contrast(a: f64, b: f64) -> f64 {
    (a.max(b) + 0.05) / (a.min(b) + 0.05)
}

/// JS Math.round(양수): 가장 가까운 정수, 딱 중간이면 +∞ 쪽.
#[inline]
fn js_round(x: f64) -> f64 {
    let f = x.floor();
    if x - f >= 0.5 { f + 1.0 } else { f }
}

/// readableColor(color, background, target) 중 이 함수가 쓰는 경우(불투명 무채색 픽셀)만 옮겼어요.
fn readable(t: &Table, rgb: [u8; 3], lb: f64, target: f64) -> Option<[u8; 3]> {
    if contrast(luminance(t, rgb[0], rgb[1], rgb[2]), lb) >= target {
        return None;
    }
    let max = rgb.iter().copied().max().unwrap_or(0) as i32;
    let min = rgb.iter().copied().min().unwrap_or(0) as i32;
    if max - min > 70 {
        return None;
    }
    let mut amount = 0.05f64;
    while amount <= 1.01 {
        let mut next = [0u8; 3];
        for (i, v) in rgb.iter().enumerate() {
            let v = *v as f64;
            next[i] = js_round(v + (255.0 - v) * amount.min(1.0)) as u8;
        }
        if contrast(luminance(t, next[0], next[1], next[2]), lb) >= target {
            return Some(next);
        }
        amount += 0.05;
    }
    None
}

pub struct Limits {
    pub width: u32,
    pub height: u32,
    pub pixels: u64,
    pub target: f64,
}

/// repairIconPixels 와 같아요. 바꿀 게 있으면 data를 고치고 true, 아니면 false(이때 data는 쓰지 말아요).
pub fn repair(t: &Table, data: &mut [u8], width: u32, height: u32, lb: f64, limits: &Limits) -> bool {
    if width == 0 || height == 0 || width > limits.width || height > limits.height || (width as u64) * (height as u64) > limits.pixels {
        return false;
    }
    if data.len() % 4 != 0 {
        return false;
    }
    let area = (width as f64) * (height as f64);
    let (mut clear, mut painted, mut neutral) = (0u64, 0u64, 0u64);
    for px in data.chunks_exact(4) {
        if px[3] < 8 {
            clear += 1;
        } else {
            painted += 1;
            let max = px[0].max(px[1]).max(px[2]) as i32;
            let min = px[0].min(px[1]).min(px[2]) as i32;
            if max - min <= 25 {
                neutral += 1;
            }
        }
    }
    if (clear as f64) < area * 0.2 || painted < 8 || (painted as f64) > area * 0.6 || neutral < 8 {
        return false;
    }
    // 같은 색은 결과도 같아서 작은 표에 기억해요(로고는 같은 회색 픽셀이 수만 개예요).
    const SLOTS: usize = 4096;
    let mut keys = [u32::MAX; SLOTS];
    let mut values = [0u32; SLOTS];
    let mut changed = 0u32;
    for px in data.chunks_exact_mut(4) {
        if px[3] < 8 {
            continue;
        }
        let max = px[0].max(px[1]).max(px[2]) as i32;
        let min = px[0].min(px[1]).min(px[2]) as i32;
        if max - min > 25 {
            continue;
        }
        let key = (px[0] as u32) << 16 | (px[1] as u32) << 8 | px[2] as u32;
        let slot = (key.wrapping_mul(2_654_435_761) >> 20) as usize % SLOTS;
        // 값: 0 = 그대로 둠, 1<<24 | rgb = 바꿈.
        let value = if keys[slot] == key {
            values[slot]
        } else {
            let rgb = [px[0], px[1], px[2]];
            let value = if contrast(luminance(t, rgb[0], rgb[1], rgb[2]), lb) >= 3.0 {
                0
            } else {
                match readable(t, rgb, lb, limits.target) {
                    Some(n) => 1 << 24 | (n[0] as u32) << 16 | (n[1] as u32) << 8 | n[2] as u32,
                    None => 0,
                }
            };
            keys[slot] = key;
            values[slot] = value;
            value
        };
        if value != 0 {
            px[0] = (value >> 16) as u8;
            px[1] = (value >> 8) as u8;
            px[2] = value as u8;
            changed += 1;
        }
    }
    changed >= 8
}

// ---- 글자·아이콘 색 대비 (src/modules/dark/contrast.js 의 readableColor / 글자 보정과 같아요) ----
//
// 여기서는 색 값이 소수일 수 있어서(겹친 반투명 면) 밝기 표를 못 써요. 결과를 자바스크립트와 똑같이 맞추려고
// 거듭제곱만 자바스크립트(`a ** b`)에게 맡기고, 나머지 계산은 JS와 같은 순서로 해요.

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "env")]
extern "C" {
    fn pow(a: f64, b: f64) -> f64;
}

#[cfg(target_arch = "wasm32")]
#[inline]
fn js_pow(a: f64, b: f64) -> f64 {
    // 자바스크립트의 순수한 계산 함수예요. 부작용이 없어요.
    unsafe { pow(a, b) }
}

#[cfg(not(target_arch = "wasm32"))]
#[inline]
fn js_pow(a: f64, b: f64) -> f64 {
    a.powf(b)
}

/// JS: v /= 255; v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
#[inline]
fn channel(v: f64) -> f64 {
    let v = v / 255.0;
    if v <= 0.04045 { v / 12.92 } else { js_pow((v + 0.055) / 1.055, 2.4) }
}

/// JS luminance(c): 소수 색도 받아요. 더하는 순서도 같아요.
#[inline]
fn lum(c: &[f64; 4]) -> f64 {
    let mut sum = 0.0f64;
    sum += channel(c[0]) * W[0];
    sum += channel(c[1]) * W[1];
    sum += channel(c[2]) * W[2];
    sum
}

/// JS composite(front, back): 결과 투명도는 언제나 1이에요.
#[inline]
fn composite(front: &[f64; 4], back: &[f64; 4]) -> [f64; 4] {
    let a = front[3];
    [front[0] * a + back[0] * (1.0 - a), front[1] * a + back[1] * (1.0 - a), front[2] * a + back[2] * (1.0 - a), 1.0]
}

/// JS textContext 안의 over(front, back).
#[inline]
fn over(front: &[f64; 4], back: &[f64; 4]) -> [f64; 4] {
    let a = front[3] + back[3] * (1.0 - front[3]);
    let mut out = [0.0, 0.0, 0.0, a];
    // JS: a ? ... : 0  (0과 NaN은 거짓)
    if a != 0.0 && !a.is_nan() {
        for i in 0..3 {
            out[i] = (front[i] * front[3] + back[i] * back[3] * (1.0 - front[3])) / a;
        }
    }
    out
}

/// 글자 뒤에 겹친 면(안쪽부터 바깥쪽 순서) 하나: 색과 투명도.
pub struct Layer {
    pub color: [f64; 4],
    pub opacity: f64,
}

/// JS textContext 의 render(foreground).
fn render(fg: &[f64; 4], layers: &[Layer]) -> [f64; 4] {
    let mut color = *fg;
    for layer in layers {
        color = over(&color, &layer.color);
        color[3] *= layer.opacity;
    }
    over(&color, &[255.0, 255.0, 255.0, 1.0])
}

/// JS repairColor(foreground, ratio, target). ratio 는 대비를 재는 함수예요.
/// 바꿀 색(정수 RGB, 소수일 수도 있는 JS 값 그대로)을 돌려주고, 바꿀 게 없으면 None.
pub fn repair_color(fg: &[f64; 4], target: f64, ratio: &mut dyn FnMut(&[f64; 4]) -> f64) -> Option<[f64; 3]> {
    if ratio(fg) >= target {
        return None;
    }
    let max = fg[0].max(fg[1]).max(fg[2]);
    let min = fg[0].min(fg[1]).min(fg[2]);
    if max - min > 70.0 {
        return None;
    }
    let mut amount = 0.05f64;
    while amount <= 1.01 {
        let k = if amount < 1.0 { amount } else { 1.0 };
        let next = [
            js_round(fg[0] + (255.0 - fg[0]) * k),
            js_round(fg[1] + (255.0 - fg[1]) * k),
            js_round(fg[2] + (255.0 - fg[2]) * k),
        ];
        if ratio(&[next[0], next[1], next[2], fg[3]]) >= target {
            return Some(next);
        }
        amount += 0.05;
    }
    None
}

/// JS readableColor(foreground, background, target).
pub fn readable_color(fg: &[f64; 4], bg: &[f64; 4], target: f64) -> Option<[f64; 3]> {
    let lb = lum(bg);
    repair_color(fg, target, &mut |c| contrast(lum(&composite(c, bg)), lb))
}

/// JS 글자 보정: repairColor(foreground, textContext(el).ratio, target).
pub fn repair_text(fg: &[f64; 4], layers: &[Layer], target: f64) -> Option<[f64; 3]> {
    let paper = lum(&render(&[0.0, 0.0, 0.0, 0.0], layers));
    repair_color(fg, target, &mut |c| contrast(lum(&render(c, layers)), paper))
}

// ---- WebAssembly 경계(C ABI): 포인터·길이·숫자만 주고받아요 ----

static mut TABLE: Table = Table([0.0; 256]);

/// 색 계산 입출력 칸: 0..3 = 결과 RGB, 4.. = 겹친 면(면 하나에 5칸: r, g, b, a, 투명도).
pub const MAX_LAYERS: usize = 24;
static mut COLOR_IO: [f64; 4 + MAX_LAYERS * 5] = [0.0; 4 + MAX_LAYERS * 5];

#[no_mangle]
pub extern "C" fn color_io_ptr() -> *mut f64 {
    core::ptr::addr_of_mut!(COLOR_IO) as *mut f64
}

#[inline]
fn finite(values: &[f64]) -> bool {
    values.iter().all(|v| v.is_finite())
}

fn write_result(result: Option<[f64; 3]>) -> i32 {
    match result {
        Some(next) => {
            let io = unsafe { &mut *core::ptr::addr_of_mut!(COLOR_IO) };
            io[..3].copy_from_slice(&next);
            1
        }
        None => 0,
    }
}

/// readableColor. 1 = 바꿈(결과는 color_io 0..3), 0 = 그대로, -1 = 이상한 값이라 자바스크립트가 직접 계산.
#[no_mangle]
pub extern "C" fn readable_rgb(fr: f64, fg: f64, fb: f64, fa: f64, br: f64, bgg: f64, bb: f64, ba: f64, target: f64) -> i32 {
    if !finite(&[fr, fg, fb, fa, br, bgg, bb, ba, target]) {
        return -1;
    }
    write_result(readable_color(&[fr, fg, fb, fa], &[br, bgg, bb, ba], target))
}

/// 글자 보정. 겹친 면 count 개를 color_io 4.. 에 미리 써 둬요. 반환값은 readable_rgb 와 같아요.
#[no_mangle]
pub extern "C" fn repair_text_rgb(fr: f64, fg: f64, fb: f64, fa: f64, count: u32, target: f64) -> i32 {
    let count = count as usize;
    if count > MAX_LAYERS || !finite(&[fr, fg, fb, fa, target]) {
        return -1;
    }
    let io = unsafe { &*core::ptr::addr_of!(COLOR_IO) };
    let raw = &io[4..4 + count * 5];
    if !finite(raw) {
        return -1;
    }
    let mut layers: [Layer; MAX_LAYERS] = core::array::from_fn(|_| Layer { color: [0.0; 4], opacity: 0.0 });
    for (i, chunk) in raw.chunks_exact(5).enumerate() {
        layers[i] = Layer { color: [chunk[0], chunk[1], chunk[2], chunk[3]], opacity: chunk[4] };
    }
    write_result(repair_text(&[fr, fg, fb, fa], &layers[..count], target))
}

/// 자바스크립트가 채널 밝기 표 256칸을 써 넣을 곳.
#[no_mangle]
pub extern "C" fn table_ptr() -> *mut f64 {
    core::ptr::addr_of_mut!(TABLE) as *mut f64
}

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len);
    let ptr = buf.as_mut_ptr();
    core::mem::forget(buf);
    ptr
}

/// # Safety
/// ptr 은 alloc(len)이 돌려준 값이어야 해요.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len));
}

/// 1 = 바꿈(버퍼에 결과), 0 = 그대로 둠.
/// # Safety
/// ptr..ptr+len 은 alloc 으로 받은 메모리여야 해요.
#[no_mangle]
pub unsafe extern "C" fn repair_icon(ptr: *mut u8, len: usize, width: u32, height: u32, lb: f64, target: f64, lim_w: u32, lim_h: u32, lim_pixels: f64) -> i32 {
    let data = core::slice::from_raw_parts_mut(ptr, len);
    let table = &*core::ptr::addr_of!(TABLE);
    let limits = Limits { width: lim_w, height: lim_h, pixels: lim_pixels as u64, target };
    repair(table, data, width, height, lb, &limits) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table() -> Table {
        let mut t = [0.0; 256];
        for (i, slot) in t.iter_mut().enumerate() {
            let v = i as f64 / 255.0;
            *slot = if v <= 0.04045 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) };
        }
        Table(t)
    }
    const ICON: Limits = Limits { width: 512, height: 256, pixels: 65536, target: 4.5 };
    const LOGO: Limits = Limits { width: 1200, height: 400, pixels: 320000, target: 10.0 };

    fn bg_lum(t: &Table) -> f64 {
        luminance(t, 24, 26, 27)
    }

    #[test]
    fn brightens_neutral_glyphs_and_keeps_brand_pixels_and_alpha() {
        let t = table();
        let mut data = vec![0u8; 20 * 20 * 4];
        for n in 0..25 { data[n * 4..n * 4 + 4].copy_from_slice(&[66, 66, 66, 120 + n as u8]); }
        for n in 25..50 { data[n * 4..n * 4 + 4].copy_from_slice(&[20, 180, 230, 255]); }
        let before = data.clone();
        assert!(repair(&t, &mut data, 20, 20, bg_lum(&t), &ICON));
        for n in 0..25 { assert!(data[n * 4] > 120); assert_eq!(data[n * 4 + 3], before[n * 4 + 3]); }
        assert_eq!(&data[25 * 4..], &before[25 * 4..]);
    }

    #[test]
    fn photos_large_and_readable_images_are_left_alone() {
        let t = table();
        let mut photo = vec![255u8; 20 * 20 * 4];
        assert!(!repair(&t, &mut photo, 20, 20, bg_lum(&t), &ICON));
        let mut good = vec![0u8; 20 * 20 * 4];
        for n in 0..25 { good[n * 4..n * 4 + 4].copy_from_slice(&[230, 230, 230, 255]); }
        assert!(!repair(&t, &mut good, 20, 20, bg_lum(&t), &ICON));
        assert!(!repair(&t, &mut good, 1024, 1024, bg_lum(&t), &ICON));
        assert!(!repair(&t, &mut [0u8; 7], 1, 1, bg_lum(&t), &ICON), "깨진 길이");
    }

    #[test]
    fn logo_limits_lift_a_black_logo() {
        let t = table();
        let (w, h) = (560usize, 140usize);
        let mut data = vec![0u8; w * h * 4];
        for y in 40..100 { for x in (60..500).step_by(2) { let i = (y * w + x) * 4; data[i..i + 4].copy_from_slice(&[0, 0, 0, 255]); } }
        let mut icon = data.clone();
        assert!(!repair(&t, &mut icon, w as u32, h as u32, bg_lum(&t), &ICON));
        assert!(repair(&t, &mut data, w as u32, h as u32, bg_lum(&t), &LOGO));
        let i = (50 * w + 60) * 4;
        assert!(data[i] >= 180);
        assert_eq!(data[3], 0);
    }

    #[test]
    fn js_round_ties_go_up() {
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(2.4999), 2.0);
        assert_eq!(js_round(254.5), 255.0);
    }
}
