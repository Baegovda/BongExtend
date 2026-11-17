import assert from "node:assert/strict";
import test from "node:test";
import {classifyNativeDark, colorLightness, nativeDarkSites, settleNativeCheck, startsNativeDark, withNativeDark} from "../native-dark.js";

test("reads lightness from rgb and oklab/oklch computed colors", () => {
    assert.deepEqual(colorLightness("rgb(0, 0, 0)"), [0, 1]);
    assert.ok(Math.abs(colorLightness("rgb(255, 255, 255)")[0] - 1) < 1e-6);
    assert.ok(colorLightness("rgb(24, 26, 27)")[0] < 0.3);
    assert.deepEqual(colorLightness("rgba(255, 255, 255, 0.4)").slice(1), [0.4]);
    assert.deepEqual(colorLightness("oklab(0 0 0)"), [0, 1]);
    const white = colorLightness("oklab(0.999994 0.0000455678 0.0000200868 / 0.6)");
    assert.ok(white[0] > 0.99 && white[1] === 0.6);
    assert.ok(colorLightness("oklch(86.5% 0.17 95)")[0] > 0.86);
    assert.deepEqual(colorLightness("transparent"), [0, 0]);
    assert.equal(colorLightness("color(display-p3 1 0 0)"), null);
});

test("classifies an already dark page only with dark backgrounds and light text", () => {
    const dark = Array(20).fill(0.05), light = Array(20).fill(0.98);
    assert.equal(classifyNativeDark({backgrounds: dark.slice(0, 5), texts: []}), null, "too few samples");
    assert.equal(classifyNativeDark({backgrounds: dark, texts: Array(10).fill(0.95)}), true);
    assert.equal(classifyNativeDark({backgrounds: light, texts: Array(10).fill(0.1)}), false);
    assert.equal(classifyNativeDark({backgrounds: [...dark.slice(0, 10), ...light.slice(0, 10)], texts: []}), false, "half dark is not enough");
    assert.equal(classifyNativeDark({backgrounds: dark, texts: Array(10).fill(0.1)}), false, "dark text on dark: not a native dark theme");
});

test("remembers sites with a cap and an expiry", () => {
    const now = 1_000_000_000_000;
    let sites = withNativeDark(undefined, "studio.example", true, now);
    assert.deepEqual(sites, {"studio.example": now});
    assert.equal(startsNativeDark(sites, "studio.example", now), true);
    assert.deepEqual(withNativeDark(undefined, "light.example", false, now), {}, "plain light sites are not stored");
    assert.deepEqual(nativeDarkSites({"old.example": now - 31 * 864e5, "new.example": now, bad: "x"}, now), {"new.example": now});
    let many = {};
    for (let i = 0; i < 120; i++) many = withNativeDark(many, `s${i}.example`, true, now + i);
    assert.equal(Object.keys(many).length, 100);
    assert.ok(many["s119.example"] && !many["s0.example"], "keeps the most recent");
});

test("a site with both dark and light pages is only checked per page, never skipped up front", () => {
    const now = 1_000_000_000_000;
    // Taobao/Tmall: one shop page looked dark, the next product page is light.
    let sites = withNativeDark(undefined, "detail.tmall.com", true, now);
    sites = withNativeDark(sites, "detail.tmall.com", false, now + 1);
    assert.deepEqual(sites, {"detail.tmall.com": -(now + 1)});
    assert.equal(startsNativeDark(sites, "detail.tmall.com", now + 2), false);
    sites = withNativeDark(sites, "detail.tmall.com", true, now + 3);
    assert.equal(startsNativeDark(sites, "detail.tmall.com", now + 4), false, "stays mixed");
    assert.deepEqual(nativeDarkSites({"m.example": -(now - 31 * 864e5)}, now), {}, "mixed entries expire too");
});

test("trusts dark only twice in a row and light once loaded or on the last try", () => {
    let r = settleNativeCheck(true, 0, {complete: false, last: false});
    assert.deepEqual(r, {verdict: null, streak: 1}, "a single dark sample may be a loading screen");
    r = settleNativeCheck(true, r.streak, {complete: false, last: false});
    assert.equal(r.verdict, true);
    assert.deepEqual(settleNativeCheck(false, 1, {complete: false, last: false}), {verdict: null, streak: 0});
    assert.equal(settleNativeCheck(false, 0, {complete: true, last: false}).verdict, false);
    assert.equal(settleNativeCheck(false, 0, {complete: false, last: true}).verdict, false, "never-ending loads still get a light verdict");
    assert.equal(settleNativeCheck(null, 1, {complete: true, last: true}).verdict, null);
});
