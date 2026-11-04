// 트레이딩뷰 공개 로고를 빌드 때 받아 public/fx-icons 에 둔다.
// 확장 프로그램이 실행 중에 이 주소를 부르지 않는다. 이미 받은 파일이 있으면 실패해도 그 파일을 쓴다.

import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public", "fx-icons");

const sources = {
    krw: "country/KR",
    usd: "country/US",
    eur: "country/EU",
    jpy: "country/JP",
    cny: "country/CN",
    gbp: "country/GB",
    aud: "country/AU",
    cad: "country/CA",
    chf: "country/CH",
    hkd: "country/HK",
    sgd: "country/SG",
    twd: "country/TW",
    thb: "country/TH",
    vnd: "country/VN",
    inr: "country/IN",
    btc: "crypto/XTVCBTC",
    eth: "crypto/XTVCETH"
};

await mkdir(outDir, {recursive: true});
let failed = 0;
for (const [code, spec] of Object.entries(sources)) {
    const file = path.join(outDir, `${code}.svg`);
    const url = `https://s3-symbol-logo.tradingview.com/${spec}.svg`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        const text = await response.text();
        if (!text.includes("<svg")) throw new Error("svg 아님");
        await writeFile(file, text);
        console.log("fx icon", code);
    } catch (error) {
        let kept = false;
        try {
            const existing = await readFile(file, "utf8");
            kept = existing.includes("<svg");
        } catch { /* 없음 */ }
        if (kept) {
            console.warn("fx icon keep", code, error instanceof Error ? error.message : error);
            continue;
        }
        failed += 1;
        console.error("fx icon fail", code, error instanceof Error ? error.message : error);
    }
}
if (failed) process.exit(1);
