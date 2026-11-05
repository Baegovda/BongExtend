import assert from "node:assert/strict";
import test from "node:test";
import {completedDownloadsBadge} from "../settings.js";

test("completed download badge hides zero, shows the count, and caps at 99+", () => {
    assert.equal(completedDownloadsBadge(0), "");
    assert.equal(completedDownloadsBadge(4), "4");
    assert.equal(completedDownloadsBadge(99), "99");
    assert.equal(completedDownloadsBadge(100), "99+");
    assert.equal(completedDownloadsBadge(-1), "");
});
