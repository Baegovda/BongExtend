import assert from "node:assert/strict";
import test from "node:test";
import {createFakeEffects} from "../effects.js";
import {gmailAct, loadJson, openUrl} from "../popup-actions.js";
import {sendMailAction, actionRequest} from "../../modules/gmail/actions.js";

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
        assert.equal(realFetch, 0);
        assert.equal(calls.fetch, 1);
        assert.equal(calls.tabsCreate, 1);
        assert.equal(calls.sendMessage, 1);
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
