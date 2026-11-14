import assert from "node:assert/strict";
import test from "node:test";
import {liveUrl, newlyLive, startChzzkWatch} from "../watch-background.js";

const A = "a".repeat(32), B = "b".repeat(32);

test("only an off→on change counts, and a first observation never does", () => {
    assert.deepEqual(newlyLive({[A]: "CLOSE"}, {[A]: "OPEN"}), [A]);
    assert.deepEqual(newlyLive({[A]: "OPEN"}, {[A]: "OPEN"}), []);
    assert.deepEqual(newlyLive({}, {[A]: "OPEN"}), []);
    assert.deepEqual(newlyLive({[A]: "CLOSE", [B]: "CLOSE"}, {[A]: "CLOSE", [B]: "OPEN"}), [B]);
});

const fakeChrome = ({sync, status, tabs = []}) => {
    const local = {watchStatus: {[A]: "CLOSE"}};
    const created = [], updated = [];
    let alarmHandler;
    const chromeApi = {
        storage: {
            sync: {get: async (d) => ({...d, ...sync})},
            local: {get: async (d) => (typeof d === "string" ? {} : {...d, ...local}), set: async (o) => Object.assign(local, o)},
            onChanged: {addListener() {}}
        },
        alarms: {create() {}, onAlarm: {addListener: (f) => { alarmHandler = f; }}},
        runtime: {id: "x", onStartup: {addListener() {}}, onMessage: {addListener() {}}},
        tabs: {query: async () => tabs, create: async (o) => created.push(o), update: async (id, o) => updated.push([id, o])},
        windows: {update: async () => {}}
    };
    globalThis.fetch = async () => ({ok: true, json: async () => ({content: {status}})});
    return {chromeApi, created, updated, fire: () => alarmHandler({name: "bongextend-chzzk-watch"}), local};
};
const settle = () => new Promise((r) => setTimeout(r, 20));

test("a watched streamer going live opens a new tab even with no chzzk tab open", async () => {
    const f = fakeChrome({sync: {watchEnabled: true, watchList: [{id: A, name: "a"}]}, status: "OPEN"});
    startChzzkWatch(f.chromeApi);
    f.fire(); await settle();
    assert.deepEqual(f.created, [{url: liveUrl(A), active: true}]);
    assert.equal(f.local.watchStatus[A], "OPEN");
});

test("an already open live tab is focused instead of opening a duplicate", async () => {
    const f = fakeChrome({sync: {watchEnabled: true, watchList: [{id: A}]}, status: "OPEN", tabs: [{id: 7, windowId: 1}]});
    startChzzkWatch(f.chromeApi);
    f.fire(); await settle();
    assert.equal(f.created.length, 0);
    assert.deepEqual(f.updated, [[7, {active: true}]]);
});

test("nothing happens when the feature is off", async () => {
    const f = fakeChrome({sync: {watchEnabled: false, watchList: [{id: A}]}, status: "OPEN"});
    startChzzkWatch(f.chromeApi);
    f.fire(); await settle();
    assert.equal(f.created.length, 0);
});
