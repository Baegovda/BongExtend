import test from "node:test";
import assert from "node:assert/strict";
import {LAST_NOTICE_KEY, NOTICE_SESSION_KEY, createCompleteNotifier, pickMissed, rememberNoticed} from "../complete-notice.js";
import {normalizeDownloadSettings} from "../settings.js";

const T0 = Date.parse("2026-11-20T05:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

const fakeApi = (items, {failNotify = false} = {}) => {
    const session = {}, local = {}, created = [];
    return {
        created, local, session,
        api: {
            storage: {
                session: {get: async (key) => ({[key]: session[key]}), set: async (value) => { Object.assign(session, value); }},
                local: {set: async (value) => { Object.assign(local, value); }}
            },
            downloads: {search: async (query) => query.id != null ? items.filter((item) => item.id === query.id) : items.filter((item) => item.state === query.state)},
            notifications: {create: async (id, options) => { if (failNotify) throw new Error("blocked"); created.push({id, ...options}); return id; }},
            runtime: {getURL: (path) => `chrome-extension://x${path}`}
        }
    };
};
const settingsOn = async () => ({moduleOn: true, notifications: true, completeSound: true});

test("completeSound is on by default and can be turned off", () => {
    assert.equal(normalizeDownloadSettings({}).completeSound, true);
    assert.equal(normalizeDownloadSettings({completeSound: false}).completeSound, false);
    assert.equal(normalizeDownloadSettings({replaceChromeUi: true}).notifications, true);
});

test("pickMissed keeps only recent, unannounced downloads finished after the record started", () => {
    const now = T0 + 60_000;
    const items = [
        {id: 1, state: "complete", endTime: iso(T0 - 1000)},        // finished before the record started
        {id: 2, state: "complete", endTime: iso(T0 + 10_000)},      // missed
        {id: 3, state: "complete", endTime: iso(T0 + 20_000)},      // already announced
        {id: 4, state: "in_progress", endTime: iso(T0 + 30_000)},
        {id: 5, state: "complete", endTime: ""}
    ];
    assert.deepEqual(pickMissed(items, {since: T0, ids: [3]}, now), [2]);
    assert.deepEqual(pickMissed(items, {since: T0 - 60 * 60_000, ids: []}, T0 + 10 * 60_000 + 15_000), [3], "older than 10 minutes is not announced late");
});

test("rememberNoticed keeps the start time and the last 100 ids", () => {
    let record = {since: T0, ids: []};
    for (let id = 1; id <= 120; id++) record = rememberNoticed(record, id, T0 + id);
    assert.equal(record.since, T0);
    assert.equal(record.ids.length, 100);
    assert.equal(record.ids[0], 21);
});

test("a complete event announces once, with a silent toast when our sound played", async () => {
    const items = [{id: 7, state: "complete", endTime: iso(T0 + 5000), filename: "C:\\Users\\me\\Downloads\\font.zip"}];
    const fake = fakeApi(items);
    let sounds = 0;
    const notifier = createCompleteNotifier({api: fake.api, readSettings: settingsOn, playSound: async () => { sounds++; return true; }, now: () => T0});
    assert.equal(await notifier.onComplete(7), true);
    assert.equal(await notifier.onComplete(7), false, "same download twice");
    assert.equal(await notifier.sweep(), 0, "sweep does not repeat it");
    assert.equal(fake.created.length, 1);
    assert.deepEqual({id: fake.created[0].id, title: fake.created[0].title, message: fake.created[0].message, silent: fake.created[0].silent}, {id: "bongextend-download-7", title: "다운로드 완료", message: "font.zip", silent: true});
    assert.equal(sounds, 1);
    assert.deepEqual(fake.local[LAST_NOTICE_KEY], {at: T0, id: 7, via: "event", ok: true, sound: true}, "diagnostic has no file name");
});

test("a missed complete event is found by the sweep when the worker wakes", async () => {
    const items = [];
    const fake = fakeApi(items);
    let clock = T0;
    const notifier = createCompleteNotifier({api: fake.api, readSettings: settingsOn, playSound: async () => false, now: () => clock});
    await notifier.ready;
    // The download finishes while the event is lost.
    clock = T0 + 30_000;
    items.push({id: 9, state: "complete", endTime: iso(T0 + 20_000), filename: "a/b.zip"});
    // A fresh worker (same browser session) reads the same session record.
    const again = createCompleteNotifier({api: fake.api, readSettings: settingsOn, playSound: async () => false, now: () => clock});
    assert.equal(await again.sweep("start"), 1);
    assert.equal(fake.created[0].message, "b.zip");
    assert.equal(fake.created[0].silent, false, "Windows plays its own sound when ours did not");
    assert.equal(fake.local[LAST_NOTICE_KEY].via, "start");
    assert.equal(fake.session[NOTICE_SESSION_KEY].since, T0);
    assert.equal(await notifier.onComplete(9), false, "the late event does not repeat it");
});

test("quiet shop photos, a module switched off and blocked notifications", async () => {
    const items = [{id: 1, state: "complete", endTime: iso(T0)}, {id: 2, state: "complete", endTime: iso(T0)}];
    const fake = fakeApi(items);
    const quiet = createCompleteNotifier({api: fake.api, readSettings: settingsOn, isQuiet: (id) => id === 1, now: () => T0});
    assert.equal(await quiet.onComplete(1), false);
    const off = createCompleteNotifier({api: fakeApi(items).api, readSettings: async () => ({moduleOn: false, notifications: true, completeSound: true}), now: () => T0});
    assert.equal(await off.onComplete(2), false);
    const soundOnly = fakeApi(items);
    let sounds = 0;
    const onlySound = createCompleteNotifier({api: soundOnly.api, readSettings: async () => ({moduleOn: true, notifications: false, completeSound: true}), playSound: async () => { sounds++; return true; }, now: () => T0});
    assert.equal(await onlySound.onComplete(2), true);
    assert.equal(sounds, 1);
    assert.equal(soundOnly.created.length, 0);
    const blocked = fakeApi(items, {failNotify: true});
    const failing = createCompleteNotifier({api: blocked.api, readSettings: settingsOn, playSound: async () => false, now: () => T0});
    assert.equal(await failing.onComplete(2), false);
    assert.deepEqual(blocked.local[LAST_NOTICE_KEY], {at: T0, id: 2, via: "event", ok: false, sound: false, error: "blocked"});
});
