// 골든 테스트: Gmail 피드 읽기의 Rust 길(native/core-wasm)이 예전 자바스크립트와 똑같은 결과를 내는지 봐요.
// 자바스크립트가 오류를 내는 피드에서는 Rust 가 반드시 "예전 길로"라고 답해야 해요(그래야 오류도 똑같이 나요).
import assert from "node:assert/strict";
import test from "node:test";
import {prepareCoreWasm, coreCallText} from "../../core-wasm.js";
import {parseAtom, parseAtomJs} from "../atom.js";

const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rand = rng(20261121);
const pick = (list) => list[Math.floor(rand() * list.length)];
const bits = ["안녕", "제목", "a", "B", " ", "  ", "\n", "\t", " ", "　", "﻿", "&amp;", "&lt;b&gt;", "&quot;", "&apos;", "&amp;lt;", "&#65;", "&#128512;", "&#0065;", "&#99999999;", "&#55357;", "&#12a;", "&#;", "&#9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999;",
  "<![CDATA[x<b>y]]>", "<![CDATA[", "]]>", "<b>", "</b>", "<>", "<<a>", ">", "<", "😀", "x".repeat(20)];
const words = (n) => Array.from({length: Math.floor(rand() * n)}, () => pick(bits)).join("");
const tag = (name, inner) => pick([`<${name}>${inner}</${name}>`, `<${name.toUpperCase()} a="1">${inner}</${name}>`, `<${name}>${inner}`, "", `<${name}s>${inner}</${name}s>`, `<${name}>${inner}</${name.toUpperCase()}>`]);
const href = () => pick([`https://mail.google.com/mail/u/0?a=1&amp;m=18c${Math.floor(rand() * 999)}#inbox/18c${Math.floor(rand() * 999)}`, "x#all", "x#inbox", "x#a/b/%ED%95%9C", "x#a/%E0%A4", "x#a/%zz", "x#/", "", "x#a#b/c", "y#inbox/18c%2F1"]);
const link = () => pick([`<link rel="alternate" href="${href()}" type="text/html" />`, `<LINK HREF="${href()}">`, `<link href="${href()}" xhref="z">`, `<links href="x">`, `<link data-href="q" href="${href()}">`, `<link href="">`, `<link\nhref="${href()}"/>`, "", `<link href="${href()}" href="#second/2">`]);
const entry = () => `<entry>${tag("title", words(6))}${tag("summary", words(10))}${link()}${tag("modified", "2026-11-20T01:00:00Z")}${pick([tag("issued", words(2)), ""])}${tag("id", pick(["tag:gmail.google.com,2004:17" + Math.floor(rand() * 9999), "", "a:12:34  ", "x:", words(2)]))}<author>${tag("name", words(3))}${tag("email", pick(["s@ex.com", words(2)]))}</author></entry>`;
const feed = () => pick(["", `<?xml version="1.0"?>`]) + pick(["<feed version=\"0.3\">", "<feed>", "<FEED>", "<feedx>"]) + tag("title", pick(["Gmail - Inbox for a.b@mail.example.com", "Gmail - x+y@sub.ex.co.kr inbox", "no email", "a@b.c", "a@b..cd", words(4)])) + pick([`<fullcount>${Math.floor(rand() * 50)}</fullcount>`, `<fullcount> 7 </fullcount>`, "<FULLCOUNT>99999999999999999999999</FULLCOUNT>", "<fullcount>x</fullcount>", "", `<fullcount>${"9".repeat(400)}</fullcount>`]) + Array.from({length: Math.floor(rand() * 6)}, entry).join(pick(["", "\n"])) + pick(["</feed>", ""]);

test("the Rust engine loads", async () => {
  assert.equal(await prepareCoreWasm(), true);
});

test("random feeds give the same result, and JavaScript errors stay JavaScript's", async () => {
  await prepareCoreWasm();
  let compared = 0, thrown = 0, fallbacks = 0;
  for (let n = 0; n < 6000; n++) {
    const xml = pick([feed(), feed(), words(5), "<entry><id>1</id></entry>"]);
    let expected, error = null;
    try { expected = parseAtomJs(xml); } catch (e) { error = e; }
    const reply = coreCallText("gmail.parseAtom", [xml]);
    assert.ok(reply, "Rust 길이 준비돼 있어야 해요");
    if (error) {
      thrown++;
      assert.ok("fallback" in reply, `자바스크립트는 오류(${error.name})인데 Rust 가 답했어요: ${xml.slice(0, 300)}`);
      continue;
    }
    if ("fallback" in reply) { fallbacks++; continue; }
    compared++;
    assert.deepEqual(reply.value, expected, `달라요: ${xml.slice(0, 400)}`);
  }
  assert.ok(compared > 4000 && thrown > 50, `비교 ${compared}, 오류 ${thrown}, 예전 길 ${fallbacks}`);
});

test("a realistic inbox feed goes through Rust and matches", async () => {
  await prepareCoreWasm();
  const one = (i) => `<entry><title>제목 ${i} &amp; 안내 &#128512;</title><summary>미리보기 ${i} &lt;b&gt;굵게&lt;/b&gt;</summary><link rel="alternate" href="https://mail.google.com/mail/u/0?account_id=a@b.com&amp;message_id=18c${i}&amp;view=conv&amp;extsrc=atom#inbox/18c${i}" type="text/html" /><modified>2026-11-20T01:00:00Z</modified><issued>2026-11-20T01:00:00Z</issued><id>tag:gmail.google.com,2004:17${i}</id><author><name>보낸이 ${i}</name><email>s${i}@ex.com</email></author></entry>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for a@b.com</title><fullcount>20</fullcount>${Array.from({length: 20}, (_, i) => one(i)).join("")}</feed>`;
  const reply = coreCallText("gmail.parseAtom", [xml]);
  assert.ok(reply && "value" in reply, "보통 피드는 Rust 가 처리해야 해요");
  assert.deepEqual(reply.value, parseAtomJs(xml));
  assert.deepEqual(parseAtom(xml), parseAtomJs(xml));
  assert.equal(parseAtom(null), parseAtomJs(null));
  assert.equal(parseAtom(""), null);
  const short = "<feed><title>Gmail - Inbox for a@b.com</title><fullcount>0</fullcount></feed>";
  assert.deepEqual(parseAtom(short), parseAtomJs(short));
});
