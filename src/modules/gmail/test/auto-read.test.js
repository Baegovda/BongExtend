import assert from "node:assert/strict";
import test from "node:test";
import {createMailAutoRead, isAliExpressSender, mailKey} from "../auto-read.js";

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
