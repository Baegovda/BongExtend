import assert from "node:assert/strict";
import test from "node:test";
import {parseAtom, threadFromLink} from "../atom.js";
import {
    actionRequest,
    describeGmailLatency,
    parseGmailTokens,
    planMailNotifications
} from "../actions.js";

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://purl.org/atom/ns#">
<title>Gmail - Inbox for ada@example.com</title>
<fullcount>2</fullcount>
<entry>
  <title>Hello &amp; welcome</title>
  <summary>See &lt;b&gt;this&lt;/b&gt;</summary>
  <link rel="alternate" href="https://mail.google.com/mail/u/0/#inbox/18f3abc" />
  <modified>2026-11-02T00:00:00Z</modified>
  <issued>2026-11-02T00:00:00Z</issued>
  <id>tag:gmail.google.com,2004:1001</id>
  <author><name>Ada</name><email>ada@example.com</email></author>
</entry>
<entry>
  <title>Second</title>
  <summary>more</summary>
  <link rel="alternate" href="https://mail.google.com/mail/u/1/#all/18f3def" />
  <id>tag:gmail.google.com,2004:1002</id>
  <author><name>Bea</name><email>bea@example.com</email></author>
</entry>
</feed>`;

test("atom feed lists unread mail and the thread id", () => {
    const parsed = parseAtom(ATOM);
    assert.equal(parsed.unread, 2);
    assert.equal(parsed.email, "ada@example.com");
    assert.equal(parsed.messages[0].subject, "Hello & welcome");
    assert.equal(parsed.messages[0].snippet, "See this");
    assert.equal(parsed.messages[0].thread, "18f3abc");
    assert.equal(parsed.messages[1].thread, "18f3def");
    assert.equal(threadFromLink("", "tag:gmail.google.com,2004:55"), "55");
    assert.equal(parseAtom("<html>login</html>"), null);
});

test("the first check does not notify, later new mail does", () => {
    const first = planMailNotifications([], [{id: "a"}, {id: "b"}], false);
    assert.deepEqual(first.notify, []);
    assert.equal(first.baseline, true);
    const next = planMailNotifications(first.seen, [{id: "b"}, {id: "c", subject: "new"}], true);
    assert.deepEqual(next.notify.map((item) => item.id), ["c"]);
    const again = planMailNotifications(next.seen, [{id: "b"}, {id: "c"}], true);
    assert.deepEqual(again.notify, []);
    const shared = planMailNotifications(["0:same"], [
        {id: "same", account: 0, subject: "old"},
        {id: "same", account: 1, subject: "other inbox"}
    ], true);
    assert.deepEqual(shared.notify.map((item) => item.account), [1]);
    const legacy = planMailNotifications(["same"], [{id: "same", account: 0}], true);
    assert.deepEqual(legacy.notify, []);
});

test("action request uses the session token and does not need an OAuth client", () => {
    const tokens = parseGmailTokens(`var GM_ACTION_TOKEN = "tok en"; var GM_ID_KEY='ik1';`);
    assert.deepEqual(tokens, {at: "tok en", ik: "ik1"});
    assert.equal(parseGmailTokens(`GM_ACTION_TOKEN="null"; GM_ID_KEY="ik";`), null);
    const request = actionRequest(1, tokens, "archive", "18f3abc");
    assert.match(request.url, /\/mail\/u\/1\//);
    assert.match(request.body, /act=rc_\^i|act=rc_%5Ei/);
    assert.match(request.body, /at=tok\+en/);
    assert.match(request.body, /t=18f3abc/);
    assert.doesNotMatch(`${request.url} ${request.body}`, /oauth|googleapis\.com\/gmail/);
});

test("latency without a Gmail tab is the offscreen interval, not the alarm", () => {
    const latency = describeGmailLatency();
    assert.match(latency.withoutTab, /8초/);
    assert.match(latency.withoutTab, /알림을 끄면/);
});
