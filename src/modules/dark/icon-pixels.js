// 다크 모드 아이콘·로고 픽셀 보정의 빠른 길: Rust(native/dark-pixels)를 WebAssembly로 돌려요.
// 결과는 icon-contrast.js 의 repairIconPixels(예전 자바스크립트 길)와 바이트 단위로 같아요(test/icon-pixels.test.js).
// WebAssembly를 못 쓰는 곳(차단·실패)이나 준비 전에는 undefined 를 돌려줘서, 부르는 쪽이 예전 길을 써요.
import {ICON_PIXELS_WASM_BASE64} from './icon-pixels-wasm.js';
import {luminance} from './contrast.js';

let engine = null;     // {exports, memory}
let state = 'idle';    // idle | loading | wasm | off
let loading = null;

// 자바스크립트와 같은 식으로 채널 밝기를 계산해 넘겨요(거듭제곱 결과를 두 언어가 똑같이 쓰게).
const channel = v => {v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;};

const decode = text => {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
};

/** WebAssembly를 준비해요(여러 번 불러도 한 번만). 실패하면 조용히 예전 길만 써요. */
export function prepareIconPixels() {
    if (state === 'wasm' || state === 'off') return Promise.resolve(state === 'wasm');
    if (loading) return loading;
    state = 'loading';
    loading = (async () => {
        try {
            if (typeof WebAssembly !== 'object') throw new Error('no WebAssembly');
            const {instance} = await WebAssembly.instantiate(decode(ICON_PIXELS_WASM_BASE64), {});
            const exports = instance.exports;
            const table = new Float64Array(exports.memory.buffer, exports.table_ptr(), 256);
            for (let v = 0; v < 256; v++) table[v] = channel(v);
            engine = {exports};
            state = 'wasm';
            return true;
        } catch {
            state = 'off';
            return false;
        } finally {
            globalThis.__bongIconPixelsEngine = state;
        }
    })();
    return loading;
}

export const iconPixelsEngine = () => state;

/**
 * repairIconPixels 와 같은 결과. 준비 전·실패 시 undefined(예전 길을 쓰라는 뜻), 바꿀 게 없으면 null.
 * @returns {Uint8ClampedArray | null | undefined}
 */
export function repairIconPixelsWasm(data, width, height, background, limits) {
    if (state !== 'wasm' || !engine) return undefined;
    const ex = engine.exports;
    const len = data.length;
    let ptr = 0;
    try {
        ptr = ex.alloc(len);
        new Uint8Array(ex.memory.buffer, ptr, len).set(data);
        const changed = ex.repair_icon(ptr, len, width >>> 0, height >>> 0, luminance(background), limits.target ?? 4.5, limits.width >>> 0, limits.height >>> 0, limits.pixels);
        return changed === 1 ? new Uint8ClampedArray(new Uint8Array(ex.memory.buffer, ptr, len)) : null;
    } catch {
        // 한 번이라도 잘못되면 이 페이지에서는 예전 길만 써요.
        state = 'off';
        engine = null;
        globalThis.__bongIconPixelsEngine = state;
        return undefined;
    } finally {
        if (ptr && state === 'wasm') {
            try { ex.dealloc(ptr, len); } catch { /* 메모리 정리 실패는 결과에 영향이 없어요. */ }
        }
    }
}
