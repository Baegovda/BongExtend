// 골든 테스트: 설치 순서 정렬의 Rust 길(native/core-wasm/src/extra.rs order_keys)이 localeCompare 정렬과 똑같은지 봐요.
import {describe, expect, test} from "bun:test";
import {readdirSync, readFileSync} from "node:fs";
import {coreCallText, prepareCoreWasm} from "@/modules/core-wasm.js";
import {collectPriorityKeys, orderFiles, orderFilesJs} from "@/core/update/installPlan";
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
