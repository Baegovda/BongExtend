// 골든 테스트: 설치 순서 정렬의 Rust 길(native/core-wasm/src/extra.rs order_keys)이 localeCompare 정렬과 똑같은지 봐요.
import {describe, expect, test} from "bun:test";
import {readdirSync, readFileSync} from "node:fs";
import {coreCallBytes, coreCallText, prepareCoreWasm} from "@/modules/core-wasm.js";
import {collectPriorityKeys, orderFiles, orderFilesJs, refCapturesJs, type RefKind} from "@/core/update/installPlan";
import {extractAllJs} from "@/core/update/zip";

const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rand = rng(20261120);
const printable = Array.from({length: 95}, (_, i) => String.fromCharCode(32 + i));
const order = (keys: string[]) => {
    const reply = coreCallText("update.order", [keys.map((k) => `0\t${k}`).join("\n"), String(keys.length)]);
    return reply && "value" in reply ? (reply.value as number[]).map((i) => keys[i]) : undefined;
};

describe("설치 순서 정렬 Rust 길", () => {
    test("엔진이 준비돼요", async () => {
        expect(await prepareCoreWasm()).toBe(true);
    });

    test("출력 가능한 ASCII 두 글자 조합 전부가 localeCompare 와 같은 순서예요", async () => {
        await prepareCoreWasm();
        const keys: string[] = [...printable];
        for (const a of printable) for (const b of printable) keys.push(a + b);
        expect(order(keys)).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    });

    test("무작위 경로도 같아요", async () => {
        await prepareCoreWasm();
        for (let round = 0; round < 20; round++) {
            const keys = Array.from({length: 300}, () => Array.from({length: 1 + Math.floor(rand() * 4)}, () =>
                Array.from({length: 1 + Math.floor(rand() * 8)}, () => printable[Math.floor(rand() * printable.length)]).join("")).join("/"));
            expect(order(keys)).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
        }
    });

    test("ASCII 가 아닌 이름은 예전 길로 가요", async () => {
        await prepareCoreWasm();
        expect(order(["a", "한글.js"])).toBeUndefined();
        expect(order(["a\tb"])).toBeUndefined();
    });

    test("참조 찾기: 무작위 글에서 Rust 가 자바스크립트 정규식과 같은 글자를 잡아요", async () => {
        await prepareCoreWasm();
        const bits: Record<RefKind, string[]> = {
            html: ["<script src=\"./a.js\">", "<link HREF = 'b.css'>", "xsrc=\"no\"", "src='", "\"", "'", "src=\"\"", " ", "\n", " ", "　", "href=\n\"c d\"", "é", "😀", "<img src=x>", "data-src=\"y\"", "_src=\"z\"", "src =\t'w'", "hrefs=\"q\""],
            js: ["import a from \"./a.js\";", "import \"./b.js\";", "export {x} from './c.js';", "import(\"./d.js\")", "import from 'e'", "import x from\n'./f.js'", "export * from \"./g.js\"", "import {a,\nb} from './h.js'", "reimport 'i'", "importfrom 'j'", "export {k} from './k.js'", " ", ";", "\n", "'", "\"", "from", " from ", "import", "export", "( ", "😀", "fromage 'm'"],
            css: ["url(a.png)", "url( \"b.png\" )", "URL('c.woff2')", "url(  \")", "url(\"x\"y)", "url()", "url(d e )", "url('f)", ")", "(", "\"", "'", " ", " ", "url(　g　)", "é"]
        };
        for (const kind of ["html", "js", "css"] as RefKind[]) {
            for (let n = 0; n < 3000; n++) {
                const text = Array.from({length: Math.floor(rand() * 14)}, () => bits[kind][Math.floor(rand() * bits[kind].length)]).join("");
                const reply = coreCallBytes("update.refs", kind, new TextEncoder().encode(text));
                expect(reply && "value" in reply).toBe(true);
                if (!(reply && "value" in reply)) continue;
                if (JSON.stringify(reply.value) !== JSON.stringify(refCapturesJs(kind, text))) throw new Error(`${kind} 다름: ${JSON.stringify(text)} → Rust ${JSON.stringify(reply.value)} / JS ${JSON.stringify(refCapturesJs(kind, text))}`);
            }
        }
        expect(coreCallBytes("update.refs", "js", new Uint8Array([0x69, 0xff, 0x22]))).toEqual({fallback: "not utf-8"});
    });

    test("참조 찾기: 실제 배포 zip 의 모든 html·css·js 파일이 같아요", async () => {
        await prepareCoreWasm();
        const dir = `${import.meta.dir}/../../../.output`;
        let file: string | undefined;
        try { file = readdirSync(dir).find((f) => f.endsWith("-chrome.zip")); } catch { /* 아직 묶지 않았으면 건너뛰어요. */ }
        if (!file) return;
        const files = await extractAllJs(new Uint8Array(readFileSync(`${dir}/${file}`)));
        let checked = 0;
        for (const f of files) {
            const key = f.path.join("/");
            const kind: RefKind | null = key.endsWith(".html") ? "html" : key.endsWith(".css") ? "css" : key.endsWith(".js") || key.endsWith(".mjs") ? "js" : null;
            if (!kind) continue;
            const reply = coreCallBytes("update.refs", kind, f.data);
            const text = new TextDecoder().decode(f.data);
            if (!reply || !("value" in reply)) continue;
            checked++;
            expect(reply.value).toEqual(refCapturesJs(kind, text));
        }
        expect(checked).toBeGreaterThan(100);
    });

    test("실제 배포 zip 의 설치 순서가 예전 길과 같아요", async () => {
        await prepareCoreWasm();
        const dir = `${import.meta.dir}/../../../.output`;
        let file: string | undefined;
        try { file = readdirSync(dir).find((f) => f.endsWith("-chrome.zip")); } catch { /* 아직 묶지 않았으면 건너뛰어요. */ }
        if (!file) return;
        const files = await extractAllJs(new Uint8Array(readFileSync(`${dir}/${file}`)));
        const priority = collectPriorityKeys(files);
        expect(orderFiles(files, priority).map((f) => f.path.join("/"))).toEqual(orderFilesJs(files, priority).map((f) => f.path.join("/")));
    });
});
