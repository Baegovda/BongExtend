import assert from "node:assert/strict";
import test from "node:test";
import {createFakeEffects} from "../effects.js";
import {gmailAct, gmailReadAccount, loadJson, openUrl} from "../popup-actions.js";
import {actionRequest, inboxThreads, markInboxRead, sendMailAction} from "../../modules/gmail/actions.js";

test("popup actions use the fake and do not call the real fetch or tabs", async () => {
    let realFetch = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { realFetch += 1; throw new Error("real fetch"); };
    const tabs = globalThis.chrome?.tabs;
    const originalCreate = tabs?.create;
    if (tabs) tabs.create = () => { throw new Error("real tabs"); };
    try {
        const {effects, calls} = createFakeEffects();
        await openUrl(effects, "https://mail.google.com/");
        await loadJson(effects, "https://example.test/rates");
        await gmailAct(effects, 0, "thread", "read");
        const readAll = await gmailReadAccount(effects, 1);
        assert.deepEqual(readAll.message, {type: "gmail-read-account", account: 1});
        assert.equal(realFetch, 0);
        assert.equal(calls.fetch, 1);
        assert.equal(calls.tabsCreate, 1);
        assert.equal(calls.sendMessage, 2);
    } finally {
        globalThis.fetch = originalFetch;
        if (tabs && originalCreate) tabs.create = originalCreate;
    }
});

test("a mail action posts through the injected fetch only", async () => {
    let realFetch = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { realFetch += 1; throw new Error("real fetch"); };
    try {
        const request = actionRequest(0, {at: "tok", ik: "ik1"}, "read", "thread");
        let seen = "";
        const ok = await sendMailAction(request, async (url) => {
            seen = url;
            return {ok: true, url};
        });
        assert.equal(ok, true);
        assert.match(seen, /mail\/u\/0/);
        assert.equal(realFetch, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("mark all read posts each thread through the injected fetch and leaves the list when it fails", async () => {
    let realFetch = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { realFetch += 1; throw new Error("real fetch"); };
    try {
        assert.deepEqual(inboxThreads({messages: [{thread: "a"}, {thread: "a"}, {thread: "b"}, {thread: ""}]}), ["a", "b"]);
        const calls = [];
        const done = await markInboxRead(2, ["a", "b"], {
            fetchImpl: async (url, init) => {
                calls.push({url, body: init.body});
                return {ok: true, url};
            },
            tokensFor: async () => ({at: "tok", ik: "ik1"})
        });
        assert.equal(done.ok, true);
        assert.equal(done.acted, 2);
        assert.match(calls[0].url, /mail\/u\/2/);
        assert.match(calls[1].body, /(^|&)act=rd(&|$)/);
        const previous = {accounts: [{index: 2, email: "ada@gmail.com", messages: [{thread: "a"}]}]};
        const missed = await markInboxRead(2, ["a"], {
            fetchImpl: async () => { throw new Error("should not post"); },
            tokensFor: async () => null
        });
        assert.equal(missed.ok, false);
        assert.equal(missed.acted, 0);
        const shown = missed.ok ? null : previous;
        assert.equal(shown.accounts[0].email, "ada@gmail.com");
        assert.equal(realFetch, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
