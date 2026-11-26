import test from "node:test";
import assert from "node:assert/strict";
import {startDownloadSpinner, summarizeDownloads} from "../toolbar-spinner.js";

test("summary counts running downloads and only reports a percent when every size is known", () => {
    assert.deepEqual(summarizeDownloads([], null), {active: false, count: 0, percent: null, top: null});
    assert.deepEqual(summarizeDownloads([{state: "in_progress", bytesReceived: 50, totalBytes: 200}, {state: "in_progress", bytesReceived: 150, totalBytes: 200}]), {active: true, count: 2, percent: 50, top: 75});
    assert.equal(summarizeDownloads([{state: "in_progress", bytesReceived: 50, totalBytes: 0}]).percent, null);
    assert.equal(summarizeDownloads([{state: "in_progress", paused: true, bytesReceived: 1, totalBytes: 2}]).active, false, "paused downloads do not spin");
    assert.deepEqual(summarizeDownloads([], {type: "progress", percent: 30}), {active: true, count: 1, percent: null, top: 30});
});

function fakeChrome(state) {
    const calls = [], timers = [];
    const listeners = {created: [], changed: []};
    const api = {
        runtime: {getManifest: () => ({action: {default_icon: {16: "icons/16.png"}, default_title: "BongExtend"}}), getURL: (p) => p},
        action: {setIcon: async (v) => { calls.push(["icon", v.path ? "path" : "frame"]); }, setTitle: async (v) => { calls.push(["title", v.title]); }},
        downloads: {search: async () => state.items, onCreated: {addListener: (f) => listeners.created.push(f)}, onChanged: {addListener: (f) => listeners.changed.push(f)}, onErased: {addListener() {}}},
        storage: {local: {get: async () => ({})}, onChanged: {addListener() {}}}
    };
    const setTimer = (fn) => { timers.push(fn); return timers.length; };
    const clearTimer = () => {};
    return {api, calls, timers, setTimer, clearTimer, listeners};
}
const flush = () => new Promise((r) => setImmediate(r));

test("the toolbar icon spins while a file downloads and is restored when it finishes", async () => {
    const state = {items: [{state: "in_progress", bytesReceived: 30, totalBytes: 100}]};
    const f = fakeChrome(state);
    const drawn = [];
    const spinner = startDownloadSpinner(f.api, {setTimer: f.setTimer, clearTimer: f.clearTimer, loadFrames: async () => [{16: 1}, {16: 2}], drawPercent: async (value) => { drawn.push(value); return {16: value}; }});
    await flush(); await flush();
    assert.equal(spinner.isSpinning(), true);
    assert.ok(f.calls.some(([k, v]) => k === "icon" && v === "frame"), "progress frame painted");
    assert.deepEqual(drawn, [30], "the ring is filled to 30%");
    assert.ok(f.calls.some(([k, v]) => k === "title" && /다운로드 중 1개 · 가장 많이 받은 것 30%/.test(v)));
    state.items = [];
    await spinner.check();
    assert.equal(spinner.isSpinning(), false);
    assert.deepEqual(f.calls.at(-2), ["icon", "path"]);
    assert.deepEqual(f.calls.at(-1), ["title", "BongExtend"]);
});

test("nothing spins when no download is running", async () => {
    const f = fakeChrome({items: []});
    const spinner = startDownloadSpinner(f.api, {setTimer: f.setTimer, clearTimer: f.clearTimer, loadFrames: async () => [{}]});
    await flush();
    assert.equal(spinner.isSpinning(), false);
    assert.equal(f.calls.length, 0);
});

test("the ring follows the download that is furthest along, out of 100%", () => {
    const items = [
        {state: "in_progress", bytesReceived: 10, totalBytes: 100},
        {state: "in_progress", bytesReceived: 900, totalBytes: 1000},
        {state: "in_progress", bytesReceived: 5, totalBytes: 0}
    ];
    assert.equal(summarizeDownloads(items, null).top, 90);
    assert.equal(summarizeDownloads(items, null).percent, null, "the combined percent still needs every size");
    assert.equal(summarizeDownloads([{state: "in_progress", bytesReceived: 5, totalBytes: 0}], null).top, null, "unknown sizes keep the spinner");
    assert.equal(summarizeDownloads([{state: "in_progress", bytesReceived: 20, totalBytes: 100}], {type: "progress", percent: 64.7}).top, 64, "a video download counts too");
    assert.equal(summarizeDownloads([{state: "in_progress", bytesReceived: 300, totalBytes: 100}], null).top, 100);
});

test("the ring is redrawn only when the top percent changes, and the spinner is used when no size is known", async () => {
    const state = {items: [{state: "in_progress", bytesReceived: 5, totalBytes: 0}]};
    const f = fakeChrome(state);
    const drawn = [];
    let spun = 0;
    const spinner = startDownloadSpinner(f.api, {setTimer: f.setTimer, clearTimer: f.clearTimer, loadFrames: async () => { spun++; return [{16: 1}]; }, drawPercent: async (value) => { drawn.push(value); return {16: value}; }});
    await flush(); await flush();
    assert.equal(spun, 1, "unknown size spins");
    assert.deepEqual(drawn, []);
    state.items = [{state: "in_progress", bytesReceived: 40, totalBytes: 100}];
    await spinner.check();
    const paintNow = async () => { const fn = f.timers.shift(); await fn?.(); };
    // Run queued timers until the paint loop has drawn the new value.
    for (let i = 0; i < 6 && !drawn.includes(40); i++) await paintNow();
    assert.deepEqual(drawn, [40]);
    for (let i = 0; i < 4; i++) await paintNow();
    assert.deepEqual(drawn, [40], "same percent is not redrawn");
});
