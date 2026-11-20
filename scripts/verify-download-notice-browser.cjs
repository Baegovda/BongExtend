// Download complete notice + sound in the packaged extension (disposable Chrome profile, tiny files from a local test server).
// Checks: a notification and our own sound for each finished download, a sound-only offscreen document that closes
// again when mail watching is off, and the sweep that finds a download whose complete event was missed.
// No personal downloads, accounts or network services.
const {makeTempDir}=require('./temp-dir.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const folder=makeTempDir('be-notice-'),ext=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 let n=0;const server=http.createServer((req,res)=>{if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<p>fixture</p>');return;}res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="bongextend-notice-${++n}.zip"`});res.end('PK fixture');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.join(folder,'files'),eventsEnabled:true});
  const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});
  const worker=context.serviceWorkers().find(w=>w.url().includes(id))||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.modules':{gmail:false,download:true}}));
  await new Promise(r=>setTimeout(r,1500));
  // The mail engine running in the same worker replaces Date.parse; the sweep must not depend on it.
  assert.equal(await worker.evaluate(()=>typeof Date.parse('2026-11-20T05:50:20.516Z')),'object');
  const page=await context.newPage();await page.goto(base+'/');
  const download=async(wait)=>{await page.evaluate(()=>{const a=document.createElement('a');a.href='/file.zip?'+Math.random();document.body.append(a);a.click();});await new Promise(r=>setTimeout(r,wait));};
  const state=()=>worker.evaluate(async()=>({notes:Object.keys(await new Promise(r=>chrome.notifications.getAll(r))).sort(),last:(await chrome.storage.local.get('core.download:lastNotice'))['core.download:lastNotice'],docs:(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).map(c=>c.documentUrl.split('/').pop())}));

  // 1. An offscreen document is already open (the mail engine's): notification + sound through it.
  await download(1200);let s=await state();
  assert.deepEqual(s.notes,['bongextend-download-1']);assert.deepEqual({id:s.last.id,ok:s.last.ok,sound:s.last.sound,via:s.last.via},{id:1,ok:true,sound:true,via:'event'});
  assert.equal(Object.keys(s.last).some(k=>/name|url|file/i.test(k)),false,'diagnostic keeps no file name or address');

  // 2. No offscreen document: a sound-only document opens and closes again because mail watching is off.
  await worker.evaluate(()=>chrome.offscreen.closeDocument().catch(()=>{}));await new Promise(r=>setTimeout(r,300));
  await download(1200);s=await state();
  assert.equal(s.last.id,2);assert.equal(s.last.sound,true);assert.ok(s.docs.some(u=>u.startsWith('offscreen.html?sound=pop')),'sound-only document opened');
  await new Promise(r=>setTimeout(r,5000));s=await state();
  assert.equal(s.docs.some(u=>u.includes('sound=')),false,'sound-only document closed');

  // 3. A missed complete event: forget what was announced (keep the record start), clear the toast, then an alarm wakes the sweep.
  await worker.evaluate(async()=>{const r=(await chrome.storage.session.get('core.download:noticed'))['core.download:noticed'];await chrome.storage.session.set({'core.download:noticed':{since:r.since,ids:[]}});await new Promise(res=>chrome.notifications.clear('bongextend-download-1',res));});
  await worker.evaluate(()=>chrome.alarms.create('be-test-wake',{when:Date.now()+50}));await new Promise(r=>setTimeout(r,1500));
  s=await state();assert.ok(s.notes.includes('bongextend-download-1'),'missed download found by the sweep');assert.equal(s.last.via,'alarm');
  await download(1500);s=await state();assert.deepEqual(s.notes,['bongextend-download-1','bongextend-download-2','bongextend-download-3']);

  // 4. The settings card has the new switch and it saves.
  const manager=await context.newPage();await manager.goto(`chrome-extension://${id}/downloads.html`);
  await manager.locator('#settingsCard summary').click();assert.equal(await manager.locator('#completeSound').isChecked(),true);
  await manager.locator('#completeSound').click();await new Promise(r=>setTimeout(r,300));
  assert.equal((await worker.evaluate(()=>chrome.storage.local.get('core.downloads')))['core.downloads'].completeSound,false);
  await manager.locator('#settingsCard').screenshot({path:path.join(folder,'settings.png')});
  console.log('PASS download notice: event, sound through either offscreen document, sound-only document closes, missed event found by the sweep, settings switch');
 }finally{await context.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
