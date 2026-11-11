import assert from "node:assert/strict";
import test from "node:test";
import {Window} from "happy-dom";
import {acceptsImage, attachImage, featureForHost, findImageInput, handlePaste, hasPlainText, imageFilesOf, nativeUploadStarted, normalizeImageSettings} from "../paste.js";

const png = (name = "shot.png") => ({name, type: "image/png", size: 1234});
const clip = ({files = [], text = ""} = {}) => ({files, items: [], getData: (type) => (type === "text/plain" ? text : "")});
const page = (html) => {
    const window = new Window({url: "https://lens.google.com/"});
    window.document.body.innerHTML = html;
    return window;
};

test("settings default to on and hosts map to features", () => {
    assert.deepEqual(normalizeImageSettings(undefined), {talk: true, lens: true});
    assert.deepEqual(normalizeImageSettings({talk: false}), {talk: false, lens: true});
    assert.equal(featureForHost("talk.naver.com"), "talk");
    assert.equal(featureForHost("partner.talk.naver.com"), "talk");
    assert.equal(featureForHost("lens.google.com"), "lens");
    assert.equal(featureForHost("www.google.com"), "lens");
    assert.equal(featureForHost("evil-talk.naver.com.example.com"), "");
});

test("only image files are taken, from files or items", () => {
    const text = {name: "a.txt", type: "text/plain"};
    assert.deepEqual(imageFilesOf(clip({files: [text, png()]})).map((f) => f.name), ["shot.png"]);
    const viaItems = {files: [], items: [{kind: "file", type: "image/png", getAsFile: () => png("item.png")}, {kind: "string", type: "text/plain"}]};
    assert.deepEqual(imageFilesOf(viaItems).map((f) => f.name), ["item.png"]);
    assert.deepEqual(imageFilesOf(null), []);
    assert.equal(hasPlainText(clip({text: " hi "})), true);
    assert.equal(hasPlainText(clip({text: "  "})), false);
});

test("file inputs: image-accepting, enabled, nearest scope first", () => {
    const win = page(`<input type="file" accept="application/pdf" id="pdf"><input type="file" disabled id="off"><form id="f"><input type="file" accept="image/*" id="mine"></form><input type="file" id="any">`);
    const doc = win.document;
    assert.equal(acceptsImage(doc.getElementById("pdf")), false);
    assert.equal(acceptsImage(doc.getElementById("any")), true);
    assert.equal(findImageInput(doc, doc.querySelector("#f"))?.id, "mine");
    assert.equal(findImageInput(doc, null)?.id, "mine");
    assert.equal(findImageInput(page("<p>no inputs</p>").document, null), null);
    win.happyDOM.close();
});

test("attachImage fills the upload input and notifies the page", () => {
    const win = page(`<input type="file" accept="image/png,image/jpeg" id="up">`);
    const input = win.document.getElementById("up");
    const events = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));
    const set = [];
    const method = attachImage(png(), {doc: win.document, setFiles: (el, file) => { set.push([el.id, file.name]); return true; }});
    assert.equal(method, "input");
    assert.deepEqual(set, [["up", "shot.png"]]);
    assert.deepEqual(events, ["input", "change"]);
    win.happyDOM.close();
});

test("without an upload input it drops the file on the paste target, and reports failure otherwise", () => {
    const win = page(`<div id="chat"><textarea id="box"></textarea></div>`);
    const target = win.document.getElementById("box");
    let dropped;
    assert.equal(attachImage(png(), {doc: win.document, target, drop: (zone) => { dropped = zone.id; return true; }}), "drop");
    assert.equal(dropped, "box");
    assert.equal(attachImage(png(), {doc: win.document, target, drop: () => false}), "");
    assert.equal(attachImage(png(), {doc: win.document, target, drop: () => { throw Error("x"); }}), "");
    win.happyDOM.close();
});

function pasteEvent(overrides = {}) {
    let prevented = overrides.defaultPrevented === true;
    return {clipboardData: clip({files: [png()]}), target: null, get defaultPrevented() { return prevented; }, preventDefault() { prevented = true; }, ...overrides};
}

test("handlePaste respects settings, text pastes, sites that already handled it, and duplicates", () => {
    const win = page(`<input type="file" accept="image/*">`);
    const doc = win.document;
    const settings = {talk: true, lens: true};
    const attached = [];
    const attach = (file) => { attached.push(file.name); return "input"; };
    const base = {settings, feature: "talk", doc, attach, now: () => 1000, last: {at: 0, name: ""}};

    const ok = pasteEvent();
    assert.equal(handlePaste(ok, base), true);
    assert.equal(ok.defaultPrevented, true);
    assert.deepEqual(attached, ["shot.png"]);

    assert.equal(handlePaste(pasteEvent(), {...base, last: {at: 0, name: ""}, settings: {talk: false, lens: true}}), false);
    assert.equal(handlePaste(pasteEvent({clipboardData: clip({files: [png()], text: "hello"})}), {...base, last: {at: 0, name: ""}}), false);
    assert.equal(handlePaste(pasteEvent({defaultPrevented: true}), {...base, last: {at: 0, name: ""}}), false);
    assert.equal(handlePaste(pasteEvent({clipboardData: clip({files: []})}), {...base, last: {at: 0, name: ""}}), false);
    assert.equal(handlePaste(pasteEvent(), {...base, feature: ""}), false);

    const shared = {at: 0, name: ""};
    assert.equal(handlePaste(pasteEvent(), {...base, last: shared}), true);
    assert.equal(handlePaste(pasteEvent(), {...base, last: shared}), true, "a duplicate event is swallowed");
    assert.equal(attached.length, 2, "but not attached twice");
    win.happyDOM.close();
});

test("lens waits and only takes over when the page did not upload by itself", () => {
    const win = page(`<input type="file" accept="image/*">`);
    const tasks = [];
    const attached = [];
    const shown = [];
    const common = {settings: {lens: true}, feature: "lens", doc: win.document, schedule: (task, ms) => tasks.push({task, ms}), clock: () => 5, now: () => 1000,
        attach: (file) => { attached.push(file.name); return "input"; }, onAttached: () => shown.push(1)};

    const native = pasteEvent();
    assert.equal(handlePaste(native, {...common, last: {at: 0, name: ""}, nativeUploaded: () => true}), false);
    assert.equal(native.defaultPrevented, false, "lens paste is never blocked");
    tasks.shift().task();
    assert.deepEqual(attached, [], "the page handled it, so we do nothing");

    const fallback = pasteEvent();
    assert.equal(handlePaste(fallback, {...common, last: {at: 0, name: ""}, nativeUploaded: (since) => { assert.equal(since, 5); return false; }}), false);
    assert.equal(tasks[0].ms > 0, true);
    tasks.shift().task();
    assert.deepEqual(attached, ["shot.png"]);
    assert.equal(shown.length, 1);

    const noSurface = page("<p>검색</p>");
    assert.equal(handlePaste(pasteEvent(), {...common, doc: noSurface.document, last: {at: 0, name: ""}, attach: () => assert.fail("no surface")}), false);
    assert.equal(tasks.length, 0);
    win.happyDOM.close(); noSurface.happyDOM.close();
});

test("a failed talk attach leaves the paste alone", () => {
    const talk = page("<textarea></textarea>");
    const failed = pasteEvent();
    assert.equal(handlePaste(failed, {settings: {talk: true}, feature: "talk", doc: talk.document, attach: () => ""}), false);
    assert.equal(failed.defaultPrevented, false);
    talk.happyDOM.close();
});

test("native upload detection reads resource timing entries after the paste", () => {
    const perf = {getEntriesByType: () => [{startTime: 1, name: "https://lens.google.com/v3/upload?x"}, {startTime: 9, name: "https://www.google.com/gen_204"}]};
    assert.equal(nativeUploadStarted(0, perf), true);
    assert.equal(nativeUploadStarted(2, perf), false);
    assert.equal(nativeUploadStarted(0, {getEntriesByType: () => { throw Error("x"); }}), false);
});

test("pasting an image into the Google search box opens Lens and uploads it", async () => {
    const win = page(`<textarea name="q" id="q"></textarea><div role="button" aria-label="이미지로 검색" id="cam"></div>`);
    const doc = win.document;
    const tasks = [];
    const attached = [];
    let opened = 0;
    const event = pasteEvent({target: doc.getElementById("q")});
    const handled = handlePaste(event, {settings: {lens: true}, feature: "lens", doc, last: {at: 0, name: ""}, now: () => 1000, schedule: (task, ms) => tasks.push({task, ms}),
        openLens: async () => { opened++; return true; }, attach: (file) => { attached.push(file.name); return "input"; }, onAttached: () => {}});
    assert.equal(handled, false);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].ms, 0, "no waiting: Google has no native image paste here");
    await tasks[0].task();
    assert.equal(opened, 1);
    assert.deepEqual(attached, ["shot.png"]);

    const plain = pasteEvent({target: doc.getElementById("cam")});
    assert.equal(handlePaste(plain, {settings: {lens: true}, feature: "lens", doc, schedule: () => assert.fail("not a search box")}), false);
    const noButton = page(`<textarea name="q" id="q2"></textarea>`);
    assert.equal(handlePaste(pasteEvent({target: noButton.document.getElementById("q2")}), {settings: {lens: true}, feature: "lens", doc: noButton.document, schedule: () => assert.fail("no lens button")}), false);
    win.happyDOM.close(); noButton.happyDOM.close();
});
