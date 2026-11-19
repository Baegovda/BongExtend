// Actual packaged download manager (downloads.html, BongExtend's own engine since 1.2.94) in a disposable Chrome profile.
// The only download is a tiny file from a local test server; no personal downloads, accounts or network services.
const {makeTempDir}=require('./temp-dir.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const folder=makeTempDir('be-manager-'),ext=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="bongextend-ui-fixture.bin"'});res.end('local fixture');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/bongextend-ui-fixture.bin`;
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,viewport:{width:734,height:500},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:path.join(folder,'files'),eventsEnabled:true});
  const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().split('\n')[0])});
  await page.emulateMedia({colorScheme:'dark'});await page.goto(`chrome-extension://${id}/downloads.html`);await page.locator('#downloadStats').filter({hasText:'최근 기록 0개'}).waitFor();
  await page.waitForTimeout(250);
  // Every visible control stays inside the window and has a readable name.
  const checkControls=async()=>assert.deepEqual(await page.locator('button,select,input,textarea').evaluateAll(controls=>controls.filter(c=>c.getClientRects().length&&c.getBoundingClientRect().width).filter(c=>{const r=c.getBoundingClientRect(),name=(c.getAttribute('aria-label')||c.textContent||c.title||c.placeholder||c.closest('label')?.textContent||'').trim();return r.left<0||r.right>innerWidth+.5||!name;}).map(c=>c.id||c.outerHTML.slice(0,80))),[],'controls stay inside the window and are named');
  const checkNoScroll=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page scroll');
  const brightness=selector=>page.locator(selector).first().evaluate(e=>{let n=e;while(n){const c=getComputedStyle(n).backgroundColor.match(/[\d.]+/g).map(Number);if(c.length<4||c[3]>0)return (c[0]+c[1]+c[2])/3;n=n.parentElement;}return 255;});
  await checkControls();await checkNoScroll();
  assert.equal(await page.locator('#empty').isVisible(),true,'empty state is shown');
  assert.ok(await brightness('body')<80,'dark page background');
  await page.screenshot({path:path.join(folder,'manager-dark.png')});
  await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(200);assert.ok(await brightness('body')>180,'light page background');await page.screenshot({path:path.join(folder,'manager-light.png')});
  await page.setViewportSize({width:440,height:620});await page.waitForTimeout(250);await page.screenshot({path:path.join(folder,'manager-narrow.png')});
  await checkNoScroll();await checkControls();
  console.log('PASS empty themes, 734/440 control bounds and accessible names.');

  const downloadId=await page.evaluate(url=>chrome.downloads.download({url}),url);
  await page.waitForFunction(id=>chrome.downloads.search({id}).then(([d])=>d?.state==='complete'),downloadId);
  const row=page.locator('.download-row[data-state="complete"]').filter({hasText:'127.0.0.1'});await row.waitFor();
  await page.locator('#downloadStats').filter({hasText:'1개 완료'}).waitFor();
  for(const name of ['열기','폴더 보기','기록 지우기'])assert.equal(await row.getByRole('button',{name}).isVisible(),true,name);
  await checkNoScroll();await checkControls();
  await page.screenshot({path:path.join(folder,'manager-item-light.png')});
  // Search and filters hide/show the row; the empty notice follows.
  await page.locator('#search').fill('no-matching-fixture');assert.equal(await page.locator('.download-row').count(),0);assert.equal(await page.locator('#empty').isVisible(),true);
  await page.locator('#search').fill('/ui-fixture\\.bin$/');assert.equal(await page.locator('.download-row').count(),1,'regex search');
  await page.locator('#search').fill('');await page.locator('#stateFilter').selectOption('in_progress');assert.equal(await page.locator('.download-row').count(),0);
  await page.locator('#stateFilter').selectOption('complete');assert.equal(await page.locator('.download-row').count(),1);
  await page.locator('#typeFilter').selectOption('images');assert.equal(await page.locator('.download-row').count(),0);await page.locator('#typeFilter').selectOption('all');
  await page.locator('#stateFilter').selectOption('all');assert.equal(await page.locator('.download-row').count(),1);
  // Table/list view toggle is remembered.
  await page.locator('#viewToggle').click();await page.waitForFunction(()=>chrome.storage.local.get('core.downloads').then(v=>v['core.downloads']?.listView===false));
  assert.equal(await page.locator('#downloadList').evaluate(e=>e.classList.contains('table-view')),true);await page.locator('#viewToggle').click();
  await page.emulateMedia({colorScheme:'dark'});await page.setViewportSize({width:734,height:500});await page.waitForTimeout(300);
  for(const selector of ['.download-name','#viewToggle','#search'])assert.ok(await page.locator(selector).first().evaluate(e=>{const c=getComputedStyle(e).color.match(/\d+/g).map(Number);return (c[0]+c[1]+c[2])/3>150;}),selector+' dark text contrast');
  await page.screenshot({path:path.join(folder,'manager-item-dark.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS manager row actions, search/filters, view toggle, themes and responsive view.');
 }finally{await context.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
