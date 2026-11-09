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
    const fixes = withTranslationColors(darkReaderFixesForSite("gall.dcinside.com"));
    assert.equal(fixes.disableInlineScriptInjection, true);
    assert.notEqual(fixes.disableStyleSheetsProxy, true);
    assert.notEqual(fixes.disableCustomElementRegistryProxy, true);
});

test('temporary prism colors survive theming without replacing site fixes',()=>{
    const original=darkReaderFixesForSite('www.taobao.com'),fixes=withTranslationColors(original);
    assert.ok(fixes.ignoreInlineStyle.includes('.pt-page-translator-sweep *'));
    assert.equal(fixes.disableInlineScriptInjection,true);
    assert.deepEqual(original.ignoreInlineStyle,[]);
    assert.ok(withTranslationColors(undefined).ignoreInlineStyle.length>0);
});

test('common rules preserve artwork colors independently of the site hostname',()=>{
 for(const hostname of ['example.com','naver.com','lostark.game.onstove.com']){
  const f=withTranslationColors(darkReaderFixesForSite(hostname));
  assert.ok(f.ignoreImageAnalysis.includes('*'));
  assert.ok(f.ignoreInlineStyle.includes('[data-bong-icon-owned="1"]'));
 }
});

test('Naver homepage brightens only monochrome toolbar sprites and neutral text in dark mode',()=>{
 const fixes=darkReaderFixesForSite('www.naver.com');assert.equal(darkReaderFixesForSite('naver.com'),fixes);
 for(const icon of ['.btn_menu','.link_pay','.btn_notify','.link_shopping'])assert.ok(fixes.css.includes(icon));
 assert.match(fixes.css,/data-darkreader-scheme="dark"/);assert.match(fixes.css,/foreground-subtle-3/);
 assert.deepEqual(fixes.invert,[]);assert.doesNotMatch(fixes.css,/(?:img|body)\s*\{/);
 assert.notEqual(darkReaderFixesForSite('search.naver.com'),fixes);
 assert.equal(darkReaderFixesForSite('mail.naver.com'),undefined);
});

test('homepage corrections target neutral labels and known monochrome pseudo elements',()=>{
 const {css}=darkReaderFixesForSite('naver.com');
 for(const part of ['nickname___','item_link___','btn_location___','weather_status___','time___','thumb_setting___','btn_next___','SettingView-module__btn_setting___'])assert.ok(css.includes(part));
 assert.doesNotMatch(css,/opacity\s*:|visibility\s*:|display\s*:|weather_icon|dust_status/);
 assert.equal(darkReaderFixesForSite('note.naver.com'),undefined);
});
