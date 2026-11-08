const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'be-video-history-')),ext=path.join(tmp,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 const ctx=await chromium.launchPersistentContext(path.join(tmp,'profile'),{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1000,height:760}});
 try{
  await ctx.route('https://jasonsavard.com/**',r=>r.fulfill({contentType:'text/html',body:'Install fixture'}));
  const welcomeEvent=ctx.waitForEvent('page'),cdp=await ctx.browser().newBrowserCDPSession();
  const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});const welcome=await welcomeEvent;await welcome.waitForURL('https://jasonsavard.com/**');await welcome.close();
  const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
  await worker.evaluate(async()=>{
   const seen=Date.now()-1000;
   await chrome.storage.local.set({'core.update:autoCheck':false,'core.popupTab':'dark','core.downloadsLastSeen':seen,'core.video:status':{type:'progress',percent:42},'core.video:history':[
    {id:'new',filename:'C:\\Downloads\\새로 받은 긴 이름의 테스트 영상 [abc].mkv',completedAt:seen+1},
    {id:'old',filename:'C:\\Downloads\\이전 영상.mp4',completedAt:seen-1}
   ]});
  });
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForFunction(()=>document.querySelector('#downloadBadge').textContent==='1');
  await page.locator('[data-tab=download]').click();
  await page.waitForFunction(()=>document.querySelector('#downloadBadge').hidden);
  await page.locator('#videoHistoryList li').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#videoHistoryList li').count(),2);
  assert.match(await page.locator('#videoActivityStatus').innerText(),/42%/);
  assert.ok((await page.locator('#chronoPopupFrame').boundingBox()).height>300,'video history leaves usable space for the original download list');
  await page.locator('#videoHistoryList button').first().click();
  await page.waitForFunction(()=>document.querySelector('#videoHistoryList button').textContent==='복사했어요');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-frame=download]')).opacity==='1');
  await page.screenshot({path:path.join(tmp,'activity-light.png')});
  await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(tmp,'activity-dark.png')});
  const helper=await ctx.newPage();await helper.goto(`chrome-extension://${id}/video-downloader.html`);
  await page.bringToFront();await page.locator('#videoStatusOpen').click();
  assert.equal(ctx.pages().filter(p=>p.url().includes('/video-downloader.html')).length,1,'progress button reuses the existing video tab');
  await page.bringToFront();
  const writes=await page.evaluate(async()=>{
   let writes=0;const listener=c=>{if(c['core.downloadsLastSeen'])writes++;};chrome.storage.onChanged.addListener(listener);
   await chrome.storage.local.set({'core.video:history':[{id:'third',filename:'C:\\Downloads\\완료.mkv',completedAt:Date.now()}],'core.video:status':{type:'done',filename:'C:\\Downloads\\완료.mkv'}});
   await new Promise(resolve=>setTimeout(resolve,150));chrome.storage.onChanged.removeListener(listener);return writes;
  });
  assert.ok(writes<=2,'acknowledgement must not trigger a repeated storage loop');
  await page.locator('[data-tab=dark]').click();
  await page.evaluate(async()=>{
   chrome.downloads.search=()=>new Promise(resolve=>{window.completeDownloadSearch=resolve;});
   await chrome.storage.local.set({'core.downloadsLastSeen':Date.now()-1000});
  });
  await page.waitForFunction(()=>typeof window.completeDownloadSearch==='function');
  await page.locator('[data-tab=download]').click();
  await page.evaluate(()=>window.completeDownloadSearch([{id:123,state:'complete'}]));
  await page.waitForFunction(()=>document.querySelector('#downloadBadge').hidden);
  assert.equal(await page.locator('#downloadBadge').textContent(),'','late results must not restore an already acknowledged badge');
  assert.deepEqual(errors,[]);console.log('PASS native history, unread badge, progress, copy path, usable frame height and tab reuse; screenshots:',tmp);
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
