// 골든 테스트: zip 풀기의 Rust 길(native/core-wasm/src/zip.rs)이 예전 자바스크립트와 경로·바이트까지 똑같은지 봐요.
// 자바스크립트가 오류를 내는 zip 에서는 Rust 가 반드시 "예전 길로"라고 답해야 해요(그래야 오류도 똑같이 나요).
import {describe, expect, test} from "bun:test";
import {readdirSync, readFileSync} from "node:fs";
import {deflateRawSync} from "node:zlib";
import {coreExtractZip, prepareCoreWasm} from "@/modules/core-wasm.js";
import {extractAll, extractAllJs} from "@/core/update/zip";

type Spec = {name: string; data: Uint8Array; method: number};

const rng = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
};
const rand = rng(20261120);
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]!;
const enc = new TextEncoder();

const makeZip = (entries: Spec[]): Uint8Array => {
    const parts: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;
    for (const entry of entries) {
        const name = enc.encode(entry.name);
        const packed = entry.method === 8 ? new Uint8Array(deflateRawSync(entry.data)) : entry.data;
        const local = new Uint8Array(30);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(8, entry.method, true);
        lv.setUint32(18, packed.length, true);
        lv.setUint32(22, entry.data.length, true);
        lv.setUint16(26, name.length, true);
        const cen = new Uint8Array(46);
        const cv = new DataView(cen.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(10, entry.method, true);
        cv.setUint32(20, packed.length, true);
        cv.setUint32(24, entry.data.length, true);
        cv.setUint16(28, name.length, true);
        cv.setUint32(42, offset, true);
        parts.push(local, name, packed);
        central.push(cen, name);
        offset += 30 + name.length + packed.length;
    }
    const dirLen = central.reduce((n, p) => n + p.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, dirLen, true);
    ev.setUint32(16, offset, true);
    const all = [...parts, ...central, end];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of all) { out.set(p, at); at += p.length; }
    return out;
};

const names = ["manifest.json", "pkg/manifest.json", "pkg/a/b.js", "a/b.js", "lib/", "pkg/", "./c.js", "x//y.js", "a\\b.js",
    "../x", "a/../../x", "/abs", "C:/x", "c:x", "a\0b", "\uFEFFmanifest.json", "한글/파일.js", "pkg/icons/i.png", "😀.txt", ".", "./", ""];
const body = (): Uint8Array => {
    const n = pick([0, 1, 5, 40, 300, 3000, 20000]);
    const unit = pick(["console.log(1);\n", "가나다", "\x00\x01\x02", "{}", "abcdefghijklmnopqrstuvwxyz"]);
    const text = unit.repeat(Math.ceil(n / unit.length) + 1).slice(0, n);
    const bytes = enc.encode(text);
    if (rand() < 0.3) for (let i = 0; i < bytes.length; i += 7) bytes[i] = Math.floor(rand() * 256);
    return bytes;
};
const safeNames = ["a/b.js", "lib/", "./c.js", "x//y.js", "a\\b.js", "한글/파일.js", "icons/i.png", "😀.txt", "pkg/x.css"];
const randomZip = (): Uint8Array => {
    const count = 1 + Math.floor(rand() * 6);
    const healthy = rand() < 0.6;
    const entries: Spec[] = Array.from({length: count}, () => healthy
        ? {name: pick(safeNames), data: body(), method: pick([0, 8, 8])}
        : {name: pick(names), data: body(), method: pick([0, 8, 8, 8, 9])});
    if (healthy) {
        const root = pick(["", "", "pkg/", "BongExtend-1.2/"]);
        entries.splice(Math.floor(rand() * (entries.length + 1)), 0, {name: "manifest.json", data: enc.encode('{"name":"BongExtend"}'), method: pick([0, 8])});
        if (root) entries.forEach((e) => { e.name = root + e.name; });
    }
    let zip = makeZip(entries);
    const damage = healthy ? rand() * 3 : rand();
    if (damage < 0.15) zip = zip.slice(0, Math.floor(rand() * zip.length));
    else if (damage < 0.35) {
        zip = zip.slice();
        for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) zip[Math.floor(rand() * zip.length)] = Math.floor(rand() * 256);
    } else if (damage < 0.4) {
        const padded = new Uint8Array(zip.length + 50);
        padded.set(zip);
        zip = padded; // 뒤에 0 이 붙은 zip(주석 없음) — EOCD 를 못 찾을 수도 있어요
    }
    return zip;
};

const same = (a: {path: string[]; data: Uint8Array}[], b: {path: string[]; data: Uint8Array}[]) => {
    expect(a.map((f) => f.path)).toEqual(b.map((f) => f.path));
    a.forEach((f, i) => expect(Buffer.compare(Buffer.from(f.data), Buffer.from(b[i]!.data))).toBe(0));
};

describe("zip Rust 길", () => {
    test("엔진이 준비돼요", async () => {
        expect(await prepareCoreWasm()).toBe(true);
    });

    test("무작위 zip 에서 결과가 같고, 자바스크립트 오류는 자바스크립트에 남아요", async () => {
        await prepareCoreWasm();
        let compared = 0, thrown = 0, fallbacks = 0;
        const why: Record<string, number> = {};
        for (let n = 0; n < 1500; n++) {
            const zip = randomZip();
            let expected: Awaited<ReturnType<typeof extractAllJs>> | undefined, error: unknown = null;
            try { expected = await extractAllJs(zip); } catch (e) { error = e; }
            const reply = coreExtractZip(zip);
            expect(reply).toBeTruthy();
            if (error) {
                thrown++;
                if (!("fallback" in reply!)) throw new Error(`자바스크립트는 오류(${String(error)})인데 Rust 가 답했어요 (#${n})`);
                continue;
            }
            if ("fallback" in reply!) {
                fallbacks++;
                why[reply!.fallback] = (why[reply!.fallback] || 0) + 1;
                continue;
            }
            compared++;
            same(reply!.value, expected!);
        }
        console.log(`zip 비교 ${compared}, 자바스크립트 오류 ${thrown}, Rust 가 예전 길로 ${fallbacks}`, why);
        expect(compared).toBeGreaterThan(600);
        expect(thrown).toBeGreaterThan(300);
    }, 120000);

    test("실제 배포 zip 이 Rust 로 풀리고 바이트까지 같아요", async () => {
        const dir = `${import.meta.dir}/../../../.output`;
        let file: string | undefined;
        try { file = readdirSync(dir).find((f) => f.endsWith("-chrome.zip")); } catch { /* 아직 묶지 않았으면 건너뛰어요. */ }
        if (!file) return;
        const zip = new Uint8Array(readFileSync(`${dir}/${file}`));
        const reply = coreExtractZip(zip);
        expect(reply && "value" in reply).toBe(true);
        const expected = await extractAllJs(zip);
        same((reply as {value: {path: string[]; data: Uint8Array}[]}).value, expected);
        same(await extractAll(zip), expected);
        // 파일마다 자기 메모리를 가져요(예전 길과 같게).
        const files = (reply as {value: {data: Uint8Array}[]}).value;
        expect(files.every((f) => f.data.byteOffset === 0 && f.data.buffer.byteLength === f.data.length)).toBe(true);
    }, 60000);

    test("오류 메시지는 예전 그대로예요", async () => {
        const big = enc.encode("x".repeat(70000));
        await expect(extractAll(makeZip([{name: "manifest.json", data: big, method: 8}, {name: "../x.js", data: big, method: 0}]))).rejects.toThrow(/안전하지 않은/);
        await expect(extractAll(makeZip([{name: "a.js", data: big, method: 8}]))).rejects.toThrow(/manifest/);
    });
});
