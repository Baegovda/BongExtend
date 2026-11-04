import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

test("mail rows block text selection and clear a drag on pointerup, cancel, and blur", () => {
    const css = readFileSync(new URL("../../../entrypoints/popup/style.css", import.meta.url), "utf8");
    const main = readFileSync(new URL("../../../entrypoints/popup/main.ts", import.meta.url), "utf8");
    assert.match(css, /\.mail-head[\s\S]*user-select:\s*none/);
    assert.match(css, /\.mail-accounts\.reordering[\s\S]*user-select:\s*none/);
    assert.match(main, /bindMailDrag/);
    assert.match(main, /ev\.preventDefault\(\)/);
    assert.match(main, /setPointerCapture/);
    assert.match(main, /releasePointerCapture/);
    assert.match(main, /pointercancel/);
    assert.match(main, /window\.addEventListener\("blur"/);
    assert.match(main, /clearVisual/);
    assert.match(main, /style\.position = ""/);
    assert.match(main, /style\.transform = ""/);
});
