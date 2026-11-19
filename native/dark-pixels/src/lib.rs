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

// ---- WebAssembly 경계(C ABI): 포인터·길이·숫자만 주고받아요 ----

static mut TABLE: Table = Table([0.0; 256]);

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
