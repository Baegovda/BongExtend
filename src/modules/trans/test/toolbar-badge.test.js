import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {checkerPlusUnreadCount, toolbarBadgeText, toolbarUnreadCount} from "../../toolbar-badge.js";

test("the toolbar badge is the unread mail total and is empty at zero", () => {
    assert.equal(toolbarBadgeText(0), "");
    assert.equal(toolbarBadgeText("0"), "");
    assert.equal(toolbarBadgeText(-4), "");
    assert.equal(toolbarBadgeText("nope"), "");
    assert.equal(toolbarBadgeText(19), "19");
    assert.equal(toolbarBadgeText(99), "99");
    assert.equal(toolbarBadgeText(100), "99+");
});

test("the toolbar badge uses the same snapshot unread total as the mail tab", () => {
    const snapshot = {accounts: [
        {index: 0, email: "a@gmail.com", unread: 1, messages: [{id: "1"}, {id: "2"}, {id: "3"}, {id: "4"}]},
        {index: 1, email: "b@gmail.com", unread: 2, messages: [{id: "5"}, {id: "6"}]}
    ]};
    assert.equal(toolbarUnreadCount(snapshot, [], 0), 6);
    assert.equal(toolbarUnreadCount(snapshot, [1], 0), 4);
    assert.equal(toolbarUnreadCount(null, [], 3), 3);
});

test("Checker Plus's committed unread count is authoritative for both badges", () => {
    const snapshot = {accounts: [{index: 0, email: "a@gmail.com", unread: 1, messages: [{id: "1"}]}]};
    const checkerPlusCount = checkerPlusUnreadCount({key: "unreadCount", value: 4});
    assert.equal(checkerPlusCount, 4);
    assert.equal(toolbarUnreadCount(snapshot, [], 1, checkerPlusCount), 4);
    assert.equal(toolbarUnreadCount(snapshot, [], 1, checkerPlusUnreadCount({value: 0})), 0);
    assert.equal(checkerPlusUnreadCount({value: "invalid"}), null);
});

test("translation no longer writes a count onto the toolbar icon", () => {
    const source = readFileSync(new URL("../background.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /badgeForStatus/);
    assert.match(source, /paintToolbarBadge/);
    const badge = readFileSync(new URL("../../toolbar-badge.js", import.meta.url), "utf8");
    assert.doesNotMatch(badge, /NEW/);
    assert.match(badge, /gmail\.snapshot/);
    const checkerPlus = readFileSync(new URL("../../../../public/js/common.js", import.meta.url), "utf8");
    assert.match(checkerPlus, /BongExtendOnUnreadCount/);
});
