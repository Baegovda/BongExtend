import assert from "node:assert/strict";
import test from "node:test";
import {convertAmount, formatMoney, isCacheFresh, parseRatePayload, currencyLabel, CURRENCY_COLORS, CURRENCY_SYMBOLS, CURRENCY_TINT, currencyColor, currencyCode, currencySymbol, currencySymbolInk, fxTabBadge, orderCurrencyCards, FX_FORM_KEY, normalizeFxForm} from "../convert.js";
import {composite, contrastRatio} from "../../theme/contrast.js";

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

test("card order keeps a saved sequence and leaves unknown favorites alone", () => {
    assert.deepEqual(orderCurrencyCards(["krw", "usd", "jpy", "eur"], ["jpy", "krw", "nope"]), ["jpy", "krw", "usd", "eur"]);
    assert.deepEqual(orderCurrencyCards(["krw", "usd"], null), ["krw", "usd"]);
    assert.deepEqual(orderCurrencyCards(["krw", "usd"], ["usd", "usd", "krw"]), ["usd", "krw"]);
});

test("the amount and chosen currencies restore from fx.form only", () => {
    assert.equal(FX_FORM_KEY, "fx.form");
    assert.deepEqual(normalizeFxForm(undefined), {amount: "10000", from: "krw", to: "usd"});
    assert.deepEqual(
        normalizeFxForm({amount: "2500.5", from: "USD", to: "jpy", favorites: ["btc"]}, ["krw", "usd", "jpy"]),
        {amount: "2500.5", from: "usd", to: "jpy"}
    );
    assert.deepEqual(normalizeFxForm({amount: "-3", from: "nope", to: "usd"}, ["krw", "usd"]), {amount: "10000", from: "krw", to: "usd"});
    assert.deepEqual(normalizeFxForm({amount: "1", from: "eur", to: "eur"}, ["eur", "krw"]).to, "krw");
});

test("one dollar in won is the tab badge, and flag tints stay readable", () => {
    assert.equal(fxTabBadge({krw: 1, usd: 1 / 1382}), "1,382");
    assert.equal(fxTabBadge({krw: 1}), "");
    assert.equal(fxTabBadge(null), "");
    assert.equal(currencyColor("USD"), CURRENCY_COLORS.usd);
    for (const color of Object.values(CURRENCY_COLORS)) {
        const light = composite(color, "#ffffff", CURRENCY_TINT);
        const dark = composite(color, "#2c2c2e", CURRENCY_TINT);
        assert.ok(contrastRatio("#1c1c1e", light) >= 4.5, color);
        assert.ok(contrastRatio("#3a3a3c", light) >= 4.5, color);
        assert.ok(contrastRatio("#ffffff", dark) >= 4.5, color);
        assert.ok(contrastRatio("#e5e5ea", dark) >= 4.5, color);
    }
});

test("formats won without decimals and labels Korean names", () => {
    assert.equal(formatMoney(12345.6, "krw"), "12,346");
    assert.match(formatMoney(1.2, "usd"), /1\.2/);
    assert.equal(currencyLabel("krw"), "₩ 대한민국 원 (KRW)");
    assert.equal(currencyLabel("xyz"), "XYZ");
    assert.equal(currencySymbol("usd"), "$");
    assert.equal(currencySymbol("eur"), "€");
    assert.equal(currencySymbol("jpy"), "¥");
    assert.equal(currencySymbol("cny"), "元");
    assert.equal(currencySymbol("gbp"), "£");
    assert.equal(currencyCode("krw"), "KRW");
    assert.equal(currencySymbolInk("btc"), "#1c1c1e");
    assert.equal(currencySymbolInk("usd"), "#ffffff");
    for (const code of Object.keys(CURRENCY_SYMBOLS)) {
        assert.equal(CURRENCY_SYMBOLS[code].includes("http"), false);
        assert.equal(currencyCode(code), code.toUpperCase());
    }
});
