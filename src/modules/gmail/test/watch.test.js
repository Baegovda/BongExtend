import assert from "node:assert/strict";
import test from "node:test";
import {
    GMAIL_IDLE_MS,
    GMAIL_INTERVAL_DEFAULT_MS,
    GMAIL_LOCKED_MS,
    clampIntervalMs,
    enabledAccounts,
    inboxSignature,
    nextWaitMs,
    notificationId,
    notificationTitle,
    skipDisabledFetch,
    unreadOf,
    watchPayload
} from "../watch.js";

test("interval stays between 5 and 60 seconds and defaults to 8", () => {
    assert.equal(clampIntervalMs(undefined), GMAIL_INTERVAL_DEFAULT_MS);
    assert.equal(clampIntervalMs(1000), 5000);
    assert.equal(clampIntervalMs(8000), 8000);
    assert.equal(clampIntervalMs(120000), 60000);
});

test("watcher stops when notifications or the module are off, and backs off otherwise", () => {
    assert.equal(nextWaitMs({notify: false, moduleOn: true, online: true, idle: "active", intervalMs: 8000}), 0);
    assert.equal(nextWaitMs({notify: true, moduleOn: false, online: true, idle: "active", intervalMs: 8000}), 0);
    assert.equal(nextWaitMs({notify: true, moduleOn: true, online: false, idle: "active", intervalMs: 8000}), 60000);
    assert.equal(nextWaitMs({notify: true, moduleOn: true, online: true, idle: "idle", intervalMs: 8000}), GMAIL_IDLE_MS);
    assert.equal(nextWaitMs({notify: true, moduleOn: true, online: true, idle: "locked", intervalMs: 8000}), GMAIL_LOCKED_MS);
    assert.equal(nextWaitMs({notify: true, moduleOn: true, online: true, idle: "active", intervalMs: 8000}), 8000);
});

test("disabled accounts stay listed but drop out of the badge and the notification name includes the account", () => {
    const accounts = [
        {index: 0, email: "a@gmail.com", unread: 2, messages: [{id: "1"}]},
        {index: 1, email: "b@gmail.com", unread: 5, messages: [{id: "2"}]}
    ];
    assert.equal(unreadOf(accounts, [1]), 2);
    assert.deepEqual(enabledAccounts(accounts, [1]).map((account) => account.email), ["a@gmail.com"]);
    assert.notEqual(inboxSignature(accounts), inboxSignature([{...accounts[0], unread: 3, messages: accounts[0].messages}]));
    assert.equal(notificationTitle({fromName: "Ada", subject: "Hi"}, accounts[1]), "Ada · b@gmail.com");
    assert.equal(notificationId({id: "same", account: 1}), "gmail-1-same");
    assert.equal(skipDisabledFetch(1, [1], "b@gmail.com"), true);
    assert.equal(skipDisabledFetch(1, [1], ""), false);
    assert.equal(skipDisabledFetch(0, [1], "a@gmail.com"), false);
    const kept = [{index: 1, email: "b@gmail.com", kept: true}, accounts[0]];
    assert.equal(inboxSignature(kept), inboxSignature(kept));
    assert.match(inboxSignature(kept), /1:kept/);
    const quiet = watchPayload(accounts, false);
    assert.equal(quiet[0].messages, undefined);
    assert.equal(quiet[0].unread, 2);
    assert.equal(watchPayload(kept, true)[0].kept, true);
});
