// Synthetic CSS glyph checks in disposable Chrome; no shopping/site requests.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'be-dark-pseudo-'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.setContent(`<style>
      body{background:white;color:#222;font:16px Arial;padding:20px}button{position:relative;background:white;border:1px solid #ddd;width:44px;height:44px;margin:6px;vertical-align:middle}
      .bar::before,.plus::after{content:"";position:absolute;width:16px;height:2px;left:13px;top:20px;background:rgba(0,0,0,.85)}
      .plus::after{transform:rotate(90deg)}
      .arrow::before{content:"";position:absolute;width:10px;height:10px;border-right:2px solid #ddd;border-bottom:2px solid #ddd;transform:rotate(-45deg);left:15px;top:15px}
      .text::before{content:"+";font-size:24px;color:#111}
      .brand::before{background:#e52447}.mask::before{mask-image:linear-gradient(black,black)}
      .gradient::before{background:linear-gradient(black,#222)}.motion::before{transition:background-color .2s}
      .block::before{width:18px;height:18px}.photo::before{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E")}
      .alpha{opacity:.4}.desc{display:inline-block;width:40px;height:40px;position:relative}
    </style><h1>로컬 CSS pseudo glyph</h1><p>활성 + / − / 화살표 / 문자</p>
    <button id="plus" class="bar plus" aria-label="수량 늘리기" data-bong-pseudo-owned="author-original"></button><button id="minus" class="bar" aria-label="수량 줄이기"></button><button id="arrow" class="arrow" aria-label="다음"></button><button id="text" class="text" aria-label="더하기"></button>
    <p>보존: disabled / brand / mask / gradient / transition / 넓은 면 / photo / opacity / hidden</p>
    <button id="disabled" disabled class="bar"></button><button id="brand" class="bar brand"></button><button id="mask" class="bar mask"></button><button id="gradient" class="bar gradient"></button><button id="motion" class="bar motion"></button><button id="block" class="bar block"></button><button id="photo" class="bar photo"></button><button id="alpha" class="bar alpha"></button><button id="hidden" hidden class="bar"></button>
    <p>내부 span / 상태 변경</p><button aria-label="내부 더하기"><span id="span" class="bar plus desc"></span></button><button id="dynamic" class="bar" aria-label="동적 상태"></button><button id="marker" class="bar" aria-label="사이트 marker 변경"></button><div id="load"></div>`);
    await page.addScriptTag({ content: fs.readFileSync('node_modules/darkreader/darkreader.js', 'utf8') });
    const fixes = await import(pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href);
    await page.evaluate(f => DarkReader.enable({}, f), fixes.withTranslationColors());
    await page.waitForTimeout(250);
    // Separately exercise low-contrast text paint; real upstream already makes
    // ordinary #111 foreground text readable while its background bars stay dark.
    await page.evaluate(()=>{const e=document.createElement('style');e.className='darkreader';e.textContent='.text::before{color:rgba(20,20,20,.8)}';document.head.append(e);});
    const read = () => page.locator('button[id],#span').evaluateAll(es => Object.fromEntries(es.map(e => {
      const p = getComputedStyle(e, '::before'), a = getComputedStyle(e, '::after');
      return [e.id, { bg:p.backgroundColor, color:p.color, border:p.borderRightColor,
        image:p.backgroundImage, mask:p.maskImage, width:p.width, height:p.height,
        transform:p.transform, opacity:p.opacity, content:p.content, after:a.backgroundColor,
        inline:e.getAttribute('style'), marker:e.getAttribute('data-bong-pseudo-owned') }];
    })));
    const baseline = await read(); await page.screenshot({ path:path.join(folder,'baseline.png') });
    await page.addScriptTag({ content: fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'') + '\n' + fs.readFileSync('src/modules/dark/pseudo-contrast.js','utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'') + ';window.pseudo=createPseudoContrastController(document);pseudo.start();' });
    const inspectAll = () => page.evaluate(() => {
      for (const e of document.querySelectorAll('button[id],#span')) {
        let bg = [24,26,27,1], layers=[];
        for(let n=e;n;n=n.parentElement){const c=parseColor(getComputedStyle(n).backgroundColor);if(c){layers.push(c);if(c[3]===1)break;}}
        for(const c of layers.reverse())bg=composite(c,bg);
        pseudo.inspect(e,bg);
      }
    });
    await inspectAll(); await page.waitForTimeout(120);
    const on = await read(); await page.screenshot({ path:path.join(folder,'on.png') });
    for (const id of ['plus','minus','span','dynamic','marker']) assert.notEqual(on[id].bg,baseline[id].bg,id+' background glyph repaired');
    assert.notEqual(on.plus.after,baseline.plus.after);
    assert.notEqual(on.arrow.border,baseline.arrow.border);
    assert.notEqual(on.text.color,baseline.text.color,'neutral text glyph repaired');
    assert.ok(await page.locator('#text').evaluate(e => contrastRatio(composite(parseColor(getComputedStyle(e,'::before').color),[24,26,27,1]),[24,26,27,1]) >= 3));
    for(const id of ['disabled','brand','mask','gradient','motion','block','photo','alpha','hidden']) assert.deepEqual(on[id],baseline[id],id+' preserved');
    for(const id of Object.keys(on)) for(const key of ['width','height','transform','opacity','content','image','mask','inline']) assert.equal(on[id][key],baseline[id][key],id+' '+key+' preserved');
    assert.ok(await page.locator('#plus').evaluate(e => {const c=parseColor(getComputedStyle(e,'::before').backgroundColor);return c[3]===.85 && contrastRatio(composite(c,[24,26,27,1]),[24,26,27,1])>=3;}));
    const changed = await page.evaluate(()=>pseudo.stats.changed); await inspectAll(); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>pseudo.stats.changed),changed,'repeat inspection stable');
    const reads = await page.evaluate(()=>pseudo.stats.pseudoReads);await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>pseudo.stats.pseudoReads),reads,'no marker observer loop');
    await page.locator('#dynamic').evaluate(e=>e.disabled=true);await page.waitForTimeout(100);
    assert.equal((await read()).dynamic.bg,baseline.dynamic.bg,'disabled transition restores glyph');
    await page.locator('#dynamic').evaluate(e=>e.disabled=false);await inspectAll();
    assert.notEqual((await read()).dynamic.bg,baseline.dynamic.bg,'enabled transition repaired');
    await page.locator('#marker').evaluate(e=>e.setAttribute('data-bong-pseudo-owned','site-new'));
    await page.waitForTimeout(100);await inspectAll();
    assert.equal((await read()).marker.marker,'site-new','site marker replacement preserved');
    assert.equal((await read()).marker.bg,baseline.marker.bg);
    await page.locator('#dynamic').evaluate(e=>e.classList.add('brand'));await page.waitForTimeout(100);
    assert.equal((await read()).dynamic.marker,null,'dynamic brand state releases paint');
    await page.locator('#dynamic').evaluate(e=>e.classList.remove('brand'));await inspectAll();
    assert.notEqual((await read()).dynamic.bg,baseline.dynamic.bg);
    await page.evaluate(()=>{for(let i=0;i<110;i++){const e=document.createElement('button');e.className='bar';e.style.position='fixed';e.style.top='650px';e.style.left=(i%20)*50+'px';document.querySelector('#load').append(e);}});
    await page.waitForTimeout(30);
    await page.evaluate(()=>{for(const e of document.querySelectorAll('#load button'))pseudo.inspect(e,[24,26,27,1]);});
    const stats=await page.evaluate(()=>({...pseudo.stats,rules:document.querySelector('.bong-pseudo-contrast').sheet.cssRules.length}));
    assert.ok(stats.maxOwned<=96 && stats.rules<=192 && stats.capped>0,'bounded ownership and rules');
    await page.evaluate(()=>pseudo.stop()); const stopped=await read();
    for(const id of Object.keys(baseline)) if(id!=='marker')assert.deepEqual(stopped[id],baseline[id],id+' stop restores');
    assert.equal(stopped.marker.marker,'site-new');assert.equal(await page.locator('.bong-pseudo-contrast').count(),0);
    await page.evaluate(()=>DarkReader.disable());await page.waitForTimeout(100);
    assert.equal(await page.locator('#plus').evaluate(e=>getComputedStyle(e,'::before').backgroundColor),'rgba(0, 0, 0, 0.85)');
    fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({baseline,on,stopped,stats},null,2));
    console.log(JSON.stringify({result:'PASS',folder,stats}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
