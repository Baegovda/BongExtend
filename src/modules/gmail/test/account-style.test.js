import assert from "node:assert/strict";
import test from "node:test";
import {ACCOUNT_COLORS, accountColor, accountInitial} from "../account-style.js";
import {contrastRatio} from "../../theme/contrast.js";
import {defaultSound, normalizeSound} from "../sound.js";
import {photoCredentials, profileFromHtml, readProfilePhoto} from "../actions.js";

test("each account keeps one color and the letter stays readable", () => {
    assert.equal(accountColor("Ada@example.com"), accountColor("ada@example.com"));
    assert.equal(accountColor("ada@example.com", {"ada@example.com": "#112233"}), "#112233");
    assert.equal(accountColor("ada@example.com", {"ada@example.com": "red"}), accountColor("ada@example.com"));
    assert.equal(accountColor("ada@example.com", {"ada@example.com": "#ffff00"}), accountColor("ada@example.com"));
    assert.equal(accountInitial("ada@example.com"), "A");
    assert.equal(accountInitial(""), "?");
    for (const color of ACCOUNT_COLORS) {
        assert.ok(contrastRatio("#ffffff", color) >= 4.5, color);
        assert.ok(contrastRatio(color, "#000000") >= 3, `${color} dark`);
        assert.ok(contrastRatio(color, "#f2f2f7") >= 3, `${color} light`);
    }
});

test("sound defaults stay on and only known names are kept", () => {
    assert.deepEqual(defaultSound(), {on: true, name: "soft", volume: 0.4});
    assert.deepEqual(normalizeSound(undefined), defaultSound());
    assert.deepEqual(normalizeSound({on: false, name: "nope", volume: 2}), {on: false, name: "soft", volume: 1});
});

test("profile photo is read from the gmail page html", async () => {
    const html = `https://lh3.googleusercontent.com/a-/OTHER other@gmail.com https://lh3.googleusercontent.com/a-/MINE ada@gmail.com`;
    assert.equal(profileFromHtml(html, "ada@gmail.com").photo, "https://lh3.googleusercontent.com/a-/MINE");
    assert.equal(profileFromHtml(html, "ada@gmail.com").email, "ada@gmail.com");
    assert.equal(profileFromHtml("<html>nope</html>").photo, "");
    assert.equal(photoCredentials("https://lh3.googleusercontent.com/a-/MINE"), "omit");
    assert.equal(photoCredentials("https://mail.google.com/mail/u/0/photo"), "include");
    const fetchImpl = async (_url, init) => {
        assert.equal(init.credentials, "omit");
        return {ok: true, blob: async () => new Blob([Uint8Array.from([1, 2, 3])], {type: "image/png"})};
    };
    const got = await readProfilePhoto(fetchImpl, html, "ada@gmail.com");
    assert.equal(got.email, "ada@gmail.com");
    assert.match(got.photo, /^data:image\/png;base64,/);
    const failed = await readProfilePhoto(async () => { throw new Error("blocked"); }, html, "ada@gmail.com");
    assert.equal(failed.photo, "");
});
