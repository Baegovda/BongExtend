// Anonymous public page / disposable profile; no account data or external AI.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-dark-icons-'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  await page.goto('https://www.naver.com/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);
  const helpers=fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/modules/dark/icon-contrast.js','utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'');
  await page.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
  await page.exposeFunction('publicThemeResource',async url=>{
   if(!/(^|\.)(pstatic\.net|naver\.com)$/.test(new URL(url).hostname))throw Error('Unapproved public resource');
   const r=await fetch(url,{credentials:'omit'});return {data:Buffer.from(await r.arrayBuffer()).toString('base64'),type:r.headers.get('content-type')};
  });
  const fixes=await import(require('node:url').pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href);
  await page.evaluate(f=>{DarkReader.setFetchMethod(async url=>{const r=await publicThemeResource(url);return new Response(Uint8Array.from(atob(r.data),c=>c.charCodeAt(0)),{headers:{'content-type':r.type}})});DarkReader.enable({},f)},fixes.withTranslationColors(fixes.darkReaderFixesForSite('naver.com')));
  await page.waitForTimeout(3000);
  await page.addScriptTag({content:helpers+';window.icons=createIconContrastController(document,()=>contrast.update());window.contrast=createContrastController(document,{inspectImage:icons.inspect});icons.start();contrast.start();'});
  try{await page.waitForFunction(()=>document.querySelector('#search-ai-tab-button [data-bong-icon-owned]'),null,{timeout:15000});}catch(error){
   console.log(JSON.stringify(await page.locator('#search-ai-tab-button').evaluate(el=>({stats:contrast.stats,styles:[...el.querySelectorAll('*')].filter(e=>getComputedStyle(e).backgroundImage.includes('url(')).map(e=>({tag:e.tagName,inline:e.style.backgroundImage,bg:getComputedStyle(e).backgroundImage.slice(0,200),parents:[e,e.parentElement,e.parentElement.parentElement,el,document.body].map(p=>({tag:p.tagName,cls:p.className,background:getComputedStyle(p).backgroundImage.slice(0,100),color:getComputedStyle(p).backgroundColor,opacity:getComputedStyle(p).opacity,filter:getComputedStyle(p).filter,excluded:p.closest('[role="img"],[hidden],[aria-hidden="true"]')?.outerHTML.slice(0,100)})),rect:[e.getBoundingClientRect().width,e.getBoundingClientRect().height]}))})),null,2));throw error;
  }
  const result=await page.locator('#search-ai-tab-button [data-bong-icon-owned]').first().evaluate(async el=>{
   const read=async url=>{const im=await createImageBitmap(await (await fetch(url,{credentials:'omit'})).blob());const c=new OffscreenCanvas(im.width,im.height),x=c.getContext('2d');x.drawImage(im,0,0);im.close();return x.getImageData(0,0,c.width,c.height).data};
   const before=await read('https://s.pstatic.net/static/www/mobile/edit/aitab/@img_ai_tab_light.png');
   const after=await read(el.style.backgroundImage.slice(5,-2));let changed=0,brand=0;
   for(let i=0;i<before.length;i+=4){if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])changed++;if(Math.max(...before.slice(i,i+3))-Math.min(...before.slice(i,i+3))>25){brand++;if(before.slice(i,i+4).some((n,j)=>n!==after[i+j]))throw Error('Brand pixel changed');}if(before[i+3]!==after[i+3])throw Error('Alpha changed');}
   return {changed,brand};
  });assert.ok(result.changed>100);assert.ok(result.brand>100);
  const passes=await page.evaluate(()=>contrast.stats.passes);await page.waitForTimeout(400);
  await page.screenshot({path:path.join(folder,'naver-ai-dark.png')});
  await page.evaluate(()=>{icons.stop();contrast.stop();DarkReader.disable()});
  assert.equal(await page.locator('[data-bong-icon-owned]').count(),0);
  console.log('PASS public AI bitmap:',result,'passes at snapshot:',passes,'Evidence:',folder);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
