import assert from "node:assert/strict";
import test from "node:test";
import {Window} from "happy-dom";
import {installRightClickGuard, removeRightClickGuard} from "../inject.js";
import {nextOrigins, originOf, originPattern} from "../origin.js";

test("only http(s) pages get a site pattern", () => {
    assert.equal(originOf("https://shop.example/item"), "https://shop.example");
    assert.equal(originOf("http://a.test:8080/x"), "http://a.test:8080");
    assert.equal(originOf("chrome://extensions"), "");
    assert.equal(originPattern("https://shop.example"), "https://shop.example/*");
    assert.deepEqual(nextOrigins(["https://a.test"], "https://b.test", true), ["https://a.test", "https://b.test"]);
    assert.deepEqual(nextOrigins(["https://a.test", "https://b.test"], "https://a.test", false), ["https://b.test"]);
});

test("the guard blocks the page menu handler and then removes itself", () => {
    const dom = new Window();
    const previous = {window: globalThis.window, document: globalThis.document};
    globalThis.window = dom;
    globalThis.document = dom.document;
    dom.document.body.innerHTML = '<p id="text" oncontextmenu="return false">글</p>';
    let pageSawMenu = false;
    dom.document.body.addEventListener("contextmenu", () => { pageSawMenu = true; });
    try {
        installRightClickGuard();
        assert.equal(dom.document.getElementById("text").hasAttribute("oncontextmenu"), false);
        assert.ok(dom.document.getElementById("bex-right-click"));
        assert.match(dom.document.getElementById("bex-right-click").textContent, /user-select:\s*text/);
        dom.document.body.dispatchEvent(new dom.Event("contextmenu", {bubbles: true, cancelable: true}));
        assert.equal(pageSawMenu, false);
        const seen = [];
        dom.alert = () => seen.push("alert");
        installRightClickGuard();
        dom.alert("hi");
        assert.deepEqual(seen, []);
        removeRightClickGuard();
        assert.equal(dom.document.getElementById("bex-right-click"), null);
        dom.document.body.dispatchEvent(new dom.Event("contextmenu", {bubbles: true, cancelable: true}));
        assert.equal(pageSawMenu, true);
    } finally {
        globalThis.window = previous.window;
        globalThis.document = previous.document;
    }
});
