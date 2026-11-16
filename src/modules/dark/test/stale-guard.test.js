import assert from "node:assert/strict";
import test from "node:test";
import {Window} from "happy-dom";
import {announceTakeover, createFallbackSweeper, listenForTakeover} from "../stale-guard.js";

const timers = () => {
    const queue = new Map(); let id = 0;
    return {
        setTimer: (fn) => { queue.set(++id, fn); return id; },
        clearTimer: (n) => queue.delete(n),
        size: () => queue.size,
        flush: () => { for (const [n, fn] of [...queue]) { queue.delete(n); fn(); } }
    };
};
const setVisibility = (window, state) => Object.defineProperty(window.document, "visibilityState", {configurable: true, get: () => state});

test("only an orphaned script retires when a newer one announces itself", () => {
    const window = new Window({url: "https://www.youtube.com/"});
    let orphaned = false, retired = 0;
    listenForTakeover(window.document, () => orphaned, () => retired++);
    announceTakeover(window.document);
    assert.equal(retired, 0, "a live script ignores the event (a page can send it too)");
    orphaned = true;
    announceTakeover(window.document);
    announceTakeover(window.document);
    assert.equal(retired, 1, "retires once");
});

test("sweeps a leftover fallback only while the tab is visible and dark", () => {
    const window = new Window({url: "https://www.youtube.com/"});
    const doc = window.document;
    doc.documentElement.setAttribute("data-darkreader-scheme", "dark");
    const stale = doc.createElement("style"); stale.className = "darkreader darkreader--fallback"; stale.textContent = "html, body, body :not(iframe) {background-color: #181a1b !important}";
    const other = doc.createElement("style"); other.className = "darkreader darkreader--user-agent"; other.textContent = "html {color-scheme: dark}";
    doc.head.append(stale, other);
    const t = timers(); let swept = -1;
    setVisibility(window, "hidden");
    const sweeper = createFallbackSweeper(doc, {isActive: () => true, onSweep: n => { swept = n; }, setTimer: t.setTimer, clearTimer: t.clearTimer});
    sweeper.start();
    assert.equal(t.size(), 0, "nothing is scheduled while hidden");
    setVisibility(window, "visible");
    doc.dispatchEvent(new window.Event("visibilitychange"));
    assert.equal(t.size(), 1);
    t.flush();
    assert.equal(stale.textContent, "", "fallback emptied");
    assert.equal(other.textContent, "html {color-scheme: dark}", "other theme styles stay");
    assert.equal(swept, 1);
    sweeper.stop();
    stale.textContent = "x";
    doc.dispatchEvent(new window.Event("visibilitychange"));
    assert.equal(t.size(), 0, "stopped sweeper schedules nothing");
});

test("does not sweep when the theme is off or the tab went hidden again", () => {
    const window = new Window({url: "https://www.youtube.com/"});
    const doc = window.document;
    const fallback = doc.createElement("style"); fallback.className = "darkreader--fallback"; fallback.textContent = "x";
    doc.head.append(fallback);
    const t = timers();
    setVisibility(window, "visible");
    let active = false;
    const sweeper = createFallbackSweeper(doc, {isActive: () => active, setTimer: t.setTimer, clearTimer: t.clearTimer});
    sweeper.start(); t.flush();
    assert.equal(fallback.textContent, "x", "inactive: left alone");
    active = true;
    sweeper.start(); t.flush();
    assert.equal(fallback.textContent, "x", "no dark scheme attribute: left alone");
    doc.documentElement.setAttribute("data-darkreader-scheme", "dark");
    sweeper.start();
    setVisibility(window, "hidden");
    doc.dispatchEvent(new window.Event("visibilitychange"));
    assert.equal(t.size(), 0, "hiding cancels the pending sweep");
    assert.equal(fallback.textContent, "x");
});
