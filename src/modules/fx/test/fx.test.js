import assert from "node:assert/strict";
import test from "node:test";
import {convertAmount, formatMoney, isCacheFresh, parseRatePayload, currencyLabel} from "../convert.js";

test("converts through a KRW rate table, including crypto", () => {
    const rates = {krw: 1, usd: 0.0007, jpy: 0.11, btc: 0.00000001};
    assert.equal(convertAmount(10000, "krw", "usd", rates), 7);
    assert.equal(convertAmount(7, "usd", "krw", rates), 10000);
    assert.ok(Math.abs(convertAmount(1, "btc", "usd", rates) - 70000) < 0.001);
    assert.equal(convertAmount("nope", "krw", "usd", rates), null);
    assert.equal(convertAmount(1, "krw", "eur", rates), null);
});

test("parses the no-key payload and keeps a cached table for 12 hours", () => {
    const parsed = parseRatePayload({date: "2026-11-02", krw: {usd: 0.0007}});
    assert.equal(parsed.base, "krw");
    assert.equal(parsed.rates.krw, 1);
    assert.equal(parsed.rates.usd, 0.0007);
    assert.equal(parseRatePayload({date: "x"}), null);
    const now = 1_000_000;
    assert.equal(isCacheFresh(now - 60_000, now), true);
    assert.equal(isCacheFresh(now - 13 * 60 * 60 * 1000, now), false);
    assert.equal(isCacheFresh(0, now), false);
});

test("formats won without decimals and labels Korean names", () => {
    assert.equal(formatMoney(12345.6, "krw"), "12,346");
    assert.match(formatMoney(1.2, "usd"), /1\.2/);
    assert.equal(currencyLabel("krw"), "대한민국 원 (KRW)");
    assert.equal(currencyLabel("xyz"), "XYZ");
});
