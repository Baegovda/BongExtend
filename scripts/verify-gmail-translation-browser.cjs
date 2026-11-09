// Synthetic inbox only. No Gmail session or paid API access.
const { chromium } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 650 } });
    await page.setContent(`<style>body{background:#191c1d;color:#ddd;font:15px Arial;padding:28px}.row{padding:16px;border-bottom:1px solid #444;white-space:nowrap}.snippet{color:#aaa}</style><main><h2>받은편지함 — 합성 시험</h2><div class="row" role="row"><span id="subject">배송이 시작되었습니다</span> - <span id="snippet" class="snippet" contenteditable="false"></span></div><div class="row"><span id="split"></span></div><input value="Keep my draft"><code>SKU-123</code><img alt="Firefox Relay" width="16" height="16"></main>`);
    await page.addScriptTag({ content: fs.readFileSync('src/modules/trans/content/content.js', 'utf8') });
    const result = await page.evaluate(async () => {
      const source = 'Forwarded from sample@example.invalid by Firefox Relay Premium Email trackers removed Manage this mask 배송 현황 확인하기';
      const target = 'sample@example.invalid에서 Firefox Relay Premium을 통해 전달됨 이메일 추적기 제거됨 이 마스크 관리 배송 현황 확인하기';
      const parts = ['Forwarded from ', 'sample@example.invalid', ' by Firefox Relay Premium ', 'Email trackers removed ', 'Manage this mask'];
      const outputs = ['전달한 주소 ', 'sample@example.invalid', ' Firefox Relay Premium을 통해 ', '이메일 추적기 제거됨 ', '이 마스크 관리'];
      const snippet = document.querySelector('#snippet'); snippet.textContent = source; snippet.title = source;
      const split = document.querySelector('#split');
      for (const text of parts) { const span = document.createElement('span'); span.textContent = text; split.append(span); }
      const sent = [];
      const session = __pageTranslator.createSession({ root: document.querySelector('main'), enableBanner: false,
        sendBatch: async texts => { sent.push(...texts); return {ok:true, translations:texts.map(text => text === source ? target : outputs[parts.findIndex(part => part.trim() === text)]?.trim() || text)}; } });
      session.start(); await session.whenIdle();
      await new Promise(resolve => setTimeout(resolve, 1800));
      await session.translateTitle(snippet);
      const translated = { text:snippet.textContent, title:snippet.title, split:split.textContent };
      snippet.firstChild.nodeValue = source;
      await new Promise(resolve => setTimeout(resolve, 100)); await session.whenIdle();
      const rerender = snippet.textContent;
      session.setShowOriginal(true); const original = snippet.textContent;
      session.setShowOriginal(false);
      await new Promise(resolve => setTimeout(resolve, 1800));
      const again = snippet.textContent;
      globalThis.finishFixture = () => { session.setEnabled(false); return snippet.textContent; };
      return { sent, source, target, translated, rerender, original, again,
        overlays:document.querySelectorAll('.pt-page-translator-sweep').length,
        draft:document.querySelector('input').value, code:document.querySelector('code').textContent };
    });
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'be-gmail-translation-'));
    await page.screenshot({ path:path.join(folder,'translated.png') });
    console.log(JSON.stringify({ ...result, screenshot:path.join(folder,'translated.png') },null,2));
    assert.ok(result.sent.includes(result.source));
    assert.equal(result.translated.text,result.target);
    assert.equal(result.translated.title,result.target);
    assert.equal(result.rerender,result.target);
    assert.equal(result.original,result.source);
    assert.equal(result.again,result.target);
    assert.ok(!result.translated.split.includes('Email trackers removed'));
    assert.equal(result.overlays,0);
    assert.equal(result.draft,'Keep my draft'); assert.equal(result.code,'SKU-123');
    assert.equal(await page.evaluate(() => finishFixture()), result.source);
    const { createTranslator } = await import('../src/modules/trans/lib/translator.js');
    const { makeCacheKey } = await import('../src/modules/trans/lib/cache.js');
    const stored=new Map([[await makeCacheKey('gemini-3.5-flash-lite','ko',result.source),result.source]]);
    let repairCalls=0;
    const repair=createTranslator({persistentCache:{get:async key=>stored.get(key),setMany:async pairs=>pairs.forEach(([k,v])=>stored.set(k,v))},
      loadSettings:async()=>({}),translateFn:async texts=>{repairCalls++;return texts.map(()=>result.target);}});
    await page.exposeFunction('repairBatch',async texts=>({ok:true,...await repair.translateMany(texts)}));
    const repaired=await page.evaluate(async source=>{
      const root=document.createElement('section');root.textContent=source;document.body.append(root);
      const session=__pageTranslator.createSession({root,enableBanner:false,revealAnimation:false,sendBatch:texts=>repairBatch(texts)});
      session.start();await session.whenIdle();return {text:root.textContent,status:session.getStatus()};
    },result.source);
    assert.equal(repaired.text,result.target);assert.equal(repaired.status.done,1);assert.equal(repairCalls,1);
    let failedCalls = 0;
    const translator = createTranslator({ persistentCache:{get:async()=>null,setMany:async()=>{throw new Error('must not cache');}},
      loadSettings:async()=>({}), translateFn:async texts=>{failedCalls++;return texts;} });
    await page.exposeFunction('incompleteBatch',async texts=>{
      try { return {ok:true,...await translator.translateMany(texts)}; }
      catch(error) {return {ok:false,code:error.code,message:error.message};}
    });
    const failed = await page.evaluate(async source=>{
      const root = document.createElement('section');root.textContent=source;document.body.append(root);
      const session=__pageTranslator.createSession({root,enableBanner:true,sendBatch:texts=>incompleteBatch(texts)});
      session.start();await session.whenIdle();
      const status=session.getStatus();
      session.start();await session.whenIdle();
      return {status,afterRetry:session.getStatus(),text:root.textContent};
    },result.source);
    assert.match(failed.status.error,/翻訳|번역/);
    assert.equal(failed.text,result.source);assert.equal(failedCalls,1);
    await page.screenshot({path:path.join(folder,'incomplete.png')});
    console.log(JSON.stringify({failed,failedCalls,errorScreenshot:path.join(folder,'incomplete.png')},null,2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
