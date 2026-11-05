import assert from "node:assert/strict";
import test from "node:test";
import {
    GMAIL_IDLE_MS,
    GMAIL_INTERVAL_DEFAULT_MS,
    GMAIL_LOCKED_MS,
    clampIntervalMs,
    dedupeAccounts,
    enabledAccounts,
    orderAccounts,
    mailTabBadge,
    accountUnread,
    isDuplicateEmail,
    inboxSignature,
    nextWaitMs,
    notificationId,
    preferInbox,
    notificationTitle,
    formatMailTime,
    mailSenderLines,
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

test("the mail tab badge counts each email once, skips disabled accounts, and caps at 99+", () => {
    const accounts = [
        {index: 0, email: "a@gmail.com", unread: 4, enabled: true},
        {index: 1, email: "A@gmail.com", unread: 9, enabled: true},
        {index: 2, email: "b@gmail.com", unread: 3, enabled: false},
        {index: 3, email: "c@gmail.com", unread: 2, enabled: true}
    ];
    assert.equal(mailTabBadge(accounts, []), "6");
    assert.equal(mailTabBadge(accounts, [0]), "2");
    assert.equal(mailTabBadge([{index: 0, email: "a@gmail.com", unread: 0, enabled: true}], []), "");
    assert.equal(mailTabBadge([{index: 0, email: "a@gmail.com", unread: 99, enabled: true}], []), "99");
    assert.equal(mailTabBadge([{index: 0, email: "a@gmail.com", unread: 120, enabled: true}], []), "99+");
    assert.equal(mailTabBadge([{index: 0, email: "a@gmail.com", unread: 1, enabled: true, messages: [{id: "1"}, {id: "2"}, {id: "3"}, {id: "4"}]}], []), "4");
    assert.equal(accountUnread({unread: 1, messages: [{id: "1"}, {id: "2"}, {id: "3"}, {id: "4"}]}), 4);
    assert.equal(accountUnread({unread: 9, messages: []}), 0);
});

test("saved email order is kept, duplicates stay one row, and new accounts go last", () => {
    const accounts = [
        {index: 0, email: "ada@gmail.com", unread: 1},
        {index: 1, email: "Ada@gmail.com", unread: 9},
        {index: 2, email: "bea@gmail.com", unread: 2},
        {index: 3, email: "cy@gmail.com", unread: 3}
    ];
    const ordered = orderAccounts(accounts, ["bea@gmail.com", "missing@gmail.com", "ADA@gmail.com"]);
    assert.deepEqual(ordered.map((account) => account.email), ["bea@gmail.com", "ada@gmail.com", "cy@gmail.com"]);
    assert.equal(ordered[1].index, 0);
    assert.deepEqual(orderAccounts(accounts, []).map((account) => account.index), [0, 2, 3]);
});

test("the same email from another mail index is kept once and the first index stays", () => {
    const accounts = [
        {index: 0, email: "Revaptor@gmail.com", unread: 4, messages: [{id: "1"}]},
        {index: 1, email: "other@gmail.com", unread: 1, messages: []},
        {index: 2, email: "revaptor@gmail.com", unread: 4, messages: [{id: "1"}, {id: "2"}]},
        {index: 3, email: "revaptor@gmail.com", unread: 4, messages: []}
    ];
    const unique = dedupeAccounts(accounts);
    assert.deepEqual(unique.map((account) => account.index), [0, 1]);
    assert.equal(unique[0].messages.length, 1);
    const filled = dedupeAccounts([
        {index: 0, email: "a@gmail.com", enabled: true, messages: []},
        {index: 4, email: "a@gmail.com", enabled: false, messages: [{id: "9"}]}
    ]);
    assert.equal(filled[0].index, 0);
    assert.equal(filled[0].enabled, true);
    assert.equal(filled[0].messages[0].id, "9");
    assert.equal(isDuplicateEmail(unique, {email: "REVAPTOR@gmail.com"}), true);
    assert.equal(isDuplicateEmail([], {email: ""}), false);
});

test("mail times are a clock today and a date otherwise, in local time", () => {
    const now = new Date(2026, 10, 2, 15, 0, 0).getTime();
    assert.equal(formatMailTime("", now), "");
    assert.equal(formatMailTime(new Date(2026, 10, 2, 8, 5, 0).toISOString(), now), "08:05");
    assert.equal(formatMailTime(new Date(2026, 10, 1, 9, 7, 0).toISOString(), now), "11/1 09:07");
    assert.equal(formatMailTime(new Date(2026, 9, 1, 9, 7, 0).toISOString(), now), "10/1 09:07");
});

test("sender lines keep the name and the email when they differ", () => {
    assert.deepEqual(mailSenderLines({fromName: "Cursor Team", fromEmail: "team@cursor.com"}), {name: "Cursor Team", email: "team@cursor.com"});
    assert.deepEqual(mailSenderLines({fromName: "Ada", fromEmail: "ada@gmail.com"}), {name: "Ada", email: "ada@gmail.com"});
    assert.deepEqual(mailSenderLines({fromName: "ada@gmail.com", fromEmail: "Ada@gmail.com"}), {name: "ada@gmail.com", email: ""});
    assert.deepEqual(mailSenderLines({fromName: "", fromEmail: "only@gmail.com"}), {name: "only@gmail.com", email: ""});
    assert.deepEqual(mailSenderLines({fromName: "이름만", fromEmail: ""}), {name: "이름만", email: ""});
    assert.deepEqual(mailSenderLines({}), {name: "보낸 사람 없음", email: ""});
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
    const previous = {accounts: [{index: 0, email: "a@gmail.com"}], loggedOut: false};
    assert.equal(preferInbox(null, previous), previous);
    assert.equal(preferInbox({accounts: [], loggedOut: false}, previous), previous);
    assert.equal(preferInbox({accounts: [], loggedOut: true}, previous).loggedOut, true);
});
