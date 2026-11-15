import test from "node:test";
import assert from "node:assert/strict";
import {startDownloadSpinner, summarizeDownloads} from "../toolbar-spinner.js";

test("summary counts running downloads and only reports a percent when every size is known", () => {
    assert.deepEqual(summarizeDownloads([], null), {active: false, count: 0, percent: null});
    assert.deepEqual(summarizeDownloads([{state: "in_progress", bytesReceived: 50, totalBytes: 200}, {state: "in_progress", bytesReceived: 150, totalBytes: 200}]), {active: true, count: 2, percent: 50});
    assert.equal(summarizeDownloads([{state: "in_progress", bytesReceived: 50, totalBytes: 0}]).percent, null);
    assert.equal(summarizeDownloads([{state: "in_progress", paused: true, bytesReceived: 1, totalBytes: 2}]).active, false, "paused downloads do not spin");
    assert.deepEqual(summarizeDownloads([], {type: "progress", percent: 30}), {active: true, count: 1, percent: null});
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
    const spinner = startDownloadSpinner(f.api, {setTimer: f.setTimer, clearTimer: f.clearTimer, loadFrames: async () => [{16: 1}, {16: 2}]});
    await flush(); await flush();
    assert.equal(spinner.isSpinning(), true);
    assert.ok(f.calls.some(([k, v]) => k === "icon" && v === "frame"), "spinner frame painted");
    assert.ok(f.calls.some(([k, v]) => k === "title" && /다운로드 중 1개 \(30%\)/.test(v)));
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
