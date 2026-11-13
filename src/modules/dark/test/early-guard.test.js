import assert from "node:assert/strict";
import test from "node:test";
import {Window} from "happy-dom";
import {EARLY_STYLE_ATTR, createEarlyDarkGuard, earlyDarkCss} from "../early-guard.js";

const frames = () => { const queue = []; return {schedule: (fn) => queue.push(fn), flush: () => { while (queue.length) queue.shift()(); }}; };

test("paints the dark background immediately and removes it two frames after release", () => {
    const window = new Window({url: "https://example.com/"});
    const f = frames();
    const guard = createEarlyDarkGuard(window.document, {schedule: f.schedule, settleMs: 0});
    guard.start();
    const style = window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`);
    assert.ok(style, "style exists synchronously");
    assert.match(style.textContent, /background-color:#181a1b !important/);
    assert.match(style.textContent, /color-scheme:dark/);
    guard.start();
    assert.equal(window.document.querySelectorAll(`style[${EARLY_STYLE_ATTR}]`).length, 1, "start is idempotent");
    guard.release();
    assert.ok(window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`), "still there right after release");
    f.flush();
    assert.equal(window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`), null);
    assert.equal(guard.active(), false);
    window.happyDOM.close();
});

test("immediate release and the failsafe both remove it", () => {
    const window = new Window({url: "https://example.com/"});
    const g1 = createEarlyDarkGuard(window.document);
    g1.start(); g1.release(true);
    assert.equal(window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`), null);

    let fire;
    const g2 = createEarlyDarkGuard(window.document, {setTimer: (fn) => { fire = fn; return 1; }, clearTimer() {}});
    g2.start();
    assert.ok(window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`));
    fire();
    assert.equal(window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`), null, "never leaves the page dark if the theme never arrives");
    window.happyDOM.close();
});

test("only plain hex colors are accepted and media, canvas and frames are left alone", () => {
    const window = new Window({url: "https://example.com/"});
    const guard = createEarlyDarkGuard(window.document, {background: "red;} body{display:none", text: "#ffffff"});
    guard.start();
    const css = window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`).textContent;
    assert.equal(css.includes("display:none"), false);
    assert.match(css, /#181a1b/);
    assert.match(css, /#ffffff/);
    for (const kept of ["iframe", "img", "video", "canvas", "svg", "picture"]) assert.ok(css.includes(`:not(${kept})`));
    assert.equal(earlyDarkCss().includes("background-image"), false);
    window.happyDOM.close();
});

test("waits for the document root when the script runs before it exists", async () => {
    const window = new Window({url: "https://example.com/"});
    const doc = window.document;
    const root = doc.documentElement;
    root.remove();
    const guard = createEarlyDarkGuard(doc, {});
    guard.start();
    assert.equal(guard.active(), false);
    doc.appendChild(root);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(guard.active(), true);
    guard.release(true);
    window.happyDOM.close();
});

test("keeps the dark backdrop for a settle period after load so the white page never shows through", () => {
    const window = new Window({url: "https://example.com/"});
    const f = frames();
    const timers = [];
    const guard = createEarlyDarkGuard(window.document, {schedule: f.schedule, setTimer: (fn, ms) => { timers.push({fn, ms}); return timers.length; }, clearTimer() {}, settleMs: 700});
    guard.start();
    guard.release();
    f.flush();
    assert.ok(window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`), "still there right after the two frames");
    if (window.document.readyState !== "complete") window.dispatchEvent(new window.Event("load"));
    const settle = timers.find((timer) => timer.ms === 700);
    assert.ok(settle, "a settle timer is waiting");
    settle.fn();
    assert.equal(window.document.querySelector(`style[${EARLY_STYLE_ATTR}]`), null);
    window.happyDOM.close();
});
