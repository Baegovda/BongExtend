import test from "node:test";
import assert from "node:assert/strict";
import {isBackdropBox, isLightBackdrop, measurePixels, overlayAlpha, overlayValue, relativeLuminance, singleImageUrl} from "../backdrop-dim.js";

const pixels = (rgba, count = 16) => Uint8ClampedArray.from({length: count * 4}, (_, i) => rgba[i % 4]);

test("measurePixels gives mean luminance and alpha", () => {
    const light = measurePixels(pixels([230, 232, 235, 255]));
    assert.ok(light.lum > 0.75 && light.alpha === 1, JSON.stringify(light));
    const dark = measurePixels(pixels([20, 22, 25, 255]));
    assert.ok(dark.lum < 0.02);
    const clear = measurePixels(pixels([0, 0, 0, 0]));
    assert.equal(clear.alpha, 0);
    assert.equal(measurePixels([]), null);
});

test("only opaque light pictures are dimmed", () => {
    assert.equal(isLightBackdrop({lum: 0.72, alpha: 1}), true);
    assert.equal(isLightBackdrop({lum: 0.2, alpha: 1}), false, "dark photo keeps its colours");
    assert.equal(isLightBackdrop({lum: 0.9, alpha: 0.5}), false, "transparent artwork keeps its colours");
    assert.equal(isLightBackdrop(null), false, "unknown pixels are left alone");
});

test("single url layer only", () => {
    assert.equal(singleImageUrl('url("https://a.example/bg.png")'), "https://a.example/bg.png");
    assert.equal(singleImageUrl("url(bg.jpg)"), "bg.jpg");
    assert.equal(singleImageUrl("none"), null);
    assert.equal(singleImageUrl("linear-gradient(red, blue)"), null);
    assert.equal(singleImageUrl('url("a.png"), url("b.png")'), null);
    assert.equal(singleImageUrl('url("data:image/svg+xml,<svg/>")'), null);
});

test("backdrop boxes cover half the viewport and hold content", () => {
    const viewportArea = 1000 * 800;
    assert.equal(isBackdropBox({tag: "SECTION", area: viewportArea * 0.9, viewportArea, childElements: 2, root: false}), true);
    assert.equal(isBackdropBox({tag: "DIV", area: viewportArea * 0.3, viewportArea, childElements: 2, root: false}), false, "banner");
    assert.equal(isBackdropBox({tag: "DIV", area: viewportArea, viewportArea, childElements: 0, root: false}), false, "a picture box, not a backdrop");
    assert.equal(isBackdropBox({tag: "IMG", area: viewportArea, viewportArea, childElements: 0, root: false}), false);
    assert.equal(isBackdropBox({tag: "BODY", area: viewportArea, viewportArea, childElements: 0, root: true}), true);
});

test("overlay keeps a faint picture over the page's dark base", () => {
    const base = relativeLuminance(24, 26, 27);
    const alpha = overlayAlpha(0.75, base);
    assert.ok(alpha >= 0.7 && alpha <= 0.92, String(alpha));
    assert.ok(alpha * base + (1 - alpha) * 0.75 < 0.08, "result is dark");
    assert.equal(overlayAlpha(0.01, base), 0);
    assert.equal(overlayValue('https://a.example/b"g.png', [24, 26, 27], 0.9), 'linear-gradient(rgba(24, 26, 27, 0.9), rgba(24, 26, 27, 0.9)), url("https://a.example/b\\"g.png")');
});
