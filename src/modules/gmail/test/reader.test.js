import test from "node:test";
import assert from "node:assert/strict";
import {parseHTML} from "linkedom";
import {extractPrintBody, looksLoggedOut, printViewUrl, readerSrcdoc} from "../reader.js";

const doc = (html) => parseHTML(html).document;

test("print view url carries ik and thread for the right account", () => {
    const url = new URL(printViewUrl(2, "abc123", "18f0a"));
    assert.equal(url.pathname, "/mail/u/2/");
    assert.equal(url.searchParams.get("view"), "pt");
    assert.equal(url.searchParams.get("ik"), "abc123");
    assert.equal(url.searchParams.get("th"), "18f0a");
});

test("extractPrintBody keeps message text and drops scripts, forms and handlers", () => {
    const d = doc(`<html><body><h2>안녕 제목</h2>
      <table class="message"><tr><td><b>보낸이</b> <a href="javascript:alert(1)" onclick="x()">나쁜 링크</a>
      <a href="https://example.com/a">좋은 링크</a><script>alert(1)</script><form><input name=x></form>
      <img src="https://t.example/p.gif" onerror="x()" style="width:10px;position:fixed;background:url(https://t/x)"></td></tr></table></body></html>`);
    const {subject, html} = extractPrintBody(d);
    assert.equal(subject, "안녕 제목");
    assert.match(html, /보낸이/);
    assert.doesNotMatch(html, /script|<form|<input|onclick|onerror|javascript:/i);
    assert.match(html, /href="https:\/\/example\.com\/a"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.doesNotMatch(html, /position|url\(/i);
});

test("extractPrintBody falls back to the whole body without message tables", () => {
    const {html} = extractPrintBody(doc(`<html><body><h2>제목</h2><div>본문만 있어요</div></body></html>`));
    assert.match(html, /본문만 있어요/);
    assert.doesNotMatch(html, /제목/);
});

test("logged out pages are recognised", () => {
    assert.equal(looksLoggedOut("<html>x</html>", "https://accounts.google.com/ServiceLogin"), true);
    assert.equal(looksLoggedOut('<table class="message"></table>', "https://mail.google.com/mail/u/0/"), false);
});

test("reader document blocks remote images unless allowed and never allows scripts", () => {
    const blocked = readerSrcdoc("<p>x</p>", {images: false});
    const allowed = readerSrcdoc("<p>x</p>", {images: true});
    assert.match(blocked, /img-src data:'?"/);
    assert.doesNotMatch(blocked, /img-src data: https:/);
    assert.match(allowed, /img-src data: https: http:/);
    assert.match(blocked, /default-src 'none'/);
});
