// Disposable profile. Synthetic artwork regression plus the reported public event.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-dark-artwork-'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const dr=fs.readFileSync('node_modules/darkreader/darkreader.js','utf8');
  const fixes=await import(require('node:url').pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href);
  await page.route('https://artwork.example.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.goto('https://artwork.example.test/');
  await page.setContent('<style>body{background:white;color:black}.art{width:240px;height:240px;background-repeat:no-repeat}.gradient{width:200px;height:80px;background:linear-gradient(white,#eee)}</style><div class="art"></div><div class="gradient"></div>');
  await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=c.height=240;const x=c.getContext('2d');x.fillStyle='#111';x.fillRect(0,0,200,220);x.fillStyle='#bba090';x.fillRect(60,40,45,45);window.originalArtwork=c.toDataURL();document.styleSheets[0].insertRule(`.art{background-image:url("${originalArtwork}")}`,0);window.originalArtworkCSS=getComputedStyle(document.querySelector('.art')).backgroundImage;
  });
  await page.addScriptTag({content:dr});
  // Baseline upstream heuristic reproduces the unwanted whole-image inversion.
  await page.evaluate(()=>DarkReader.enable());await page.waitForTimeout(700);
  const upstream=await page.locator('.art').evaluate(e=>getComputedStyle(e).backgroundImage);
  assert.ok(upstream!==await page.evaluate(()=>originalArtworkCSS),'baseline artwork must reproduce an engine URL transformation');
  await page.evaluate(()=>DarkReader.disable());
  await page.evaluate(f=>DarkReader.enable({},f),fixes.withTranslationColors(undefined));await page.waitForTimeout(500);
  assert.equal(await page.locator('.art').evaluate(e=>getComputedStyle(e).backgroundImage),await page.evaluate(()=>originalArtworkCSS));
  assert.ok(Number((await page.locator('.gradient').evaluate(e=>getComputedStyle(e).backgroundImage)).match(/rgb\((\d+)/)[1])<100,'CSS gradients must still be themed');
  await page.screenshot({path:path.join(folder,'synthetic-artwork-preserved.png')});
  await page.evaluate(()=>DarkReader.disable());
  console.log('PASS artwork inversion regression and gradient theming.');
  if(process.argv.includes('--synthetic-only'))return;
  await page.goto('https://lostark.game.onstove.com/Event/Update/261104/Landing',{waitUntil:'domcontentloaded'});await page.waitForTimeout(5000);
  const count=await page.evaluate(()=>{
   window.artworkBefore=[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width*r.height>15000&&getComputedStyle(e).backgroundImage.includes('url(')}).slice(0,120).map(e=>({element:e,image:getComputedStyle(e).backgroundImage,filter:getComputedStyle(e).filter}));return artworkBefore.length;
  });assert.ok(count>=3,'public event artwork must actually be loaded');
  await page.screenshot({path:path.join(folder,'event-original.png')});
  await page.exposeFunction('publicThemeResource',async url=>{
   if(!/(^|\.)onstove\.com$/.test(new URL(url).hostname))throw Error('Unapproved public resource');
   const r=await fetch(url,{credentials:'omit'});return {data:Buffer.from(await r.arrayBuffer()).toString('base64'),type:r.headers.get('content-type')};
  });
  await page.addScriptTag({content:dr});
  await page.evaluate(f=>{DarkReader.setFetchMethod(async url=>{const r=await publicThemeResource(url);return new Response(Uint8Array.from(atob(r.data),c=>c.charCodeAt(0)),{headers:{'content-type':r.type}})});DarkReader.enable({},f)},fixes.withTranslationColors(undefined));
  await page.waitForTimeout(2000);
  const changed=await page.evaluate(()=>artworkBefore.filter(r=>r.element.isConnected&&(getComputedStyle(r.element).backgroundImage!==r.image||getComputedStyle(r.element).filter!==r.filter)).map(r=>({class:r.element.className,before:r.image.slice(0,180),after:getComputedStyle(r.element).backgroundImage.slice(0,180)})));
  assert.deepEqual(changed,[],'large artwork URLs and filters must remain original');
  await page.screenshot({path:path.join(folder,'event-dark-preserved.png')});
  console.log('PASS public event artwork preserved:',count,'Evidence:',folder);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
