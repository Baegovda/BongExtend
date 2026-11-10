// Public anonymous page; API source diagnosis, not a claim of product integration.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-musinsa-css-')),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1500}});
  await page.goto('https://www.musinsa.com/brand/musinsastandard?gf=A',{waitUntil:'domcontentloaded'});await page.waitForTimeout(3000);
  const confirm=page.getByRole('button',{name:'확인',exact:true});if(await confirm.count()&&await confirm.first().isVisible())await confirm.first().click();
  const sample=()=>page.locator('.bg-white').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width>100&&r.height>20&&r.top<innerHeight&&r.bottom>0}).slice(0,15).map(e=>({class:e.className,bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color})));
  const photos=()=>page.locator('img').evaluateAll(es=>es.filter(e=>e.naturalWidth>100).slice(0,20).map(e=>({src:e.currentSrc,filter:getComputedStyle(e).filter})));
  const originalPhotos=await photos();console.log('BEFORE',await sample());await page.screenshot({path:path.join(folder,'before.png')});
  await page.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
  const fixes=await import(require('node:url').pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href);
  await page.evaluate(f=>{window.cssFailures=[];DarkReader.setFetchMethod(async url=>{try{return await fetch(url,{credentials:'omit'})}catch(e){cssFailures.push(url);throw e}});DarkReader.enable({},f)},fixes.withTranslationColors());await page.waitForTimeout(4000);
  const direct=await sample();console.log('DIRECT',direct,'CSS failures',await page.evaluate(()=>cssFailures));await page.screenshot({path:path.join(folder,'direct-dark.png')});
  await page.exposeFunction('publicCss',async url=>{if(!/(^|\.)(msscdn\.net|musinsa\.com)$/.test(new URL(url).hostname))throw Error('Fixture public CSS host only');const r=await fetch(url,{credentials:'omit',redirect:'error'});const text=await r.text();if(text.length>1048576||!r.headers.get('content-type')?.includes('text/css'))throw Error('Rejected CSS');return text});
  await page.evaluate(f=>{DarkReader.disable();DarkReader.setFetchMethod(async url=>new Response(await publicCss(url),{headers:{'content-type':'text/css'}}));DarkReader.enable({},f)},fixes.withTranslationColors());await page.waitForTimeout(4000);
  const relayed=await sample();console.log('DIAGNOSTIC RELAY',relayed);assert.ok(direct.some(r=>r.bg==='rgb(255, 255, 255)'));assert.ok(relayed.every(r=>r.bg!=='rgb(255, 255, 255)'));
  const currentPhotos=await photos();for(const image of originalPhotos){const same=currentPhotos.find(i=>i.src===image.src);if(same)assert.equal(same.filter,image.filter)}
  await page.screenshot({path:path.join(folder,'relay-dark.png')});await page.evaluate(()=>DarkReader.disable());await page.waitForTimeout(200);console.log('OFF',await sample());await page.screenshot({path:path.join(folder,'off.png')});console.log('PASS mixed-CORS CSS diagnosis and photos preserved',folder);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
