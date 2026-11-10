// Disposable Chrome; synthetic DOM + upstream engine. Never accesses a personal profile.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-dark-stability-'));
 const fixes=(await import(require('node:url').pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href)).withTranslationColors();
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  let page=await browser.newPage({viewport:{width:1100,height:800}});
  if(process.argv.includes('--public')){
   try {
    await page.goto('https://namu.wiki/w/WARDOGS',{waitUntil:'domcontentloaded',timeout:25000});console.log('Public result',await page.title(),page.url());
    await page.screenshot({path:path.join(folder,'public-before.png')});
    await page.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
    await page.evaluate(fixes=>DarkReader.enable({},fixes),fixes);await page.waitForTimeout(1500);
    await page.addScriptTag({content:fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+';window.contrast=createContrastController(document);contrast.start();'});
    await page.waitForTimeout(2000);
    const publicSample=await page.evaluate(async()=>{
     const els=[document.body,...document.querySelectorAll('[data-bong-contrast-owned]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>=200&&r.height>=50&&r.top<innerHeight}).slice(0,12);const colors=els.map(()=>new Set());const before={...contrast.stats};const start=performance.now();
     await new Promise(resolve=>{const tick=()=>{els.forEach((el,i)=>colors[i].add(getComputedStyle(el).backgroundColor));if(performance.now()-start>2500)return resolve();requestAnimationFrame(tick)};tick()});return {panels:colors.map(c=>[...c]),passes:contrast.stats.passes-before.passes,changed:contrast.stats.changed-before.changed};
    });
    console.log('Public themed sample',JSON.stringify(publicSample));await page.screenshot({path:path.join(folder,'public-dark.png')});
    await page.evaluate(()=>{contrast.stop();DarkReader.disable()});
   }catch(e){console.log('Public unavailable',e.message.split('\n')[0]);}
   await page.close();page=await browser.newPage({viewport:{width:1100,height:800}});
  }
  await page.setContent('<!doctype html><html><head><style>body{background:#fff;color:#222;font:16px sans-serif}.card{border:1px solid #eee;background:white;width:600px;padding:20px;transition:background-color .15s,color .15s}.card p{color:#777}.dark .card{background:#ddd}nav{background:#fff;width:400px;height:44px}a{padding:8px}</style></head><body><article class="card" id="card"><h1>다크 모드 안정성</h1><p id="text">본문 글자와 카드가 반복해서 깜빡이지 않아야 해요.</p></article><nav><a href="#">메일</a><a href="#">카페</a></nav></body></html>');
  await page.locator('#card').evaluate(el=>el.style.borderRadius='12px');
  await page.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
  await page.evaluate(fixes=>DarkReader.enable({},fixes),fixes);
  await page.waitForTimeout(600);
  await page.addScriptTag({content:fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+';window.contrast=createContrastController(document);contrast.start();'});
  const sample=()=>page.evaluate(async()=>{
   const colors=new Set();let mutations=0;const mo=new MutationObserver(ms=>mutations+=ms.length);mo.observe(document.body,{subtree:true,attributes:true,attributeFilter:['style']});
   const start=performance.now();await new Promise(resolve=>{const tick=()=>{colors.add(getComputedStyle(document.querySelector('#card')).backgroundColor);if(performance.now()-start>2500)return resolve();requestAnimationFrame(tick)};tick()});mo.disconnect();return {colors:[...colors],mutations,stats:{...contrast.stats}};
  });
  const initial=await sample();await page.screenshot({path:path.join(folder,'dark.png')});
  const stable=await sample();console.log('Samples',JSON.stringify({initial,stable,folder}));
  assert.ok(stable.colors.length<=1,'settled card background must stop changing');
  assert.ok(stable.mutations<5,'own inline repair must settle with upstream inline processing');
  assert.ok(stable.stats.passes-initial.stats.passes<5,'idle repair passes must settle');
  // Author changes must still be detected; only upstream-derived variables are ignored.
  await page.locator('#text').evaluate(el=>el.style.color='rgb(230, 230, 230)');await page.waitForTimeout(300);
  assert.equal(await page.locator('#text').evaluate(el=>el.style.color),'rgb(230, 230, 230)');
  await page.locator('#card').evaluate(el=>el.classList.add('author-update'));await page.waitForTimeout(300);
  const afterAuthor=await sample();assert.equal(afterAuthor.colors.length,1,'author re-evaluation must settle too');
  await page.evaluate(()=>{contrast.stop();DarkReader.disable()});await page.waitForTimeout(200);
  assert.equal(await page.locator('#card').evaluate(el=>el.style.backgroundColor),'');
  assert.equal(await page.locator('#card').evaluate(el=>el.style.outline),'');
  assert.equal(await page.locator('#card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  console.log('PASS integrated upstream/contrast stability and OFF restore');
 } finally {await browser.close()}
 if(process.argv.includes('--packaged')){
  const extension=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',extension,{recursive:true});
  const mp=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(mp));manifest.host_permissions.push('https://*.bongextend.example.com/*');fs.writeFileSync(mp,JSON.stringify(manifest));
  const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],timeout:30000});context.setDefaultTimeout(15000);
  try{
   console.log('Packaged profile ready');
   await(await context.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:extension});const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});console.log('Packaged worker ready');
   await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.modules':{gmail:false,trans:false,chzzk:false,dc:false,dark:true},'core.darkMode':{enabledSites:['stability.bongextend.example.com'],followSystem:false}}));
   await worker.evaluate(async()=>{const start=Date.now();while(Date.now()-start<8000){if((await chrome.scripting.getRegisteredContentScripts()).some(s=>s.id==='bongextend-dark-reader'))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Fixture content registration missing');});
   await context.route('https://stability.bongextend.example.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><style>body{background:white;color:#222}.card{background:white;border:1px solid #ddd;width:600px;padding:24px;transition:background-color .15s,color .15s}</style><article class="card" id="card"><h1>제품 패키지 안정성</h1><p style="color:#777">회색 카드 깜빡임 검사</p></article>'}));
   const page=await context.newPage();await page.goto('https://stability.bongextend.example.com/');await page.locator('#card').evaluate(el=>{el.style.borderRadius='12px';el.style.borderColor='#fff';});await page.locator('html[data-darkreader-scheme="dark"]').waitFor();await page.locator('#card[data-bong-contrast-owned="1"]').waitFor();await page.waitForTimeout(1800);console.log('Packaged theme ready');
   const result=await page.evaluate(async()=>{const el=document.querySelector('#card'),colors=new Set();let mutations=0;const mo=new MutationObserver(ms=>mutations+=ms.length);mo.observe(el,{subtree:true,attributes:true,attributeFilter:['style']});const start=performance.now();await new Promise(resolve=>{const tick=()=>{colors.add(getComputedStyle(el).backgroundColor);if(performance.now()-start>2500)return resolve();requestAnimationFrame(tick)};tick()});mo.disconnect();return {colors:[...colors],mutations}});
   assert.equal(result.colors.length,1);assert.equal(result.mutations,0);await page.screenshot({path:path.join(folder,'packaged-dark.png')});
   await worker.evaluate(()=>chrome.storage.local.set({'core.darkMode':{enabledSites:[],followSystem:false}}));await page.locator('html[data-darkreader-scheme]').waitFor({state:'detached'});await page.waitForTimeout(200);assert.equal(await page.locator('#card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
   console.log('PASS actual packaged content/worker stability and OFF restore',JSON.stringify(result),folder);
  }finally{await context.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
