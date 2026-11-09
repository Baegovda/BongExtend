// Public anonymous page, temporary extension/profile. Never personal Chrome.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-malltail-product-')),extension=path.join(folder,'extension');
 fs.cpSync(process.env.BONG_DARK_FIXTURE_EXTENSION||'.output/chrome-mv3',extension,{recursive:true});
 const manifestFile=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));manifest.host_permissions.push('https://*.malltail.com/*');fs.writeFileSync(manifestFile,JSON.stringify(manifest));
 // Stage latest source into the disposable package without rebuilding the app.
 // The hook body is extracted verbatim with only its TypeScript annotations erased.
 const entry=fs.readFileSync('src/entrypoints/dark.content.ts','utf8');
 const fetchHook=entry.slice(entry.indexOf('async function fetchDarkImage'),entry.indexOf('export default')).replace('url: string, init: RequestInit): Promise<Response>','url, init)').replace('error?: Error, response?: Response','error, response').replace('resolve(response!)','resolve(response)');
 const helpers=fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/modules/dark/icon-contrast.js','utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'')+'\n'+fetchHook+';window.sourceTestIcons=createIconContrastController(document,()=>{}, {fetchImage:fetchDarkImage});sourceTestIcons.start();const glyph=document.querySelector(".malltail-logo");window.glyphBackground=glyph.style.backgroundColor;glyph.style.backgroundColor="#181a1b";sourceTestIcons.inspect(glyph);';
 new Function(helpers);fs.writeFileSync(path.join(extension,'test-source-icons.js'),helpers);
 const viewport=process.argv.includes('--wide')?{width:3600,height:1950}:{width:1500,height:1500};
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,viewport,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  await(await context.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:extension});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.darkMode':{enabledSites:[],followSystem:false}}));
  const page=await context.newPage();await page.goto('https://post.malltail.com/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(4000);
  const snapshot=async name=>{
   console.log(name,await page.locator('.hotdeal-feature-card__image,.hotdeal-feature-list__image').evaluateAll(es=>es.slice(0,3).map(e=>({loaded:e.complete,natural:e.naturalWidth,src:e.currentSrc,opacity:getComputedStyle(e).opacity,filter:getComputedStyle(e).filter,blend:getComputedStyle(e).mixBlendMode,parent:getComputedStyle(e.parentElement).backgroundColor}))));
   await page.screenshot({path:path.join(folder,name+'.png')});
  };
  await snapshot('before');await worker.evaluate(()=>chrome.storage.local.set({'core.darkMode':{enabledSites:['malltail.com'],followSystem:false}}));await page.waitForTimeout(6000);await snapshot('dark');
  const relay=await worker.evaluate(async()=>{
   const tab=(await chrome.tabs.query({url:'https://post.malltail.com/*'}))[0];
   const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>new Promise(resolve=>{
    const port=chrome.runtime.connect({name:'bongextend-dark-image'});const timer=setTimeout(()=>{port.disconnect();resolve({ok:false,timeout:true})},4000);
    port.onMessage.addListener(r=>{clearTimeout(timer);port.disconnect();resolve({ok:r.ok,type:r.type,bytes:r.data?atob(r.data).length:0})});port.postMessage({url:'https://cdn.malltail.com/goods_img/contents/index/header_logo2025_D.svg'});
   })});return results[0].result;
  });require('node:assert/strict').equal(relay.ok,true);console.log('PASS actual extension image relay',relay);
  await worker.evaluate(async()=>{const tab=(await chrome.tabs.query({url:'https://post.malltail.com/*'}))[0];await chrome.scripting.executeScript({target:{tabId:tab.id},files:['test-source-icons.js']})});
  await page.waitForFunction(()=>document.querySelector('.malltail-logo[data-bong-icon-owned]'),null,{timeout:10000});
  console.log('PASS latest controller -> direct-CORS-failure -> actual permission-checked relay -> repaired vector (temporary dark glyph backdrop).');
  await worker.evaluate(async()=>{const tab=(await chrome.tabs.query({url:'https://post.malltail.com/*'}))[0];await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{sourceTestIcons.stop();const glyph=document.querySelector('.malltail-logo');glyph.style.backgroundColor=glyphBackground;}})});
  require('node:assert/strict').equal(await page.locator('.malltail-logo[data-bong-icon-owned]').count(),0);
  await worker.evaluate(()=>chrome.storage.local.set({'core.darkMode':{enabledSites:[],followSystem:false}}));await page.waitForTimeout(1000);await snapshot('off');console.log('Evidence:',folder);
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
