import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {composite, contrastRatio} from "../contrast.js";
import {BAR_ALPHA, bodyPairs, DURATION_MS, EASE, MIN_BODY_CONTRAST, themes, tokenCssNames} from "../tokens.js";

const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
const popupHtml = readFileSync(new URL("../../../entrypoints/popup/index.html", import.meta.url), "utf8");

const readRoot = (block) => {
    const out = {};
    for (const match of block.matchAll(/(--be-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) out[match[1]] = match[2].toLowerCase();
    return out;
};

const roots = [...css.matchAll(/:root\s*\{([^}]+)\}/g)].map((match) => readRoot(match[1]));

test("dark and light body text clears WCAG AA, including a blurred bar over black or white", () => {
    assert.equal(roots.length >= 2, true);
    for (const [name, index] of [["dark", 0], ["light", 1]]) {
        const theme = themes[name];
        for (const [foreground, background] of bodyPairs) {
            const ratio = contrastRatio(theme[foreground], theme[background]);
            assert.ok(ratio >= MIN_BODY_CONTRAST, `${name} ${foreground} on ${background} is ${ratio.toFixed(2)}`);
        }
        for (const under of ["#000000", "#ffffff"]) {
            const bar = composite(theme.surface, under, BAR_ALPHA);
            assert.ok(contrastRatio(theme.text, bar) >= MIN_BODY_CONTRAST);
            assert.ok(contrastRatio(theme.muted, bar) >= MIN_BODY_CONTRAST);
        }
        for (const [key, variable] of Object.entries(tokenCssNames)) {
            assert.equal(roots[index][variable], theme[key], `${name} ${variable}`);
        }
    }
});

test("motion and the first paint use the same easing, duration, and theme colors", () => {
    assert.match(css, new RegExp(EASE.replace(/[()]/g, "\\$&")));
    assert.match(css, new RegExp(`${DURATION_MS}ms`));
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /backdrop-filter/);
    assert.match(popupHtml, new RegExp(themes.dark.bg, "i"));
    assert.match(popupHtml, new RegExp(themes.light.bg, "i"));
    assert.match(popupHtml, /prefers-color-scheme:\s*light/);
});
