import assert from "node:assert/strict";
import test from "node:test";
import {gmailComposeUrl, gmailInboxUrl, gmailMessageUrl, pickGmailTab, planGmailOpen} from "../open.js";
import {openGmailPlace} from "../../../platform/popup-actions.js";

test("inbox and compose urls keep the account index and authuser", () => {
    assert.equal(gmailInboxUrl(2, "Ada@gmail.com"), "https://mail.google.com/mail/u/2/?authuser=Ada%40gmail.com#inbox");
    assert.equal(gmailInboxUrl(-1, ""), "https://mail.google.com/mail/u/0/#inbox");
    assert.match(gmailComposeUrl(1, "ada@gmail.com"), /^https:\/\/mail\.google\.com\/mail\/u\/1\/\?/);
    assert.match(gmailComposeUrl(1, "ada@gmail.com"), /view=cm/);
    assert.match(gmailComposeUrl(1, "ada@gmail.com"), /authuser=ada%40gmail.com/);
    assert.equal(
        gmailMessageUrl(3, "ada@gmail.com", "https://mail.google.com/mail/u/0/#inbox/18f3abc", "18f3abc"),
        "https://mail.google.com/mail/u/3/?authuser=ada%40gmail.com#inbox/18f3abc"
    );
    assert.equal(gmailMessageUrl(1, "", "", "thread 1"), "https://mail.google.com/mail/u/1/#inbox/thread%201");
});

test("an open Gmail tab for that account is reused", () => {
    const tabs = [
        {id: 4, windowId: 9, url: "https://mail.google.com/mail/u/0/#inbox"},
        {id: 8, windowId: 9, url: "https://mail.google.com/mail/u/2/?authuser=ada%40gmail.com#inbox"}
    ];
    assert.equal(pickGmailTab(tabs, 2, "ada@gmail.com").id, 8);
    assert.equal(pickGmailTab(tabs, 5, "ada@gmail.com").id, 8);
    assert.equal(pickGmailTab([{id: 1, url: "https://example.com"}], 0, "ada@gmail.com"), null);
    const planned = planGmailOpen(tabs, 0, "", "https://mail.google.com/mail/u/0/#inbox");
    assert.equal(planned.action, "update");
    assert.equal(planned.tabId, 4);
    assert.equal(planGmailOpen([], 1, "", "https://mail.google.com/mail/u/1/#inbox").action, "create");
});

test("opening mail updates the existing account tab and does not call the network", async () => {
    let realFetch = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { realFetch += 1; throw new Error("real fetch"); };
    const updates = [];
    const created = [];
    const focused = [];
    try {
        const effects = {
            tabsQuery: async () => [{id: 8, windowId: 3, url: "https://mail.google.com/mail/u/1/#inbox"}],
            tabsUpdate: async (id, props) => { updates.push({id, props}); return {id}; },
            tabsCreate: async (props) => { created.push(props); return {id: 9}; },
            windowsUpdate: async (id, props) => { focused.push({id, props}); }
        };
        await openGmailPlace(effects, {index: 1, email: "ada@gmail.com"});
        assert.equal(created.length, 0);
        assert.equal(updates.length, 1);
        assert.equal(updates[0].id, 8);
        assert.match(updates[0].props.url, /\/mail\/u\/1\/\?authuser=ada%40gmail.com#inbox/);
        assert.equal(updates[0].props.active, true);
        assert.deepEqual(focused, [{id: 3, props: {focused: true}}]);
        assert.equal(realFetch, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
