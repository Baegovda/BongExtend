// Product UI in a disposable Chrome profile. Download rows are synthetic; no files/accounts/API calls.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-ui-flow-')),ext=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 const ctx=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:780,height:590}});
 try{
  const {id}=await(await ctx.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:ext});
  const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.popupTab':'download','fx.table':{date:'2026-11-10',fetchedAt:Date.now(),rates:{krw:1,usd:.000744,eur:.000664,jpy:.1175}}}));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   if(!location.pathname.endsWith('/recent-downloads.html'))return;
   const now=new Date().toISOString();
   chrome.downloads.search=async()=>[
    {id:1,filename:'C:/Downloads/STOVESetup.exe',url:'https://sgs-live-dl.game.playstove.com/file',fileSize:69531033,state:'complete',exists:true,startTime:now},
    {id:2,filename:'C:/Downloads/table.csv',url:'https://example.test/table.csv',state:'complete',exists:false,startTime:now},
    {id:3,filename:'C:/Downloads/long-file-name-with-progress.zip',url:'https://downloads.example.test/file.zip',state:'in_progress',totalBytes:10485760,bytesReceived:5242880,startTime:now},
    {id:4,filename:'C:/Downloads/paused.zip',url:'https://downloads.example.test/paused.zip',state:'in_progress',paused:true,totalBytes:10485760,bytesReceived:5242880,startTime:now}
   ];
   chrome.downloads.getFileIcon=async()=>chrome.runtime.getURL('images/file-fallback.svg');
  });
  const tabs=['gmail','download','trans','chzzk','dc','fx','dark'];
  for(const width of [780,600,520]){
   await page.setViewportSize({width,height:590});
   await worker.evaluate(width=>chrome.storage.local.set({'core.popupSize':{width,height:590}}),width);
   await page.goto(`chrome-extension://${id}/popup.html`);await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
   await page.locator('#fxBadge:not([hidden])').waitFor();
   let geometry;
   for(const tab of tabs){
    await page.locator(`[data-tab="${tab}"]`).click();await page.waitForTimeout(180);
    const current=await page.evaluate(()=>{
     const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100)};
     return {bar:rect(document.querySelector('.tabs')),group:rect(document.querySelector('#tabGroup')),tools:rect(document.querySelector('.window-tools')),buttons:[...document.querySelectorAll('#tabGroup button')].map(e=>[e.dataset.tab,e.offsetWidth,e.offsetHeight,getComputedStyle(e).fontSize,getComputedStyle(e).fontWeight])};
    });
    if(!geometry)geometry=current;else assert.deepEqual(current,geometry,`stable ${width}px header when selecting ${tab}`);
    assert.equal(current.bar[3],38);
   }
   await page.locator('[data-tab="download"]').click();
   const frame=page.frameLocator('#chronoPopupFrame');await frame.locator('.download-row').nth(3).waitFor();
   const rows=await frame.locator('.download-row').evaluateAll(rows=>rows.map(row=>{
    const r=row.getBoundingClientRect();const fields=[...row.querySelectorAll('.filename,.source,.meta>span,.meta>time,.row-actions')].filter(e=>getComputedStyle(e).display!=='none').map(e=>{const b=e.getBoundingClientRect();return {center:b.y+b.height/2,left:b.left,right:b.right}});
    return {height:r.height,fields,overflow:row.scrollWidth>row.clientWidth+1};
   }));
   for(const row of rows){assert.ok(row.height<=46,`compact row ${width}: ${row.height}`);assert.equal(row.overflow,false);assert.ok(Math.max(...row.fields.map(f=>f.center))-Math.min(...row.fields.map(f=>f.center))<2,'metadata stays on one line');assert.ok(row.fields.every(f=>f.right<=width+1&&f.left>=0));}
   await frame.locator('[data-id="3"] button').nth(1).focus();await page.waitForTimeout(1200);
   assert.equal(await frame.locator('[data-id="3"] button').nth(1).evaluate(e=>e===document.activeElement),true,'live progress retains keyboard focus');
   await page.screenshot({path:path.join(folder,`download-dark-${width}.png`),animations:'disabled'});
   await page.emulateMedia({colorScheme:'light'});await page.screenshot({path:path.join(folder,`download-light-${width}.png`),animations:'disabled'});
  }
  await worker.evaluate(()=>chrome.storage.local.set({'core.modules':{fx:false}}));
  await page.locator('[data-tab="fx"]').click();await page.locator('#moduleStateNotice').waitFor({state:'visible'});
  await page.locator('#moduleEnableCurrent').click();await page.locator('#moduleStateNotice').waitFor({state:'hidden'});
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('core.modules'))['core.modules'].fx),true);
  assert.equal(await page.locator('#fxAmount').getAttribute('aria-label'),'금액');
  await page.locator('[data-tab="dark"]').click();assert.equal(await page.locator('.dark-options[open]').count(),0);
  await page.getByText('색상·밝기 조정',{exact:true}).click();assert.equal(await page.locator('#darkBrightness').isVisible(),true);
  await page.locator('#settingsGear').click();await page.getByText('설정 백업·복원',{exact:true}).click();
  assert.equal(await page.locator('#exportAll').isVisible(),true);
  // Explicitly chosen website in full settings, rather than the settings page itself.
  await ctx.route('https://workflow.example/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Website fixture</title><p>Website fixture</p>'}));
  const target=await ctx.newPage();await target.goto('https://workflow.example/');
  const options=await ctx.newPage();options.on('pageerror',e=>errors.push(e.message));await options.goto(`chrome-extension://${id}/options.html#right`);
  await options.locator('#rightTabSelect option').first().waitFor({state:'attached'});assert.match(await options.locator('#rightLabel').innerText(),/workflow.example/);
  assert.equal(await options.locator('#rightToggle').isEnabled(),true);
  await target.goto('https://workflow.example/changed');await options.getByRole('button',{name:'탭 목록 새로고침'}).click();
  assert.match(await options.locator('#rightLabel').innerText(),/workflow.example/);
  for(const pane of ['download','dark']){await options.locator(`[data-pane="${pane}"]`).click();await options.frameLocator('#settingsStage iframe').locator(pane==='download'?'#chronoPopupFrame':'#darkStatus').waitFor({state:'visible'});}
  assert.deepEqual(errors,[]);console.log('PASS consistent header, compact download rows/focus, module state, progressive settings and website chooser. Evidence:',folder);
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
