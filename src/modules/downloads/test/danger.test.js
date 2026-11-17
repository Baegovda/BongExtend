import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const context = {};
vm.runInNewContext(fs.readFileSync(new URL("../../../../public/download-danger.js", import.meta.url), "utf8"), context);
const {dangerHold, needsDecision} = context.BongDownloadDanger;

test("a download Chrome holds for a decision can be kept or discarded from our downloader", () => {
    const held = dangerHold({state: "in_progress", danger: "file", bytesReceived: 100, totalBytes: 100});
    assert.equal(held.kind, "warn");
    assert.equal(held.canKeep, true);
    assert.equal(needsDecision({state: "in_progress", danger: "uncommon"}), true);
    assert.equal(dangerHold({state: "in_progress", danger: "promptForScanning"}).canKeep, true);
});

test("scanning waits, policy blocks cannot be kept, and normal downloads are untouched", () => {
    assert.equal(dangerHold({state: "in_progress", danger: "asyncScanning"}).kind, "scanning");
    assert.equal(dangerHold({state: "in_progress", danger: "asyncScanning"}).canKeep, false);
    assert.equal(dangerHold({state: "in_progress", danger: "blockedTooLarge"}).kind, "blocked");
    for (const danger of ["safe", "accepted", "allowlistedByPolicy", "deepScannedSafe", undefined]) assert.equal(dangerHold({state: "in_progress", danger}), null);
    assert.equal(dangerHold({state: "complete", danger: "file"}), null, "finished downloads are not held");
    assert.equal(needsDecision({state: "in_progress", danger: "asyncScanning"}), false);
});
