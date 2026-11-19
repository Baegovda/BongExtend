// core-wasm.js(Rust 공통 엔진 다리)의 타입. 타입스크립트 파일에서 부를 때 써요.
export type CoreReply<T = unknown> = {value: T} | {fallback: string} | undefined;
export function prepareCoreWasm(): Promise<boolean>;
export function coreWasmState(): "idle" | "loading" | "wasm" | "off";
export function coreCallRaw(name: string, args: unknown[]): CoreReply;
export function coreCallText(name: string, texts: string[]): CoreReply;
export function coreExtractZip(zipBytes: Uint8Array): CoreReply<{path: string[]; data: Uint8Array}[]>;
export function coreCall(name: string, args: unknown[]): {value: unknown} | undefined;
