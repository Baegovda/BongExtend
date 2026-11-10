// Synthetic inline card boundaries, using real Dark Reader plus common helper.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-dark-boundaries-')),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.setContent('<body style="background:white;color:#222;font:18px Arial"><h1>합성 구매내역 경계</h1><div id="card" style="width:600px;border:1px solid #888;background:white"><div id="row1" style="padding:24px;border-bottom:3px solid white;background:white">첫 번째 구매</div><div id="row2" style="padding:24px;box-shadow:0 -3px 0 white;background:white">두 번째 구매</div></div></body>');
  await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<p id="brand" style="border-bottom:3px solid #168be0">브랜드색 경계 유지</p><button id="selected" aria-selected="true" style="border:2px solid white;outline:2px solid #ffcc00">선택·focus 경계 유지</button><button id="disabled" disabled style="border:2px solid white">비활성</button><div hidden id="hidden" style="border-bottom:3px solid white">숨김</div><img id="photo" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\'%3E%3Crect width=\'20\' height=\'20\' fill=\'orange\'/%3E%3C/svg%3E">'));
  await page.evaluate(()=>{
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M15 4L7 12L15 20" fill="none" stroke="#333333" stroke-width="2"/></svg>';
   document.body.insertAdjacentHTML('beforeend',`<div style="opacity:.72"><p id="alpha" style="color:rgba(60,60,60,.85)">반투명 중립 글자</p></div><button style="background:#181a1b"><span id="dataGlyph" style="display:block;width:24px;height:24px;background-image:url(data:image/svg+xml;base64,${btoa(svg)})"></span></button><button style="background:#181a1b"><svg width="24" height="24"><path id="svgGlyph" stroke="#333333" fill="none" d="M15 4L7 12L15 20"/></svg></button>`);
  });
  await page.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
  const fixes=await import(require('node:url').pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href);
  await page.evaluate(f=>DarkReader.enable({},f),fixes.withTranslationColors());await page.waitForTimeout(300);
  const read=()=>page.locator('#row1,#row2').evaluateAll(es=>es.map(e=>({id:e.id,border:getComputedStyle(e).borderBottomColor,shadow:getComputedStyle(e).boxShadow,bg:getComputedStyle(e).backgroundColor,inline:e.getAttribute('style')})));
  const baseline=await read();console.log('BASELINE',baseline);await page.screenshot({path:path.join(folder,'base-dark.png')});
  const guards=()=>page.locator('#brand,#selected,#disabled,#hidden,#photo').evaluateAll(es=>es.map(e=>({id:e.id,border:getComputedStyle(e).borderBottomColor,outline:getComputedStyle(e).outline,display:getComputedStyle(e).display,src:e.getAttribute('src'),filter:getComputedStyle(e).filter})));
  const protectedBefore=await guards();
  const helpers=fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/modules/dark/icon-contrast.js','utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'');
  await page.addScriptTag({content:helpers+';window.icons=createIconContrastController(document,()=>contrast.update());window.contrast=createContrastController(document,{inspectImage:icons.inspect});icons.start();contrast.start();'});await page.waitForTimeout(500);
  await page.waitForFunction(()=>document.querySelector('#dataGlyph').hasAttribute('data-bong-icon-owned'));
  assert.equal(await page.locator('#alpha').evaluate(e=>getComputedStyle(e.parentElement).opacity),'0.72');
  assert.match(await page.locator('#alpha').evaluate(e=>e.style.color),/0\.85\)/);
  assert.notEqual(await page.locator('#svgGlyph').evaluate(e=>getComputedStyle(e).stroke),'rgb(51, 51, 51)');
  const repaired=await read();console.log('HELPER',repaired);assert.equal(repaired[0].border,baseline[0].border);assert.equal(repaired[1].shadow,baseline[1].shadow);await page.screenshot({path:path.join(folder,'helper-dark.png')});
  assert.deepEqual(await guards(),protectedBefore);
  const passes=await page.evaluate(()=>contrast.stats.passes);await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>contrast.stats.passes),passes,'no inline observer feedback loop');
  await page.evaluate(()=>{icons.stop();contrast.stop()});await page.waitForTimeout(200);const stopped=await read();assert.equal(stopped[0].border,baseline[0].border);assert.equal(stopped[1].shadow,baseline[1].shadow);assert.equal(await page.locator('[data-bong-icon-owned]').count(),0);console.log('STOP',stopped);console.log(folder);
  await page.evaluate(()=>DarkReader.disable());await page.waitForTimeout(100);assert.equal((await read())[0].border,'rgb(255, 255, 255)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
