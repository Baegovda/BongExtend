import test from "node:test";
import assert from "node:assert/strict";
import {BUBBLE_KEY, BUBBLE_PAGE, bubbleSize, bubbleText, createStartBubble} from "../start-bubble.js";
import {normalizeDownloadSettings} from "../settings.js";

const fake = ({contexts = [], focused = true, items = []} = {}) => {
    const calls = [], session = {};
    const api = {
        storage: {session: {set: async (value) => { Object.assign(session, value); }}},
        runtime: {getContexts: async () => contexts, sendMessage: async (message) => { calls.push(["message", message]); }},
        windows: {getLastFocused: async () => ({id: 7, focused, state: "normal"})},
        action: {
            setPopup: async ({popup}) => { calls.push(["setPopup", popup]); },
            openPopup: async ({windowId}) => { calls.push(["openPopup", windowId]); }
        },
        downloads: {search: async ({id}) => items.filter((item) => item.id === id)}
    };
    return {api, calls, session};
};
const on = async () => ({moduleOn: true, startBubble: true});

test("말풍선 글은 파일명(용량) 다운로드가 시작!", () => {
    assert.equal(bubbleText([{name: "a.zip", size: "1.1 MB"}]), "a.zip(1.1 MB) 다운로드가 시작!");
    assert.equal(bubbleText([{name: "a.zip", size: ""}]), "a.zip 다운로드가 시작!");
    assert.equal(bubbleText([{name: "a.zip", size: "1 B"}, {name: "b.rar", size: "2.9 GB"}]), "b.rar(2.9 GB) 외 1개 다운로드가 시작!");
    assert.equal(bubbleSize(-1), "");
    assert.equal(bubbleSize(2.88 * 1073741824), "2.88 GB");
});

test("이름이 있으면 아이콘 아래 말풍선을 열고 원래 화면으로 되돌려요", async () => {
    const {api, calls, session} = fake();
    const bubble = createStartBubble({api, readSettings: on, now: () => 1000});
    assert.equal(await bubble.onCreated({id: 1, filename: "C:/down/movie.mp4", totalBytes: 1048576 * 3, state: "in_progress"}), "opened");
    assert.deepEqual(calls, [["setPopup", BUBBLE_PAGE], ["openPopup", 7], ["setPopup", "popup.html"]]);
    assert.equal(session[BUBBLE_KEY].text, "movie.mp4(3.0 MB) 다운로드가 시작!");
});

test("이름이 아직 없으면 이름이 정해질 때 알려요", async () => {
    const {api, session} = fake({items: [{id: 2, filename: "", totalBytes: 50, state: "in_progress", startTime: new Date(900).toISOString()}]});
    const bubble = createStartBubble({api, readSettings: on, now: () => 1000, retryMs: []});
    assert.equal(await bubble.onCreated({id: 2, filename: "", state: "in_progress"}), "wait");
    assert.equal(await bubble.onChanged({id: 2, filename: {current: "D:/down/note.txt"}}), "opened");
    assert.equal(session[BUBBLE_KEY].text, "note.txt(50 B) 다운로드가 시작!");
    assert.equal(await bubble.onChanged({id: 2, filename: {current: "D:/down/note2.txt"}}), "skip");
});

test("설정을 끄거나 창이 포커스가 없으면 띄우지 않아요", async () => {
    const off = fake();
    assert.equal(await createStartBubble({api: off.api, readSettings: async () => ({moduleOn: true, startBubble: false})}).onCreated({id: 3, filename: "a", state: "in_progress"}), "off");
    assert.deepEqual(off.calls, []);
    const blur = fake({focused: false});
    assert.equal(await createStartBubble({api: blur.api, readSettings: on}).onCreated({id: 4, filename: "a", state: "in_progress"}), "no-window");
    assert.deepEqual(blur.calls, []);
});

test("BongExtend 창이 열려 있으면 그 안에 띄우고, 말풍선이 떠 있으면 글만 바꿔요", async () => {
    const open = fake({contexts: [{documentUrl: "chrome-extension://x/popup.html"}]});
    assert.equal(await createStartBubble({api: open.api, readSettings: on}).onCreated({id: 5, filename: "a.zip", state: "in_progress"}), "in-popup");
    assert.equal(open.calls[0][0], "message");
    const shown = fake({contexts: [{documentUrl: "chrome-extension://x/bubble.html"}]});
    assert.equal(await createStartBubble({api: shown.api, readSettings: on}).onCreated({id: 6, filename: "a.zip", state: "in_progress"}), "updated");
    assert.deepEqual(shown.calls, []);
});

test("시작 말풍선은 기본으로 켜져 있어요", () => {
    assert.equal(normalizeDownloadSettings({}).startBubble, true);
    assert.equal(normalizeDownloadSettings({startBubble: false}).startBubble, false);
});

test("이름 신호가 먼저 오거나 빠져도 알려요", async () => {
    const item = {id: 8, filename: "D:/down/late.bin", totalBytes: 2048, state: "in_progress", startTime: new Date(900).toISOString()};
    const early = fake({items: [item]});
    // 생김 신호보다 이름 신호가 먼저 와도 띄워요.
    assert.equal(await createStartBubble({api: early.api, readSettings: on, now: () => 1000, retryMs: []}).onChanged({id: 8, filename: {current: item.filename}}), "opened");
    assert.equal(early.session[BUBBLE_KEY].text, "late.bin(2.0 KB) 다운로드가 시작!");
    // 이름 신호가 아예 안 와도 잠깐 뒤 다시 봐서 띄워요.
    const missed = fake({items: [item]});
    createStartBubble({api: missed.api, readSettings: on, now: () => 1000, retryMs: [5]}).onCreated({id: 8, filename: "", state: "in_progress"});
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(missed.session[BUBBLE_KEY]?.text, "late.bin(2.0 KB) 다운로드가 시작!");
    // 오래전에 시작한 다운로드의 이름이 바뀐 것은 알리지 않아요.
    const old = fake({items: [{...item, startTime: new Date(0).toISOString()}]});
    assert.equal(await createStartBubble({api: old.api, readSettings: on, now: () => 60000, retryMs: []}).onChanged({id: 8, filename: {current: item.filename}}), "skip");
});
