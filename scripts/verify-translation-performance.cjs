// Local shopping-page stress test; never attaches to a personal browser profile.
// PLAYWRIGHT_MODULE may point at an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent(`<style>
      body{margin:0;padding:24px;background:#f5f5f5;color:#20252e;font:16px/1.5 sans-serif}
      header{font-size:24px} main{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
      article{padding:12px;background:white;border-radius:12px} .photo{height:120px;background:#dbe8ec;border-radius:8px}
      p{height:48px;overflow:hidden;margin:8px 0} small{display:block} b{color:#e54d13}
      </style><header>상품이 많은 쇼핑몰 · 번역 성능 시험</header><main>${Array.from({length:300},(_,i)=>
      `<article><div class="photo"></div><p>官方旗舰店 新款优质商品 免费配送 ${i}</p><small>限时优惠 活动进行中 ${i}</small><b>立即购买 ${i}</b></article>`).join('')}</main>`);
    const source = fs.readFileSync(process.env.CONTENT_SOURCE || 'src/modules/trans/content/content.js', 'utf8');
    await page.addScriptTag({content:source});
    const result = await page.evaluate(async () => {
      const gaps = [], tasks = [];
      let previous, peak = 0, measuring = true, translated = 0;
      const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration)));
      observer.observe({type:'longtask', buffered:false});
      const sample = time => {
        if (previous != null) gaps.push(time - previous);
        previous = time;
        peak = Math.max(peak, document.querySelectorAll('.pt-page-translator-sweep').length);
        if(measuring) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      const session = __pageTranslator.createSession({
        root:document.documentElement, walkRoot:document.body, enableBanner:false, prefersReducedMotion:false,
        sendBatch:async texts => {translated += texts.length; return {ok:true,translations:texts.map((t,i)=>`공식 신상품 무료 배송 특가 상품 ${translated+i}`)};},
      });
      const started = performance.now();
      session.start();
      await session.whenIdle();
      const responseMs = performance.now() - started;
      await new Promise((resolve,reject) => {const until=performance.now()+25000;const poll=()=>{if(!document.querySelector('.pt-page-translator-sweep,.pt-page-translator-pending'))return resolve();if(performance.now()>until)return reject(Error('effects did not drain'));setTimeout(poll,100);};setTimeout(poll,100);});
      // Also exercise many scroll notifications in a single frame and a reused SPA text slot.
      for(let i=0;i<30;i++) document.dispatchEvent(new Event('scroll'));
      const reused = document.querySelector('main p');
      reused.firstChild.nodeValue = '新消息重新使用已有的文字区域';
      await new Promise((resolve,reject) => {const until=performance.now()+25000;const poll=()=>{if(!document.querySelector('.pt-page-translator-sweep,.pt-page-translator-pending'))return resolve();if(performance.now()>until)return reject(Error('effects did not drain'));setTimeout(poll,100);};setTimeout(poll,100);});
      measuring = false;
      observer.disconnect();
      const stats = {
        responseMs:Math.round(responseMs), translated, peakOverlays:peak,
        longTasks:tasks.length, longTaskMs:Math.round(tasks.reduce((a,b)=>a+b,0)),
        maxLongTaskMs:Math.round(Math.max(0,...tasks)),
        p95FrameMs:Math.round(gaps.sort((a,b)=>a-b)[Math.floor(gaps.length*.95)] || 0),
        maxFrameMs:Math.round(Math.max(0,...gaps)),
        overlaysLeft:document.querySelectorAll('.pt-page-translator-sweep').length,
        heldLeft:document.querySelectorAll('.pt-page-translator-hold').length,
        reusedTranslated:reused.textContent.startsWith('공식'),
      };
      return stats;
    });
    const screenshot = path.join(os.tmpdir(), 'bongextend-translation-performance.png');
    await page.screenshot({path:screenshot});
    console.log(JSON.stringify({...result, errors, screenshot},null,2));
    if (!process.env.BASELINE) {
      assert.equal(errors.length,0);
      assert.ok(result.peakOverlays > 0 && result.peakOverlays <= 16, 'animation concurrency stays bounded');
      assert.equal(result.overlaysLeft,0);
      assert.equal(result.heldLeft,0);
      assert.equal(result.reusedTranslated,true);
      assert.ok(result.maxLongTaskMs < 500, 'no half-second main-thread stall on the fixture');
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
