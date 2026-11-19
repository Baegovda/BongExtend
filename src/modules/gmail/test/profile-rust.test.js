// 골든 테스트: Gmail 페이지에서 프로필 사진 찾기의 Rust 길(native/core-wasm/src/profile.rs)이 예전 자바스크립트와 똑같은지 봐요.
// 시험 글은 모두 지어낸 것이고 개인정보가 없어요.
import assert from "node:assert/strict";
import test from "node:test";
import {prepareCoreWasm, coreCallText} from "../../core-wasm.js";
import {profileFromHtml, profileFromHtmlJs} from "../actions.js";

const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rand = rng(20261120);
const pick = (list) => list[Math.floor(rand() * list.length)];
const bits = [
    "https://lh3.googleusercontent.com/a/ACg8oc1=s64", "https://lh3.googleusercontent.com/a-/AOh14G_x-y=s96", "HTTPS://LH3.GOOGLEUSERCONTENT.COM/A/ZZ",
    "https://lh3.googleusercontent.com/a/", "https://lh3.googleusercontent.com/a-", "https://lh3.googleusercontent.com/b/x",
    "https://mail.google.com/mail/u/0/?ui=2&view=photo&ik=1", "https://mail.google.com/mail/u/12/photo", "https://mail.google.com/mail/u/0/x?y",
    "https://mail.google.com/mail/u//photo", "https://mail.google.com/mail/u/1/PHOTO x", "https://mail.google.com/mail/u/3/a　photo",
    "sample@example.invalid", "Sample@Example.Invalid", "x.y+z@sub.ex.co", "a@b.c", "a@b..cd", "@x.com", "q@w",
    "안녕하세요", "😀", " ", " ", "\n", "\"", "'", "<", ">", "\\", "h", "H", "https://", "photo",
    "<div class=\"a\">", "</div>", "가".repeat(30), "x".repeat(40),
];
// toLowerCase 가 위치를 바꾸는 İ(U+0130)·K(U+212A)는 가끔만 넣어요(들어 있으면 Rust 는 예전 길로 보내야 해요).
const page = () => Array.from({length: Math.floor(rand() * 40)}, () => (rand() < 0.002 ? pick(["İ", "K"]) : pick(bits))).join(pick(["", " ", "\n"]));

test("the Rust engine loads", async () => {
    assert.equal(await prepareCoreWasm(), true);
});

test("random pages give the same photo and email", async () => {
    await prepareCoreWasm();
    let compared = 0, fallbacks = 0;
    for (let n = 0; n < 20000; n++) {
        const html = page();
        const known = pick(["", "", "sample@example.invalid", " SAMPLE@example.invalid ", "a@b.c", "없음@ex.com", "x.y+z@sub.ex.co"]);
        const expected = profileFromHtmlJs(html, known);
        const reply = coreCallText("gmail.profile", [html, known]);
        assert.ok(reply, "Rust 길이 준비돼 있어야 해요");
        if ("fallback" in reply) { fallbacks++; continue; }
        compared++;
        assert.deepEqual(reply.value, expected, `달라요: ${JSON.stringify(html).slice(0, 400)} / ${known}`);
    }
    assert.ok(compared > 15000, `비교 ${compared}, 예전 길 ${fallbacks}`);
});

test("a big page goes through Rust and matches", async () => {
    await prepareCoreWasm();
    const filler = "<div class=\"a b c\"><span>내용 sample text</span><script>var q={\"k\":[1,2,3]};</script></div>\n";
    const html = filler.repeat(3000) + "<img src=\"https://lh3.googleusercontent.com/a/OTHER=s64\">" + filler.repeat(200)
        + "sample@example.invalid<img src=\"https://lh3.googleusercontent.com/a/MINE=s64\">" + filler.repeat(10);
    for (const known of ["", "sample@example.invalid"]) {
        const reply = coreCallText("gmail.profile", [html, known]);
        assert.ok(reply && "value" in reply);
        assert.deepEqual(reply.value, profileFromHtmlJs(html, known));
        assert.deepEqual(profileFromHtml(html, known), profileFromHtmlJs(html, known));
    }
    assert.equal(profileFromHtml(html, "").photo, "https://lh3.googleusercontent.com/a/MINE=s64");
    assert.deepEqual(profileFromHtml("<html>nope</html>"), profileFromHtmlJs("<html>nope</html>"));
});
