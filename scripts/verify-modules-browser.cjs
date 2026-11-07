// Uses a fresh disposable profile and local files only. No personal Chrome data is loaded.
// MINIMAL_PERMISSIONS=1 skips the optional page scanner, retaining the shipped permissions.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
(async()=>{
const temp=fs.mkdtempSync(path.join(process.env.TEMP,'be-download-test-'));const ext=path.join(temp,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
const bp=path.join(ext,'background.js');fs.writeFileSync(bp,`globalThis.__testErrors=[];self.addEventListener('error',e=>__testErrors.push(e.error?.stack||e.message));self.addEventListener('unhandledrejection',e=>__testErrors.push(e.reason?.stack||String(e.reason)));`+fs.readFileSync(bp,'utf8'));
const m=JSON.parse(fs.readFileSync(path.join(ext,'manifest.json')));if (!process.env.MINIMAL_PERMISSIONS) { m.permissions=[...new Set([...m.permissions,...m.optional_permissions])];m.optional_permissions=[];m.host_permissions=[...new Set([...m.host_permissions,'http://*/*','https://*/*'])];m.optional_host_permissions=[];fs.writeFileSync(path.join(ext,'manifest.json'),JSON.stringify(m)); }
const payload=Buffer.alloc(2*1024*1024);for(let i=0;i<payload.length;i++)payload[i]=i%251;
const server=http.createServer((req,res)=>{if(req.url==='/page'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><head><title>Sample page</title></head><body><a href="/fixture.bin">sample download</a><a href="/other.zip">archive</a></body></html>');return;}const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),payload.length-1):payload.length-1;res.writeHead(range?206:200,{'Content-Type':'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','Content-Disposition':'attachment; filename="fixture.bin"',...(range?{'Content-Range':`bytes ${start}-${end}/${payload.length}`}:{})});if(req.method==='HEAD'){res.end();return;}let pos=start;const timer=setInterval(()=>{const next=Math.min(end+1,pos+16384);res.write(payload.subarray(pos,next));pos=next;if(pos>end){clearInterval(timer);res.end();}},30);res.on('close',()=>clearInterval(timer));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://downloads.test:${server.address().port}/fixture.bin`;
const context=global.ctx=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--disable-extensions'],headless:true,args:['--enable-unsafe-extension-debugging','--host-resolver-rules=MAP downloads.test 127.0.0.1','--no-proxy-server'],viewport:{width:1100,height:800}});
try{const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:path.join(temp,'files'),eventsEnabled:true});const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});const base='chrome-extension://'+id;const w=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:10000});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.goto(base+'/ui/index.html');await page.waitForTimeout(500);
const send=async message=>page.evaluate(m=>Promise.race([chrome.runtime.sendMessage(m),new Promise((_,j)=>setTimeout(()=>j(Error('message timeout: '+m.cmd)),5000))]),message);
const tasks=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('downloady',2);r.onsuccess=()=>{const db=r.result;const q=db.transaction('tasks-v2').objectStore('tasks-v2').getAll();q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error)};r.onerror=()=>reject(r.error)}));
console.log('options',await send({cmd:'dlg_options'}));console.log('add',await send({cmd:'new_task',add_paused:true,tasks:[{url}],source:75}));await page.waitForTimeout(500);let list=await tasks();console.log('task',JSON.stringify(list));assert.equal(list.length,1);const taskid=list[0].id;

const fire=m=>page.evaluate(m=>{chrome.runtime.sendMessage(m).catch(()=>{});},m);
const until=async(fn,label)=>{const deadline=Date.now()+15000;while(Date.now()<deadline){const value=await fn();if(value)return value;await page.waitForTimeout(100);}throw Error('Timed out: '+label);};
await fire({cmd:'t_start',data:[[taskid],null]});
let download=await until(async()=>{const ds=await page.evaluate(()=>chrome.downloads.search({}));return ds.find(d=>d.url===url&&d.state==='in_progress');},'start');
await fire({cmd:'t_stop',data:[taskid]});
await until(async()=>{const [d]=await page.evaluate(id=>chrome.downloads.search({id}),download.id);return d?.paused;},'pause');
console.log('PASS paused');
await fire({cmd:'t_start',data:[[taskid],null]});
const finished=await until(async()=>{const [d]=await page.evaluate(id=>chrome.downloads.search({id}),download.id);return d?.state==='complete'&&d;},'resume and finish');
assert.deepEqual(fs.readFileSync(finished.filename),payload);console.log('PASS resumed, complete bytes match');
await fire({cmd:'t_restart',data:[[taskid],null]});
const restarted=await until(async()=>{const ds=await page.evaluate(()=>chrome.downloads.search({}));return ds.find(d=>d.url===url&&d.id!==download.id&&d.state==='complete');},'restart');
assert.deepEqual(fs.readFileSync(restarted.filename),payload);console.log('PASS restarted bytes match');
assert.equal(await send({cmd:'t_remove',data:[[taskid],false,'ui']}),true);
await until(async()=>!(await tasks()).length,'remove task');assert.ok(fs.existsSync(restarted.filename));console.log('PASS removed list entry without deleting file');
assert.deepEqual(errors,[]);console.log('workererrors',await w.evaluate(()=>__testErrors));console.log('PASS no page exceptions');


if (!process.env.MINIMAL_PERMISSIONS) {
await page.evaluate(()=>chrome.storage.local.set({'chrono.siteAccess':true}));
assert.equal((await page.evaluate(()=>chrome.runtime.sendMessage({type:'chrono-sync-sites'}))).ok,true);
const sample=await context.newPage();await sample.goto(url.replace('/fixture.bin','/page'));await sample.waitForTimeout(700);
const sniffer=await context.newPage();sniffer.on('pageerror',e=>errors.push(e.stack));await sniffer.goto(base+'/pop/sniffer.html');
await sniffer.getByText('sample download',{exact:false}).first().waitFor({timeout:10000});console.log('PASS page link detection');
}
const managerOptions=await context.newPage();managerOptions.on('pageerror',e=>errors.push(e.stack));await managerOptions.goto(base+'/ui/options.html');await managerOptions.waitForTimeout(500);assert.ok(!(await managerOptions.locator('body').innerText()).includes('Chrono Download Manager'));console.log('PASS integrated download settings');
const settings=await context.newPage();settings.on('pageerror',e=>errors.push(e.stack));await settings.goto(base+'/popup.html?mailSettings=1');await settings.locator('#mailSettingsSave:not([disabled])').waitFor({timeout:15000});
assert.equal(await settings.locator('#mailSettingsDialog').evaluate(d=>d.open),true);
await settings.locator('[name=desktopNotification]').uncheck();await settings.locator('#mailSettingsSave').click();await settings.getByText('설정을 저장했어요.',{exact:true}).waitFor();
const saved=await settings.evaluate(()=>chrome.runtime.sendMessage({command:'BongExtendMailOptions'}));assert.equal(saved.values.desktopNotification,false);console.log('PASS native mail settings save without OAuth');
await settings.screenshot({path:path.join(temp,'mail-settings.png')});
assert.deepEqual(errors,[]); assert.deepEqual(await w.evaluate(()=>__testErrors),[]); console.log('PASS no final page or worker exceptions'); console.log('temp',temp);

}finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(async e=>{console.error(e);if(global.ctx)await global.ctx.close();process.exitCode=1});
