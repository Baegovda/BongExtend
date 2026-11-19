// 다크 모드의 Rust(native/dark-pixels) → WebAssembly 엔진을 한 번만 불러와요.
// 아이콘 픽셀 보정(icon-pixels.js)과 글자색 대비 계산(contrast.js)이 같이 써요.
// WebAssembly를 못 쓰는 곳(차단·실패)이나 준비 전에는 엔진이 없어서, 부르는 쪽이 예전 자바스크립트 길을 써요.
import {ICON_PIXELS_WASM_BASE64} from './icon-pixels-wasm.js';

let engine = null;     // instance.exports
let state = 'idle';    // idle | loading | wasm | off
let loading = null;

// 자바스크립트와 같은 식으로 채널 밝기를 계산해 넘겨요(거듭제곱 결과를 두 언어가 똑같이 쓰게).
export const darkChannel = v => {v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;};

const decode = text => {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

const publish = () => {globalThis.__bongIconPixelsEngine = state;};

/** 엔진을 준비해요(여러 번 불러도 한 번만). 실패하면 조용히 예전 길만 써요. */
export function prepareDarkWasm() {
  if (state === 'wasm' || state === 'off') return Promise.resolve(state === 'wasm');
  if (loading) return loading;
  state = 'loading';
  loading = (async () => {
    try {
      if (typeof WebAssembly !== 'object') throw new Error('no WebAssembly');
      // 소수 색의 밝기에 쓰는 거듭제곱은 자바스크립트와 똑같은 값을 쓰려고 자바스크립트에게 맡겨요.
      const {instance} = await WebAssembly.instantiate(decode(ICON_PIXELS_WASM_BASE64), {env: {pow: (a, b) => a ** b}});
      const exports = instance.exports;
      const table = new Float64Array(exports.memory.buffer, exports.table_ptr(), 256);
      for (let v = 0; v < 256; v++) table[v] = darkChannel(v);
      engine = exports;
      state = 'wasm';
      return true;
    } catch {
      state = 'off';
      return false;
    } finally {
      publish();
    }
  })();
  return loading;
}

export const darkWasmState = () => state;
/** 준비된 엔진(exports) 또는 null. */
export const darkWasm = () => (state === 'wasm' ? engine : null);
/** 엔진이 한 번이라도 잘못되면 이 페이지에서는 예전 길만 써요. */
export function disableDarkWasm() {
  state = 'off';
  engine = null;
  publish();
}
