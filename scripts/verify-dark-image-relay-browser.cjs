// Actual packaged content script -> permission-checked worker -> SVG repair. Synthetic HTTPS sites only.
const {chromium}=require('playwright');const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-image-relay-')),ext=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 const file=path.join(ext,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file));manifest.host_permissions.push('https://*.bongextend.example.com/*');fs.writeFileSync(file,JSON.stringify(manifest));
 const ctx=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:800,height:550}});
 try{
  await(await ctx.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:ext});const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.modules':{gmail:false,chzzk:false,trans:false,dc:false,dark:true},'core.darkMode':{enabledSites:['ui.bongextend.example.com'],followSystem:false}}));
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32"><rect x="8" y="6" width="60" height="18" rx="3" fill="#111111"/><circle cx="95" cy="15" r="10" fill="#00aaff"/></svg>';
  let imageRequests=0;
  await ctx.route('https://cdn.bongextend.example.com/icon.svg',route=>{imageRequests++;return route.fulfill({contentType:'image/svg+xml',body:svg});});
  await ctx.route('https://ui.bongextend.example.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Image relay fixture</title><style>body{background:white;color:#222;font:16px system-ui}header{padding:20px;background:#fff}a{display:block;width:120px;height:32px;background-image:url(https://cdn.bongextend.example.com/icon.svg)}img{width:220px;height:120px}</style><header><a id="logo" href="#" aria-label="홈"></a></header><p>공통 SVG 대비 검사</p><img id="photo" alt="원색 사진" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'220\' height=\'120\'%3E%3Crect width=\'220\' height=\'120\' fill=\'%23df468a\'/%3E%3C/svg%3E">'}));
  const page=await ctx.newPage();await page.goto('https://ui.bongextend.example.com/');
  await page.waitForFunction(()=>document.querySelector('#logo[data-bong-icon-owned="1"]'),null,{timeout:15000});
  const result=await page.locator('#logo').evaluate(async el=>{
   const raster=async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
   const original=await raster('data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32"><rect x="8" y="6" width="60" height="18" rx="3" fill="#111111"/><circle cx="95" cy="15" r="10" fill="#00aaff"/></svg>'));
   const after=await raster(el.style.backgroundImage.slice(5,-2));let changed=0,brand=0,alpha=0;
   for(let i=0;i<original.length;i+=4){if(original[i+3]!==after[i+3])alpha++;if(Math.max(...original.slice(i,i+3))-Math.min(...original.slice(i,i+3))>25){if(original.slice(i,i+4).some((v,j)=>v!==after[i+j]))brand++;}else if(original[i]!==after[i])changed++;}return {changed,brand,alpha};
  });assert.ok(result.changed>100);assert.equal(result.brand,0);assert.equal(result.alpha,0);
  const photo=await page.locator('#photo').evaluate(e=>({src:e.src,filter:getComputedStyle(e).filter,loaded:e.complete&&e.naturalWidth>0}));assert.equal(photo.filter,'none');assert.equal(photo.loaded,true);
  await page.screenshot({path:path.join(folder,'dark.png')});
  const ask=async url=>worker.evaluate(async url=>{const tab=(await chrome.tabs.query({url:'https://ui.bongextend.example.com/*'}))[0];const results=await chrome.scripting.executeScript({target:{tabId:tab.id},args:[url],func:url=>new Promise(resolve=>{const port=chrome.runtime.connect({name:'bongextend-dark-image'});port.onMessage.addListener(value=>{port.disconnect();resolve({ok:value.ok,type:value.type})});port.postMessage({url});})});return results[0].result;},url);
  assert.equal((await ask('https://ungranted.example.org/icon.svg')).ok,false,'ungranted image origin is rejected');
  await worker.evaluate(()=>chrome.storage.local.set({'core.darkMode':{enabledSites:[],followSystem:false}}));
  await page.waitForFunction(()=>!document.querySelector('[data-bong-icon-owned]'));assert.equal((await ask('https://cdn.bongextend.example.com/icon.svg')).ok,false,'disabled site cannot relay');
  assert.equal(await page.locator('#logo').evaluate(e=>e.style.backgroundImage),'');await page.screenshot({path:path.join(folder,'off.png')});
  console.log('PASS packaged SVG repair/relay, brand+alpha/photo preservation, permission denial and OFF restoration.',{result,imageRequests,folder});
 }finally{await ctx.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
