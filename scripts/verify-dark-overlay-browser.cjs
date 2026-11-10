// Bounded synthetic diagnostics, NOT a Smartstore reproduction or cart action.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'be-dark-overlay-'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    await page.setContent(`<style>
      body{margin:0;background:white;color:#222;font:16px Arial}
      main{padding:40px}button{background:white;color:#222;border:1px solid #ddd;padding:12px}
      #shade{position:fixed;inset:0;background:rgba(0,0,0,.45)}
      aside{position:fixed;right:0;top:0;bottom:0;width:370px;padding:24px;background:white;overflow:auto}
      article{margin:20px 0;border-bottom:1px solid #ddd;padding:12px 0}
      img{width:180px;height:120px;object-fit:cover}h2{font-size:21px}
    </style><main><h1>로컬 상품 진단</h1><p>반투명 backdrop 아래의 본문</p>
      <button aria-label="수량 줄이기"><svg width="20" height="20"><path d="M3 10H17" stroke="#333" stroke-width="2"/></svg></button>
      <span>1</span><button aria-label="수량 늘리기"><svg width="20" height="20"><path d="M3 10H17M10 3V17" stroke="#333" stroke-width="2"/></svg></button></main>`);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#f4a340"/><circle cx="90" cy="60" r="36" fill="#3498db"/></svg>';
    const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    const open = () => page.evaluate(src => {
      const layer = document.createElement('div'); layer.id = 'layer';
      layer.innerHTML = `<div id="shade"></div><aside aria-label="로컬 추천 sidebar"><h2>장바구니에 담았어요</h2><p>같이 둘러볼 만한 상품</p><article><img id="photo" alt="로컬 도형 이미지"><p id="name">추천 상품 이름과 가격 12,000원</p><button aria-label="찜">♡</button></article></aside>`;
      layer.querySelector('img').src = src; document.body.append(layer);
    }, src);
    const sample = () => page.evaluate(() => {
      const ids = ['shade', 'photo', 'name'];
      return Object.fromEntries(ids.map(id => {
        const e = document.getElementById(id), s = getComputedStyle(e), r = e.getBoundingClientRect();
        return [id, { background: s.backgroundColor, color: s.color, opacity: s.opacity,
          visibility: s.visibility, display: s.display, filter: s.filter, width: r.width,
          height: r.height, src: e.getAttribute('src'), loaded: e instanceof HTMLImageElement ? e.complete && e.naturalWidth > 0 : null }];
      }));
    });
    await open(); await page.locator('#photo').evaluate(e => e.decode());
    const before = await sample(); await page.screenshot({ path: path.join(folder, 'before.png') });
    await page.locator('#layer').evaluate(e => e.remove());
    await page.addScriptTag({ content: fs.readFileSync('node_modules/darkreader/darkreader.js', 'utf8') });
    const fixes = await import(pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href);
    await page.evaluate(f => DarkReader.enable({}, f), fixes.withTranslationColors());
    await page.addScriptTag({ content: fs.readFileSync('src/modules/dark/contrast.js', 'utf8').replace(/export /g, '') + ';window.contrast=createContrastController(document);contrast.start()' });
    await open(); await page.locator('#photo').evaluate(e => e.decode());
    await page.waitForTimeout(500);
    const on = await sample(); await page.screenshot({ path: path.join(folder, 'on.png') });
    await page.evaluate(() => { contrast.stop(); DarkReader.disable(); });
    await page.waitForTimeout(150);
    const off = await sample(); await page.screenshot({ path: path.join(folder, 'off.png') });
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify({ before, on, off }, null, 2));
    const imagePresentation = ({ color, ...rest }) => rest; // Inherited text color does not paint an opaque image.
    for (const state of [on, off]) {
      assert.deepEqual(imagePresentation(state.photo), imagePresentation(before.photo), 'image source, loading and presentation preserved');
      assert.equal(state.name.opacity, '1'); assert.equal(state.name.visibility, 'visible');
      assert.notEqual(state.name.display, 'none'); assert.ok(state.name.width > 0 && state.name.height > 0);
      assert.equal(state.shade.background, before.shade.background, 'backdrop alpha preserved');
    }
    assert.deepEqual(off, before, 'OFF restores original styles');
    console.log(JSON.stringify({ result: 'PASS', folder, onText: on.name.color, backdrop: on.shade.background, imagePreserved: true }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
