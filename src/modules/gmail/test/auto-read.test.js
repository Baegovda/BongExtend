import assert from "node:assert/strict";
import test from "node:test";
import {createMailAutoRead, isAliExpressMail, isAliExpressSender, mailKey} from "../auto-read.js";

const mail = (id, authorMail, extra = {}) => {
    const item = {id, account: {id: 7}, authorMail, reads: 0, ...extra};
    item.markAsRead = extra.markAsRead || (async () => { item.reads += 1; });
    return item;
};
const quick = (options = {}) => createMailAutoRead({retryDelayMs: 0, sleep: async () => {}, ...options});

test("matches only real AliExpress sender domains", () => {
    assert.equal(isAliExpressSender("transaction@notice.aliexpress.com"), true);
    assert.equal(isAliExpressSender("AliExpress <aliexpress@mail.aliexpress.com>"), true);
    assert.equal(isAliExpressSender("service@aliexpress.com"), true);
    assert.equal(isAliExpressSender("fake@evilaliexpress.com"), false);
    assert.equal(isAliExpressSender("fake@aliexpress.com.evil.net"), false);
    assert.equal(isAliExpressSender("AliExpress <phish@example.com>"), false);
    assert.equal(isAliExpressSender("alibaba@alibaba.com"), false);
    assert.equal(isAliExpressSender(""), false);
    assert.equal(isAliExpressSender(undefined), false);
});

test("marks AliExpress mail read only after its notification was really shown", async () => {
    const auto = quick();
    const ali = mail("a1", "order@notice.aliexpress.com");
    const other = mail("o1", "friend@example.com");

    assert.deepEqual(await auto.process([ali, other]), []);
    assert.equal(ali.reads, 0, "no notification shown, so it must stay unread");

    auto.noteShown([ali, other]);
    assert.deepEqual(await auto.process([ali, other]), ["7:a1"]);
    assert.equal(ali.reads, 1);
    assert.equal(other.reads, 0, "other senders are never touched");
});

test("waits for the notification to finish before marking read", async () => {
    const auto = quick();
    const ali = mail("a2", "n@mail.aliexpress.com");
    const order = [];
    ali.markAsRead = async () => { order.push("read"); };
    let finish;
    const settled = new Promise((resolve) => { finish = resolve; });
    auto.noteShown([ali]);
    const running = auto.process([ali], {settled});
    await Promise.resolve();
    assert.deepEqual(order, []);
    order.push("notified");
    finish();
    await running;
    assert.deepEqual(order, ["notified", "read"]);
});

test("a failed notification promise does not break processing and unshown mail stays unread", async () => {
    const auto = quick();
    const ali = mail("a3", "n@mail.aliexpress.com");
    const result = await auto.process([ali], {settled: Promise.reject(new Error("no toast"))});
    assert.deepEqual(result, []);
    assert.equal(ali.reads, 0);
});

test("skips verification-code mail and handles each mail only once", async () => {
    const auto = quick();
    const code = mail("c1", "n@notice.aliexpress.com");
    const normal = mail("n1", "n@notice.aliexpress.com");
    auto.noteShown([code, normal]);
    assert.deepEqual(await auto.process([code, normal], {skip: [mailKey(code)]}), ["7:n1"]);
    assert.equal(code.reads, 0);
    assert.deepEqual(await auto.process([code, normal], {skip: [mailKey(code)]}), []);
    assert.equal(normal.reads, 1, "second pass must not read it again");
});

test("retries one failure, then gives up without throwing", async () => {
    const auto = quick();
    let calls = 0;
    const flaky = mail("f1", "n@notice.aliexpress.com", {markAsRead: async () => { calls += 1; if (calls === 1) throw new Error("token"); }});
    auto.noteShown([flaky]);
    assert.deepEqual(await auto.process([flaky]), ["7:f1"]);
    assert.equal(calls, 2);

    const broken = mail("b1", "n@notice.aliexpress.com", {markAsRead: async () => { calls += 1; throw new Error("down"); }});
    auto.noteShown([broken]);
    assert.deepEqual(await auto.process([broken]), []);
    assert.equal(calls, 4);
});

test("does nothing when disabled", async () => {
    const auto = quick({isEnabled: async () => false});
    const ali = mail("d1", "n@notice.aliexpress.com");
    auto.noteShown([ali]);
    assert.deepEqual(await auto.process([ali]), []);
    assert.equal(ali.reads, 0);
});

test("ignores mails without an id or markAsRead and never stores mail content", async () => {
    const auto = quick();
    const noId = {account: {id: 1}, authorMail: "n@notice.aliexpress.com", markAsRead: async () => { throw new Error("must not run"); }};
    const noMethod = {id: "m", account: {id: 1}, authorMail: "n@notice.aliexpress.com"};
    auto.noteShown([noId, noMethod]);
    assert.deepEqual(await auto.process([noId, noMethod]), []);
    assert.equal(mailKey(noId), "");
});

test("records a reason per mail with the sender domain only", async () => {
    const entries = [];
    const auto = quick({log: (entry) => entries.push(entry)});
    const ali = mail("l1", "AliExpress <n@notice.aliexpress.com>");
    const unshown = mail("l2", "n@mail.aliexpress.com");
    const other = mail("l3", "friend@example.com");
    auto.noteShown([ali]);
    await auto.process([ali, unshown, other]);
    assert.deepEqual(entries, [
        {domain: "notice.aliexpress.com", reason: "read"},
        {domain: "mail.aliexpress.com", reason: "no-notification"},
        {domain: "example.com", reason: "not-ali"}
    ]);
    assert.equal(JSON.stringify(entries).includes("friend@"), false);
});

test("recognizes AliExpress mail forwarded through Firefox Relay, and nothing else", () => {
    const relay = (name, address = "bfqbknest@mozmail.com") => ({authorName: name, authorMail: address});
    assert.equal(isAliExpressMail(relay("transaction@notice.aliexpress.com [via Relay]")), true);
    assert.equal(isAliExpressMail(relay("promotion@aliexpress.com [via Relay]", "lj1avauew@mozmail.com")), true);
    assert.equal(isAliExpressMail(relay("promotion@aliexpress.com [via Relay]", "x@relay.firefox.com")), true);
    assert.equal(isAliExpressMail(relay("shop@example.com [via Relay]")), false);
    assert.equal(isAliExpressMail(relay("promotion@aliexpress.com [via Relay]", "attacker@example.com")), false, "name alone is not trusted outside Relay");
    assert.equal(isAliExpressMail(relay("AliExpress", "x@mozmail.com")), true, "a Relay display name that says AliExpress counts");
    assert.equal(isAliExpressMail(relay("Ali Express Korea [via Relay]", "x@mozmail.com")), true);
    assert.equal(isAliExpressMail(relay("Some Shop [via Relay]", "x@mozmail.com")), false);
    assert.equal(isAliExpressMail(relay("transaction@notice..", "4x7sdgy35@mozmail.com")), true, "Gmail truncates the display name");
    assert.equal(isAliExpressMail(relay("transaction@notice..", "x@example.com")), false, "never outside Relay");
    assert.equal(isAliExpressMail(relay("transaction@bank.com [via Relay]", "x@mozmail.com")), false);
    assert.equal(isAliExpressMail(relay("AliExpress", "x@example.com")), false, "outside Relay the name alone is never trusted");
    assert.equal(isAliExpressMail({authorName: "x", authorMail: "n@notice.aliexpress.com"}), true);
});

test("relay-forwarded AliExpress mail is auto-read after its notification", async () => {
    const auto = quick();
    const forwarded = mail("r1", "bfqbknest@mozmail.com", {authorName: "transaction@notice.aliexpress.com [via Relay]"});
    auto.noteShown([forwarded]);
    assert.deepEqual(await auto.process([forwarded]), ["7:r1"]);
    assert.equal(forwarded.reads, 1);
});

test("when Checker Plus showed no notification, BongExtend notifies itself and then marks the mail read", async () => {
    const notified = [];
    const auto = quick({notify: async (m) => { notified.push(m.id); return true; }});
    const ali = mail("n1", "x@mozmail.com", {authorName: "transaction@notice.aliexpress.com [via Relay]"});
    const other = mail("n2", "friend@example.com");
    assert.deepEqual(await auto.process([ali, other]), ["7:n1"]);
    assert.deepEqual(notified, ["n1"], "only the AliExpress mail gets a notification");
    assert.equal(ali.reads, 1);
    assert.equal(other.reads, 0);
});

test("a failed own notification leaves the mail unread", async () => {
    const auto = quick({notify: async () => { throw new Error("blocked"); }});
    const ali = mail("n3", "x@notice.aliexpress.com");
    assert.deepEqual(await auto.process([ali]), []);
    assert.equal(ali.reads, 0);
    const none = quick({notify: async () => false});
    const ali2 = mail("n4", "x@notice.aliexpress.com");
    assert.deepEqual(await none.process([ali2]), []);
    assert.equal(ali2.reads, 0);
});

test("old unread AliExpress mail is cleaned up silently, capped per run, and OTP mail is skipped", async () => {
    const notified = [];
    const log = [];
    const auto = quick({notify: async (m) => { notified.push(m.id); return true; }, log: (e) => log.push(e.reason)});
    const old = Array.from({length: 25}, (_, i) => mail("o" + i, "x@notice.aliexpress.com"));
    const otp = mail("otp1", "x@notice.aliexpress.com");
    const stranger = mail("s1", "friend@example.com");
    const marked = await auto.process([], {backlog: [...old, otp, stranger], skip: [mailKey(otp)]});
    assert.equal(marked.length, 20, "capped at 20 per run");
    assert.deepEqual(notified, [], "no notification for the backlog");
    assert.equal(otp.reads, 0);
    assert.equal(stranger.reads, 0);
    assert.ok(log.includes("backlog-read"));
    const again = await auto.process([], {backlog: old});
    assert.equal(again.length, 5, "the rest follow in the next run, none twice");
});
