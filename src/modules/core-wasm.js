// BongExtend 규칙·분석 로직의 Rust 판(native/core-wasm → WebAssembly)으로 가는 다리.
// 처음 부를 때 조용히 준비를 시작하고, 준비 전이거나 Rust가 "예전 길로"라고 답하면 undefined 를 돌려줘요.
// 그러면 부르는 쪽이 예전 자바스크립트 규칙을 써요. 두 길의 결과가 같은지는 각 모듈의 test/*rust*.test.js 가 비교해요.
import {CORE_WASM_BASE64} from './core-wasm-bytes.js';

let engine = null;
let state = 'idle'; // idle | loading | wasm | off
let loading = null;

const decode = text => {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
};

/** 엔진을 준비해요(여러 번 불러도 한 번만). 실패하면 조용히 예전 길만 써요. */
export function prepareCoreWasm() {
    if (state === 'wasm' || state === 'off') return Promise.resolve(state === 'wasm');
    if (loading) return loading;
    state = 'loading';
    loading = (async () => {
        try {
            if (typeof WebAssembly !== 'object') throw new Error('no WebAssembly');
            const {instance} = await WebAssembly.instantiate(decode(CORE_WASM_BASE64), {});
            engine = instance.exports;
            state = 'wasm';
            return true;
        } catch {
            state = 'off';
            engine = null;
            return false;
        } finally {
            globalThis.__bongCoreEngine = state;
        }
    })();
    return loading;
}

export const coreWasmState = () => state;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Rust 함수 하나를 불러요. 답: {value} = Rust 결과, {fallback} = 예전 길로, undefined = 준비 안 됨·실패.
 * 시험용으로 그대로 내보내요. 기능 코드는 coreCall 을 써요.
 */
export function coreCallRaw(name, args) {
    if (state === 'idle') void prepareCoreWasm();
    if (state !== 'wasm' || !engine) return undefined;
    let json;
    try { json = JSON.stringify({f: name, a: args}); } catch { return undefined; }
    if (typeof json !== 'string') return undefined;
    const ex = engine;
    const bytes = encoder.encode(json);
    let ptr = 0, out = 0, outLen = 0;
    try {
        ptr = ex.alloc(bytes.length);
        new Uint8Array(ex.memory.buffer, ptr, bytes.length).set(bytes);
        out = ex.call(ptr, bytes.length);
        outLen = ex.reply_len();
        const reply = JSON.parse(decoder.decode(new Uint8Array(ex.memory.buffer, out, outLen)));
        if (reply && Object.prototype.hasOwnProperty.call(reply, 'v')) return {value: reply.v};
        return {fallback: String(reply?.x || '')};
    } catch {
        // 한 번이라도 잘못되면 이 화면에서는 예전 길만 써요.
        state = 'off';
        engine = null;
        globalThis.__bongCoreEngine = state;
        return undefined;
    } finally {
        if (engine) {
            try { if (ptr) ex.dealloc(ptr, bytes.length); if (out) ex.dealloc(out, outLen); } catch { /* 메모리 정리 실패는 결과에 영향이 없어요. */ }
        }
    }
}

// 짝 없는 이모지 반쪽(외톨이 서로게이트)이 섞인 글은 UTF-8로 그대로 옮길 수 없어서 예전 길로 보내요.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const wellFormed = (text) => (typeof text.isWellFormed === 'function' ? text.isWellFormed() : !LONE_SURROGATE.test(text));

/**
 * 긴 글을 받는 Rust 함수용: JSON 없이 글자를 Rust 메모리에 바로 써요. 답은 coreCallRaw 와 같아요.
 * 묶음: [u32 이름 길이][이름][u32 개수][(u32 길이, 글자)…] (리틀 엔디언, 바이트 수)
 */
export function coreCallText(name, texts) {
    if (state === 'idle') void prepareCoreWasm();
    if (state !== 'wasm' || !engine) return undefined;
    for (const text of texts) if (typeof text !== 'string' || !wellFormed(text)) return {fallback: 'not plain text'};
    const ex = engine;
    const nameBytes = encoder.encode(name);
    let size = 8 + nameBytes.length;
    for (const text of texts) size += 4 + text.length * 3;
    let ptr = 0, out = 0, outLen = 0;
    try {
        ptr = ex.alloc(size);
        const bytes = new Uint8Array(ex.memory.buffer, ptr, size);
        const view = new DataView(ex.memory.buffer, ptr, size);
        let at = 0;
        view.setUint32(at, nameBytes.length, true); at += 4;
        bytes.set(nameBytes, at); at += nameBytes.length;
        view.setUint32(at, texts.length, true); at += 4;
        for (const text of texts) {
            const {written} = encoder.encodeInto(text, bytes.subarray(at + 4));
            view.setUint32(at, written, true);
            at += 4 + written;
        }
        out = ex.call_text(ptr, at);
        outLen = ex.reply_len();
        const reply = JSON.parse(decoder.decode(new Uint8Array(ex.memory.buffer, out, outLen)));
        if (reply && Object.prototype.hasOwnProperty.call(reply, 'v')) return {value: reply.v};
        return {fallback: String(reply?.x || '')};
    } catch {
        state = 'off';
        engine = null;
        globalThis.__bongCoreEngine = state;
        return undefined;
    } finally {
        if (engine) {
            try { if (ptr) ex.dealloc(ptr, size); if (out) ex.dealloc(out, outLen); } catch { /* 메모리 정리 실패는 결과에 영향이 없어요. */ }
        }
    }
}

/** Rust 결과({value}) 또는 undefined(예전 자바스크립트 길을 쓰세요). */
export function coreCall(name, args) {
    const reply = coreCallRaw(name, args);
    return reply && 'value' in reply ? reply : undefined;
}
