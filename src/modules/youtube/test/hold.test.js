import assert from "node:assert/strict";
import test from "node:test";
import {installHold, shouldHold} from "../hold.js";

test("every page open holds until the user does something, including a directly opened new tab", () => {
    assert.equal(shouldHold({}), true);
    assert.equal(shouldHold({hasUserActivation: false}), true);
    assert.equal(shouldHold({hasUserActivation: true}), false);
});

const fakeWin = (opts = {}) => {
    const listeners = {};
    const videos = opts.videos || [];
    const doc = {
        visibilityState: opts.hidden ? "hidden" : "visible",
        addEventListener: (n, f) => { (listeners[n] ||= []).push(f); },
        removeEventListener: (n, f) => { listeners[n] = (listeners[n] || []).filter((x) => x !== f); },
        querySelectorAll: () => videos
    };
    const win = {
        document: doc,
        performance: {getEntriesByType: () => [{type: opts.type || "navigate"}]},
        navigator: {userActivation: {hasBeenActive: false, isActive: false}},
        setInterval: () => 1,
        clearInterval() {}
    };
    return {win, emit: (n, e) => (listeners[n] || []).slice().forEach((f) => f(e))};
};
const video = () => ({tagName: "VIDEO", paused: false, pause() { this.paused = true; }});

test("a play without any user action is paused on a restored tab", () => {
    const v = video();
    const {win, emit} = fakeWin({type: "reload"});
    installHold(win);
    emit("play", {target: v});
    assert.equal(v.paused, true);
});

test("a click ends the hold so the user's own play works", () => {
    const v = video();
    const {win, emit} = fakeWin({type: "reload"});
    const hold = installHold(win);
    emit("pointerdown", {isTrusted: true});
    assert.equal(hold.isHolding(), false);
    emit("play", {target: v});
    assert.equal(v.paused, false);
});

test("an already playing video is stopped at install, and normal tabs are untouched", () => {
    const v = video();
    installHold(fakeWin({type: "back_forward", videos: [v]}).win);
    assert.equal(v.paused, true);
    const w = video();
    installHold(fakeWin({type: "navigate", videos: [w]}).win);
    assert.equal(w.paused, true, "a directly opened new tab is held too");
});

test("the hold expires after its window", () => {
    let t = 0;
    const v = video();
    const {win, emit} = fakeWin({type: "reload"});
    const hold = installHold(win, {now: () => t, windowMs: 1000});
    t = 5000;
    emit("play", {target: v});
    assert.equal(v.paused, false);
    assert.equal(hold.isHolding(), false);
});
