import test from "node:test";
import assert from "node:assert/strict";
import {createOtpPasteTracker} from "../otp-paste.js";
import {createMailOtpHandler} from "../otp.js";

test("only latest copy marks its original mail once; tokens are opaque", async () => {
    const calls = [];
    const tracker = createOtpPasteTracker();
    const first = tracker.arm({markAsRead() {calls.push("first");}}, "123456");
    const second = tracker.arm({markAsRead() {calls.push("second");}}, "123456");
    assert.notEqual(first, second);
    assert.match(second, /^[0-9a-f-]{36}$/);
    assert.deepEqual(tracker.current(), {token: second, code: "123456"});
    const snapshot = tracker.current(); snapshot.token = first;
    assert.equal(await tracker.consume(first), false);
    assert.equal(await tracker.consume(second), true);
    assert.equal(await tracker.consume(second), false);
    assert.deepEqual(calls, ["second"]);
    assert.equal(tracker.current(), null);
});

test("TTL expires at ten minutes and clear/invalidate revoke tokens", async () => {
    let now = 0;
    const tracker = createOtpPasteTracker({now: () => now});
    const mail = {markAsRead() {assert.fail("expired or revoked");}};
    const token = tracker.arm(mail, "123456");
    now = 599999; assert.ok(tracker.current());
    now++; assert.equal(await tracker.consume(token), false);
    assert.equal(tracker.current(), null);
    for (const method of ["clear", "invalidate"]) {
        const revoked = tracker.arm(mail, "123456"); tracker[method]();
        assert.equal(await tracker.consume(revoked), false);
    }
});

test("concurrent consumption calls API once; rejection permits retry", async () => {
    let reject, calls = 0;
    const tracker = createOtpPasteTracker();
    const token = tracker.arm({markAsRead() {calls++; return new Promise((_, fail) => {reject = fail;});}}, "123456");
    const first = tracker.consume(token);
    assert.equal(await tracker.consume(token), false);
    reject(new Error("offline"));
    await assert.rejects(first, /offline/);
    const retry = tracker.consume(token);
    assert.equal(calls, 2);
    reject(new Error("offline")); await assert.rejects(retry);
    assert.equal(tracker.current().token, token);
});

test("completion of old in-flight action preserves a newer copy", async () => {
    let finish;
    const tracker = createOtpPasteTracker();
    const old = tracker.arm({markAsRead() {return new Promise(resolve => {finish = resolve;});}}, "111111");
    const action = tracker.consume(old);
    const latest = tracker.arm({markAsRead() {}}, "222222");
    finish(); assert.equal(await action, true);
    assert.equal(tracker.current().token, latest);
    assert.equal(await tracker.consume(latest), true);
});

test("handler forwards original mail to copy while baseline and failed copy never arm", async () => {
    const tracker = createOtpPasteTracker();
    let seen = [], fail = true;
    const mail = {id: "otp", title: "인증번호 123456", issued: new Date(), getLastMessageText: async () => "", markAsRead() {}};
    const handler = createMailOtpHandler({load: async () => ({seen}), save: async value => {seen = value;}, notify: async () => {}, copy: async (code, original) => {
        assert.equal(original, mail);
        if (fail) throw new Error("clipboard");
        tracker.arm(original, code);
    }});
    await handler([mail]); assert.equal(tracker.current(), null);
    fail = false; await handler([mail]); assert.equal(tracker.current().code, "123456");
    tracker.clear(); seen = [];
    await handler([mail], {baseline: true}); await handler([mail]);
    assert.equal(tracker.current(), null);
});
