// Actual packaged manager in a disposable Chrome profile. No personal downloads.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-manager-')),ext=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 if(process.argv.includes('--source'))for(const file of ['download-module.css','download-module.js','ui/index.html'])fs.copyFileSync(path.join('public',file),path.join(ext,file));
 if(process.argv.includes('--source'))fs.copyFileSync('src/modules/theme/theme.css',path.join(ext,'theme/theme.css'));
 const diagnostic=process.argv.includes('--diagnose'),vendor=process.argv.includes('--vendor');
 if(vendor){const html=path.join(ext,'ui/index.html');fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace('<link rel="stylesheet" href="/download-module.css">','').replace('<script src="/download-module.js"></script>',''));}
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,viewport:{width:734,height:500},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  const {id}=await(await context.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:ext});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().split('\n')[0])});await page.emulateMedia({colorScheme:'dark'});await page.goto(`chrome-extension://${id}/ui/index.html`);await page.locator('.loading-overlay').waitFor({state:'hidden'});
  await page.waitForTimeout(350);
  if(process.argv.includes('--bridge-only')){console.log(JSON.stringify(await page.evaluate(async()=>({name:Ta(We),keys:await Promise.all([4,8,13].map(async id=>({id,keys:await(await vf()).a([String(id)])})))}))));return;}
  const start=page.locator('a.mdl-noty__primary-action').filter({hasText:/^시작$/});
  if(await start.count())await start.evaluate(e=>e.click());
  await page.waitForTimeout(250);
  const checkToolbar=async()=>assert.equal(await page.locator('#dy_tbar button[id]').evaluateAll(buttons=>buttons.filter(b=>b.getBoundingClientRect().width).every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&!!b.getAttribute('aria-label')&&!!(b.title||b.querySelector('.mdl-tooltip')?.textContent);})),true);
  if(!diagnostic)await checkToolbar();
  await page.screenshot({path:path.join(folder,'manager-dark.png')});
  if(process.argv.includes('--baseline')){console.log('Evidence:',folder);return;}
  assert.notEqual(await page.locator('#dy_lnav').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(250, 250, 250)');
  await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(200);await page.screenshot({path:path.join(folder,'manager-light.png')});
  await page.setViewportSize({width:440,height:620});await page.waitForTimeout(250);await page.screenshot({path:path.join(folder,'manager-narrow.png')});
  if(!diagnostic){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await checkToolbar();}
  if(!diagnostic)console.log('PASS empty themes, 734/440 toolbar bounds and accessible names. Evidence:',folder);
  console.log('new task',await page.evaluate(()=>chrome.runtime.sendMessage({cmd:'new_task',add_paused:true,tasks:[{url:'http://downloads.test:45678/bongextend-ui-fixture.bin'}],source:75})));
  await page.reload();await page.locator('.loading-overlay').waitFor({state:'hidden'});
  await page.locator('#filterTaskAll').click();
  await page.waitForTimeout(3000);
  await page.waitForTimeout(800);
  const taskCount=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('downloady',2);r.onsuccess=()=>{const db=r.result,q=db.transaction('tasks-v2').objectStore('tasks-v2').count();q.onsuccess=()=>{db.close();resolve(q.result)};};}));
  if(diagnostic)console.log('UI bridge',await page.evaluate(async()=>({name:Ta(We),present:Boolean(globalThis[Ta(We)]),tasks:await wf.eg(4,'missing'),keys:await Promise.all([4,8,13].map(async id=>({id,keys:await(await vf()).a([String(id)])})))})));
  await page.screenshot({path:path.join(folder,'manager-item-light.png')});
  console.log('Actual paused task count:',taskCount,'visible rows:',await page.locator('#dy_tb .slick-row').count());
  if(diagnostic){console.log(JSON.stringify({vendor,filter:await page.locator('#filterTaskAll').getAttribute('filter_str'),geometry:await page.evaluate(()=>['#dy_tb','.slick-viewport','.grid-canvas'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{selector,rect:[r.x,r.y,r.width,r.height],height:s.height,display:s.display}})),errorCount:errors.length,promoCorsCount:errors.filter(e=>e.includes('promo.json')).length,otherErrors:errors.filter(e=>!e.includes('promo.json')&&!e.includes('net::ERR_FAILED'))},null,2));console.log('Evidence:',folder);return;}
  assert.ok((await page.locator('#dy_tb').innerText()).includes('bongextend-ui-fixture'));
  await page.locator('#dy_tb .slick-row').first().click();
  assert.equal(await page.evaluate(async()=>{const tasks=await wf.eg(4,[]);return (await wf.eg(8,[],[tasks[0].id])).length}),1,'live task lookup uses the readonly bridge');
  assert.equal(await page.evaluate(()=>wf.eg(13,-1,'finished')),0,'paused task must not count as complete');
  await page.screenshot({path:path.join(folder,'manager-selected.png')});
  await page.locator('#dy_searchbox_btn').click();
  await page.locator('#dy_searchbox_input').fill('no-matching-fixture');
  await page.locator('#dy_searchbox_input').press('Enter');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#dy_tb .slick-row').count(),0);
  await page.locator('#dy_searchbox_input').fill('');
  await page.locator('#dy_searchbox_input').press('Enter');
  await page.waitForTimeout(400);
  assert.ok(await page.locator('#dy_tb .slick-row').count());
  await page.locator('#dy_searchbox_btn').click();
  await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(400);
  for(const selector of ['#dy_searchbox_btn','#dy_lnav_filter_recycled > .material-icons'])assert.ok(await page.locator(selector).evaluate(e=>Number(getComputedStyle(e).color.match(/\d+/)[0])>150),selector+' dark control contrast');
  await page.screenshot({path:path.join(folder,'manager-item-dark.png')});
  console.log('PASS manager themes and responsive view. Evidence:',folder);
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
