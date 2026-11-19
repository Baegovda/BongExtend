// Uses a fresh disposable profile and local files only. No personal Chrome data is loaded.
// MINIMAL_PERMISSIONS=1 skips the optional page scanner, retaining the shipped permissions.
// Since 1.2.94 the download module is BongExtend's own manager (downloads.html) on top of chrome.downloads;
// the old Chrono engine/UI (ui/index.html, downloady IndexedDB, new_task/t_* messages, pop/sniffer.html) is gone.
const {makeTempDir}=require('./temp-dir.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
(async()=>{
const temp=makeTempDir('be-download-test-');const ext=path.join(temp,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
const bp=path.join(ext,'background.js');fs.writeFileSync(bp,`globalThis.__testErrors=[];self.addEventListener('error',e=>__testErrors.push(e.error?.stack||e.message));self.addEventListener('unhandledrejection',e=>__testErrors.push(e.reason?.stack||String(e.reason)));`+fs.readFileSync(bp,'utf8'));
const m=JSON.parse(fs.readFileSync(path.join(ext,'manifest.json')));if (!process.env.MINIMAL_PERMISSIONS) { m.permissions=[...new Set([...m.permissions,...m.optional_permissions])];m.optional_permissions=[];m.host_permissions=[...new Set([...m.host_permissions,'http://*/*','https://*/*'])];m.optional_host_permissions=[];fs.writeFileSync(path.join(ext,'manifest.json'),JSON.stringify(m)); }
const payload=Buffer.alloc(2*1024*1024);for(let i=0;i<payload.length;i++)payload[i]=i%251;
const server=http.createServer((req,res)=>{if(req.url==='/page'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><head><title>Sample page</title></head><body><a href="/fixture.bin">sample download</a><a href="/other.zip">archive</a></body></html>');return;}const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),payload.length-1):payload.length-1;res.writeHead(range?206:200,{'Content-Type':'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','Content-Disposition':'attachment; filename="fixture.bin"',...(range?{'Content-Range':`bytes ${start}-${end}/${payload.length}`}:{})});if(req.method==='HEAD'){res.end();return;}let pos=start;const timer=setInterval(()=>{const next=Math.min(end+1,pos+16384);res.write(payload.subarray(pos,next));pos=next;if(pos>end){clearInterval(timer);res.end();}},30);res.on('close',()=>clearInterval(timer));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://downloads.test:${server.address().port}/fixture.bin`;
const context=global.ctx=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--disable-extensions'],headless:true,args:['--enable-unsafe-extension-debugging','--host-resolver-rules=MAP downloads.test 127.0.0.1','--no-proxy-server'],viewport:{width:1100,height:800}});
try{const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:path.join(temp,'files'),eventsEnabled:true});const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});const base='chrome-extension://'+id;const w=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:10000});
await w.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false}));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.goto(base+'/downloads.html');await page.locator('#downloadStats').filter({hasText:'최근 기록'}).waitFor();
const search=q=>page.evaluate(q=>chrome.downloads.search(q),q);
const until=async(fn,label)=>{const deadline=Date.now()+20000;while(Date.now()<deadline){const value=await fn();if(value)return value;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
const row=state=>page.locator(`.download-row[data-state="${state}"]`).first();

// Start from the manager's own "여러 주소 받기" box, then pause/resume with the row buttons.
await page.locator('#batchInput').fill(url);assert.match(await page.locator('#batchCount').innerText(),/^1개 주소/);await page.locator('#startBatch').click();
const download=await until(async()=>(await search({url})).find(d=>d.state==='in_progress'),'start');
await row('in_progress').getByRole('button',{name:'잠시 멈춤'}).click();
await until(async()=>(await search({id:download.id}))[0]?.paused,'pause');
await row('in_progress').getByRole('button',{name:'이어받기'}).waitFor();console.log('PASS paused from the manager row');
await row('in_progress').getByRole('button',{name:'이어받기'}).click();
const finished=await until(async()=>{const [d]=await search({id:download.id});return d?.state==='complete'&&d;},'resume and finish');
assert.deepEqual(fs.readFileSync(finished.filename),payload);
await page.locator('#downloadStats').filter({hasText:'1개 완료'}).waitFor();await row('complete').getByRole('button',{name:'열기'}).waitFor();
console.log('PASS resumed, complete bytes match, completed count and actions shown');

// Cancel a second copy, then "다시 받기" on the interrupted row.
await page.locator('#batchInput').fill(url);await page.locator('#startBatch').click();
const second=await until(async()=>(await search({url})).find(d=>d.state==='in_progress'),'second start');
await row('in_progress').getByRole('button',{name:'취소'}).click();
await until(async()=>(await search({id:second.id}))[0]?.state==='interrupted','cancel');
await row('interrupted').getByRole('button',{name:'다시 받기'}).click();
const restarted=await until(async()=>(await search({url})).find(d=>d.id!==download.id&&d.id!==second.id&&d.state==='complete'),'restart');
assert.deepEqual(fs.readFileSync(restarted.filename),payload);console.log('PASS cancelled and restarted, bytes match');

// "기록 지우기" removes only the history entry, never the file.
const before=(await search({})).length;
const index=await page.locator('.download-row .download-name').evaluateAll((names,file)=>names.findIndex(n=>n.title===file),restarted.filename);assert.ok(index>=0,'restarted row is listed');
await page.locator('.download-row').nth(index).getByRole('button',{name:'기록 지우기'}).click();
await until(async()=>!(await search({id:restarted.id})).length,'erase history');assert.equal((await search({})).length,before-1);
assert.ok(fs.existsSync(restarted.filename));console.log('PASS removed list entry without deleting file');
assert.deepEqual(errors,[]);console.log('workererrors',await w.evaluate(()=>__testErrors));console.log('PASS no page exceptions');

if (!process.env.MINIMAL_PERMISSIONS) {
const sample=await context.newPage();await sample.goto(url.replace('/fixture.bin','/page'));await sample.waitForTimeout(500);
const [tab]=await w.evaluate(u=>chrome.tabs.query({url:u}),url.replace('/fixture.bin','/page'));assert.ok(tab,'sample tab');
const scanner=await context.newPage();scanner.on('pageerror',e=>errors.push(e.stack));await scanner.goto(`${base}/downloads.html?sourceTabId=${tab.id}`);
await scanner.locator('#scanPage').click();await scanner.locator('#sniffPanel').waitFor();
await scanner.locator('.sniff-row').filter({hasText:'sample download'}).waitFor({timeout:10000});assert.equal(await scanner.locator('.sniff-row').count(),2);console.log('PASS page link detection');
// Keep only the fixture link checked; the named download goes through the background "bongextend-download" message.
// The saved name itself is not checked: with CDP download behavior Chrome names the file and skips onDeterminingFilename.
const known=new Set((await search({})).map(d=>d.id));
await scanner.locator('.sniff-row').filter({hasText:'archive'}).locator('input').uncheck();await scanner.locator('#downloadSelected').click();
await scanner.locator('#status').filter({hasText:'1개 파일을 받기 시작했어요.'}).waitFor();
const named=await until(async()=>(await search({url})).find(d=>!known.has(d.id)&&d.state==='complete'),'selected page download');
assert.deepEqual(fs.readFileSync(named.filename),payload);assert.equal((await search({})).filter(d=>!known.has(d.id)).length,1,'only the checked item is downloaded');
console.log('PASS selected page item downloaded through the background');
}
const managerOptions=await context.newPage();managerOptions.on('pageerror',e=>errors.push(e.stack));await managerOptions.goto(base+'/downloads.html#settings');await managerOptions.locator('#replaceChromeUi').waitFor();
assert.equal(await managerOptions.locator('#settingsCard').evaluate(d=>d.open),true);assert.ok(!(await managerOptions.locator('body').innerText()).includes('Chrono Download Manager'));
await managerOptions.locator('#folder').fill('BongExtend-test');await managerOptions.locator('#folder').press('Tab');
await until(async()=>(await managerOptions.evaluate(()=>chrome.storage.local.get('core.downloads')))['core.downloads']?.folder==='BongExtend-test','download settings saved');console.log('PASS integrated download settings');
const settings=await context.newPage();settings.on('pageerror',e=>errors.push(e.stack));await settings.goto(base+'/popup.html?mailSettings=1');await settings.locator('#mailSettingsSave:not([disabled])').waitFor({timeout:15000});
assert.equal(await settings.locator('#mailSettingsDialog').evaluate(d=>d.open),true);
await settings.locator('[name=desktopNotification]').uncheck();await settings.locator('#mailSettingsSave').click();await settings.getByText('설정을 저장했어요.',{exact:true}).waitFor();
const saved=await settings.evaluate(()=>chrome.runtime.sendMessage({command:'BongExtendMailOptions'}));assert.equal(saved.values.desktopNotification,false);console.log('PASS native mail settings save without OAuth');
await settings.screenshot({path:path.join(temp,'mail-settings.png')});
assert.deepEqual(errors,[]); assert.deepEqual(await w.evaluate(()=>__testErrors),[]); console.log('PASS no final page or worker exceptions');

}finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(async e=>{console.error(e);if(global.ctx)await global.ctx.close();process.exitCode=1});
