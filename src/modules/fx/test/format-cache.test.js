// 숫자 표기기를 한 번만 만들어 쓰도록 바꾼 함수들(환율·쇼핑·치지직)이 예전 표기(매번 toLocaleString/Intl 새로 만들기)와 똑같은지 봐요.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {formatMoney} from "../convert.js";
import {formatPrice} from "../../shop/shop.js";

const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rand = rng(20261120);
const numbers = [0, -0, 0.5, 1.005, 2.5, 999.995, 1e21, -1234.5, 276589714642614.12, 5e-7, Number.MAX_SAFE_INTEGER];
for (let i = 0; i < 20000; i++) numbers.push((rand() - 0.2) * Math.pow(10, Math.floor(rand() * 22) - 6));

test("formatMoney is the same as a fresh Intl.NumberFormat each time", () => {
    for (const x of numbers) for (const code of ["krw", "usd", "btc", "jpy", "eur"]) {
        const digits = code === "btc" ? 8 : code === "krw" || code === "jpy" ? 0 : 2;
        assert.equal(formatMoney(x, code), new Intl.NumberFormat("ko-KR", {maximumFractionDigits: digits, minimumFractionDigits: 0}).format(x));
    }
});

test("formatPrice is the same as toLocaleString each time", () => {
    const sign = {KRW: "₩", CNY: "¥", USD: "$", EUR: "€", GBP: "£"};
    for (const x of numbers) for (const currency of ["KRW", "USD", "JPY", "CNY", "XYZ", ""]) {
        const digits = currency === "KRW" || currency === "JPY" ? 0 : 2;
        const number = x.toLocaleString("ko-KR", {minimumFractionDigits: digits, maximumFractionDigits: digits});
        const expected = sign[currency] ? `${sign[currency]}${number}` : `${number}${currency ? ` ${currency}` : ""}`;
        assert.equal(formatPrice(x, currency), expected);
    }
});

test("chzzk viewer counts are the same as toLocaleString each time", () => {
    const ctx = {};
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(readFileSync(new URL("../../chzzk/lib/extras.js", import.meta.url), "utf8"), ctx);
    for (const x of numbers.filter((n) => n >= 0)) {
        assert.equal(ctx.BongExtras.formatCount(x), Math.round(x).toLocaleString("ko-KR") + "명");
        assert.equal(ctx.BongExtras.formatViewers(x), "👁 " + Math.round(x).toLocaleString("ko-KR") + "명");
    }
});
