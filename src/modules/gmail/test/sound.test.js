import assert from "node:assert/strict";
import test from "node:test";
import {existsSync} from "node:fs";
import {CHECKER_PLUS_SOUNDS, SOUND_LABELS, SOUND_NAMES, defaultSound, normalizeSound, soundFile} from "../sound.js";

test("saved sound stays, and an unknown name falls back without deleting the key shape", () => {
    assert.deepEqual(normalizeSound(undefined), defaultSound());
    assert.equal(normalizeSound({on: false, name: "youvegotmail", volume: 2}).name, "youvegotmail");
    assert.equal(normalizeSound({on: false, name: "youvegotmail", volume: 2}).on, false);
    assert.equal(normalizeSound({name: "nope"}).name, "soft");
    assert.equal(normalizeSound({volume: -3}).volume, 0);
});

test("checker plus sounds keep their file names", () => {
    for (const name of CHECKER_PLUS_SOUNDS) {
        assert.equal(SOUND_NAMES.includes(name), true, name);
        assert.equal(SOUND_LABELS[name], name);
        assert.equal(soundFile(name), `/sounds/${name}.mp3`);
        assert.equal(existsSync(new URL(`../../../../public/sounds/${name}.mp3`, import.meta.url)), true, name);
    }
    assert.equal(soundFile("soft"), "/sounds/soft.wav");
    assert.equal(soundFile("chime"), "/sounds/chime.mp3");
});
