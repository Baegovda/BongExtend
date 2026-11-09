// Synthetic note host only: no login, messages, cookies or personal browser access.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-note-dark-'));
 const extension=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',extension,{recursive:true});
 const file=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file));
 manifest.host_permissions.push('https://*.note.naver.com/*','https://*.pstatic.net/*');fs.writeFileSync(file,JSON.stringify(manifest));
 const css='p.note-panel{background:white;color:#222;padding:16px}';
 const background=path.join(extension,'background.js');
 fs.writeFileSync(background,`globalThis.__frameCssFetches=0;const nativeFetch=fetch;globalThis.fetch=(url,init)=>{if(String(url)==='https://ssl.pstatic.net/fixture-note.css'){__frameCssFetches++;return Promise.resolve(new Response(${JSON.stringify(css)},{headers:{'Content-Type':'text/css'}}));}return nativeFetch(url,init);};`+fs.readFileSync(background,'utf8'));
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,viewport:{width:1100,height:700},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  await (await context.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:extension});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.darkMode':{enabledSites:['note.naver.com'],followSystem:false}}));
  await worker.evaluate(async()=>{
   const deadline=Date.now()+10000;
   while(Date.now()<deadline){
    const scripts=await chrome.scripting.getRegisteredContentScripts();
    if(scripts.filter(s=>s.matches.includes('https://*.note.naver.com/*')).length===2)return;
    await new Promise(resolve=>setTimeout(resolve,100));
   }
   throw new Error('Dark content script registration timed out');
  });
  await context.route('https://ssl.pstatic.net/fixture-note.css',route=>route.fulfill({contentType:'text/css',body:css}));
  await context.route('https://note.naver.com/**',route=>{
   if(route.request().url().endsWith('/negative'))return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><header style="background:green;height:50px">Header</header><aside style="background:gray;width:160px;height:600px">Sidebar</aside><iframe src="/frame" style="position:absolute;left:160px;top:50px;width:850px;height:600px;z-index:-1;border:0"></iframe></body></html>'});
   const frames=route.request().url().endsWith('/frame')?'':`<iframe src="/frame"></iframe><iframe srcdoc="<meta charset='utf-8'><link rel='stylesheet' href='https://ssl.pstatic.net/fixture-note.css'><body style='background:white;color:#222'><p class='note-panel'>합성 srcdoc 본문</p><div hidden>숨김 내용</div></body>"></iframe><iframe id="blank"></iframe>`;
   return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html><head><meta charset="utf-8"><style>body{background:white;color:#222;font:18px sans-serif}iframe{width:95%;height:150px} [hidden]{display:none}</style></head><body><h1>합성 쪽지 화면 — 실제 계정 아님</h1><p>일반 문서 목록</p><div hidden>숨김 내용</div>${frames}</body></html>`});
  });
  const page=await context.newPage();await page.goto('https://note.naver.com/');await page.waitForTimeout(5000);
  await page.locator('#blank').evaluate(e=>{e.contentDocument.body.innerHTML='<p>합성 about:blank 본문</p><div hidden>숨김 내용</div>';e.contentDocument.body.style.cssText='background:white;color:#222';});
  for(const frame of page.frames())await frame.waitForFunction(()=>document.documentElement.dataset.darkreaderScheme==='dark' && Number(getComputedStyle(document.body).backgroundColor.match(/\d+/)[0])<100,null,{timeout:10000});
  const states=[];
  for(const frame of page.frames())states.push(await frame.evaluate(()=>({url:location.href,hostname:location.hostname,dark:document.documentElement.dataset.darkreaderScheme==='dark',fallback:document.querySelector('.darkreader--fallback')?.textContent,body:getComputedStyle(document.body).backgroundColor,text:getComputedStyle(document.body).color,hidden:document.querySelector('[hidden]')?getComputedStyle(document.querySelector('[hidden]')).display:null})));
  console.log(JSON.stringify(states,null,2));
  await page.screenshot({path:path.join(folder,'note-synthetic-dark.png')});console.log('Evidence:',folder);
  assert.equal(states[0].dark,true);assert.equal(states[0].hidden,'none');
  assert.equal(states.find(s=>s.url.endsWith('/frame')).dark,true);
  // Regression for inherited-origin frames; real signed-in note DOM is not inspected.
  assert.equal(states.find(s=>s.url==='about:srcdoc').dark,true);
  assert.equal(states.find(s=>s.url==='about:blank').dark,true);
  const panel=page.frames().find(frame=>frame.url()==='about:srcdoc').locator('.note-panel');
  assert.ok(Number((await panel.evaluate(e=>getComputedStyle(e).backgroundColor)).match(/\d+/)[0])<100);
  assert.ok(await worker.evaluate(()=>__frameCssFetches)>0,'srcdoc CSS bridge must validate the Chrome-provided sender origin');
  for(const state of states){assert.notEqual(state.body,'rgb(255, 255, 255)');assert.ok(Number(state.text.match(/\d+/)[0])>150);assert.equal(state.hidden,'none');}
  for(const frame of page.frames())assert.equal(await frame.locator('body').evaluate(e=>getComputedStyle(e).visibility),'visible');
  // Legacy apps replace an inherited-origin document, rather than just its body.
  await page.locator('#blank').evaluate(e=>{
   const d=e.contentDocument;d.open();d.write('<!doctype html><html><head><meta charset="utf-8"><style>body{background:white;color:#222}p{padding:8px}</style></head><body><p id="rewritten">문서 교체 후 목록</p><div hidden>숨김 내용</div></body></html>');d.close();
  });
  const rewritten=page.frames().find(frame=>frame.url()==='about:blank');
  await rewritten.waitForFunction(()=>document.documentElement.dataset.darkreaderScheme==='dark' && Number(getComputedStyle(document.body).backgroundColor.match(/\d+/)[0])<100,null,{timeout:10000});
  assert.equal(await rewritten.locator('#rewritten').isVisible(),true);
  await rewritten.evaluate(()=>document.querySelector('style:not(.darkreader)').sheet.insertRule('#rewritten{color:rgb(0,60,100)}',0));
  await rewritten.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#rewritten')).color.match(/\d+/g)[1])>100);
  const negative=await context.newPage();await negative.goto('https://note.naver.com/negative');
  await negative.waitForFunction(()=>document.body.style.backgroundColor==='transparent' && document.documentElement.style.backgroundColor==='transparent',null,{timeout:10000});
  await negative.frames()[1].waitForFunction(()=>document.documentElement.dataset.darkreaderScheme==='dark');
  assert.equal(await negative.locator('iframe').evaluate(e=>getComputedStyle(e).zIndex),'-1');
  const pixels=await negative.screenshot({path:path.join(folder,'negative-frame-dark.png')});
  const bright=await negative.evaluate(async base64=>{
   const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const p=x.getImageData(170,55,700,150).data;let count=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>500)count++;return count;
  },pixels.toString('base64'));assert.ok(bright>100,'negative iframe text must actually paint through both-themed root/body');
  await worker.evaluate(()=>chrome.storage.local.set({'core.darkMode':{enabledSites:[],followSystem:false}}));
  for(const frame of page.frames()){
   await frame.waitForFunction(()=>!document.documentElement.hasAttribute('data-darkreader-scheme'));
   assert.equal(await frame.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
   assert.equal(await frame.locator('[hidden]').evaluate(e=>getComputedStyle(e).display),'none');
  }
  await negative.waitForFunction(()=>!document.documentElement.hasAttribute('data-darkreader-scheme'));
  assert.equal(await negative.locator('body').evaluate(e=>e.style.backgroundColor),'');
  console.log('PASS synthetic note: URL/srcdoc/about:blank, document replacement + CSSOM, negative-frame painted text, hidden preservation and OFF restoration.');
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
