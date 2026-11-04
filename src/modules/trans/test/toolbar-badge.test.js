import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {toolbarBadgeText} from "../../toolbar-badge.js";

test("the toolbar badge is the unread mail total and is empty at zero", () => {
    assert.equal(toolbarBadgeText(0), "");
    assert.equal(toolbarBadgeText("0"), "");
    assert.equal(toolbarBadgeText(-4), "");
    assert.equal(toolbarBadgeText("nope"), "");
    assert.equal(toolbarBadgeText(19), "19");
    assert.equal(toolbarBadgeText(99), "99");
    assert.equal(toolbarBadgeText(100), "99+");
});

test("translation no longer writes a count onto the toolbar icon", () => {
    const source = readFileSync(new URL("../background.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /badgeForStatus/);
    assert.match(source, /paintToolbarBadge/);
    const badge = readFileSync(new URL("../../toolbar-badge.js", import.meta.url), "utf8");
    assert.doesNotMatch(badge, /NEW/);
    assert.match(badge, /gmail\.unread/);
});
