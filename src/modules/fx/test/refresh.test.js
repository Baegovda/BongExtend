import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {FX_ICON_CODES, FX_POPUP_REFRESH_MS, FX_BADGE_REFRESH_MS, currencyCode, currencyIconPath, shouldRefreshRates} from "../convert.js";
import {refreshStoredRates} from "../refresh.js";

test("rates are due on the short interval and the icon path stays inside the extension", () => {
    const now = 1_000_000;
    assert.equal(shouldRefreshRates(now - 1_000, now, FX_POPUP_REFRESH_MS), false);
    assert.equal(shouldRefreshRates(now - FX_POPUP_REFRESH_MS, now, FX_POPUP_REFRESH_MS), true);
    assert.equal(shouldRefreshRates(0, now, FX_BADGE_REFRESH_MS), true);
    assert.equal(currencyIconPath("usd"), "/fx-icons/usd.svg");
    assert.equal(currencyIconPath("nope"), "");
    assert.equal(currencyCode("cny"), "CNY");
    assert.equal(currencyIconPath("eur").includes("http"), false);
    for (const code of FX_ICON_CODES) {
        const file = new URL(`../../../../public/fx-icons/${code}.svg`, import.meta.url);
        const text = readFileSync(file, "utf8");
        assert.equal(text.includes("<svg"), true);
        assert.equal(/<(?:image|script|use)\b[^>]*(?:href|src)\s*=\s*["']https?:/i.test(text), false);
    }
});

test("a failed fetch keeps the saved table and a fresh table does not fetch", async () => {
    let calls = 0;
    const saved = {base: "krw", date: "2026-11-01", rates: {krw: 1, usd: 0.0007}, fetchedAt: 500};
    const storage = {
        current: saved,
        async get() { return {"fx.table": this.current}; },
        async set(items) { this.current = items["fx.table"]; }
    };
    const missed = await refreshStoredRates({
        storage,
        now: 1_000,
        interval: 100,
        fetchImpl: async () => { calls += 1; throw new Error("offline"); }
    });
    assert.equal(missed.ok, false);
    assert.equal(missed.table.date, "2026-11-01");
    assert.equal(storage.current.date, "2026-11-01");
    assert.equal(calls, 1);

    const fresh = await refreshStoredRates({
        storage,
        now: 1_000,
        interval: 10_000,
        fetchImpl: async () => { calls += 1; throw new Error("should not fetch"); }
    });
    assert.equal(fresh.cached, true);
    assert.equal(calls, 1);

    const next = await refreshStoredRates({
        storage,
        now: 50_000,
        interval: 100,
        fetchImpl: async () => {
            calls += 1;
            return {ok: true, json: async () => ({date: "2026-11-04", krw: {usd: 0.0008}})};
        }
    });
    assert.equal(next.ok, true);
    assert.equal(next.table.rates.usd, 0.0008);
    assert.equal(next.table.fetchedAt, 50_000);
    assert.equal(storage.current.rates.usd, 0.0008);
});
