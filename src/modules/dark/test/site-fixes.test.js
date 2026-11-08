import assert from "node:assert/strict";
import test from "node:test";
import {darkReaderFixesForSite, withTranslationColors} from "../site-fixes.js";

test("Taobao disables CSP-blocked inline proxy injection but keeps Dark Reader fixes", () => {
    const fixes = darkReaderFixesForSite("www.taobao.com");
    assert.equal(fixes.disableInlineScriptInjection, true);
    assert.equal(fixes.disableStyleSheetsProxy, true);
});

test("Coupang preserves the official header and category graphics", () => {
    const fixes = darkReaderFixesForSite("www.coupang.com");
    assert.ok(fixes.invert.includes(".select--category--button"));
    assert.ok(fixes.invert.includes(".category-best-title-ad-product"));
    assert.equal(darkReaderFixesForSite("mc.coupang.com"), fixes);
});

test("Naver Search keeps its upstream Dark Reader text fix", () => {
    assert.match(darkReaderFixesForSite("search.naver.com").css, /i\.spnew2/);
});

test("unrelated sites keep Dark Reader's default stylesheet tracking", () => {
    assert.equal(darkReaderFixesForSite("example.com"), undefined);
});

test('temporary prism colors survive theming without replacing site fixes',()=>{
    const original=darkReaderFixesForSite('www.taobao.com'),fixes=withTranslationColors(original);
    assert.ok(fixes.ignoreInlineStyle.includes('.pt-page-translator-sweep *'));
    assert.equal(fixes.disableInlineScriptInjection,true);
    assert.deepEqual(original.ignoreInlineStyle,[]);
    assert.ok(withTranslationColors(undefined).ignoreInlineStyle.length>0);
});
