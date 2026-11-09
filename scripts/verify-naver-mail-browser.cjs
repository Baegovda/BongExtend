// Disposable Chrome profile and fake Naver mail responses. No real account is accessed.
const {chromium}=require('playwright');const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-naver-mail-')),extension=path.join(folder,'extension');
 fs.cpSync('.output/chrome-mv3',extension,{recursive:true});const mp=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(mp));
 manifest.host_permissions.push('https://mail.naver.com/*');fs.writeFileSync(mp,JSON.stringify(manifest));
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:780,height:590},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  const cdp=await context.browser().newBrowserCDPSession();const {id}=await cdp.send('Extensions.loadUnpacked',{path:extension});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async()=>{
   globalThis.__notifications=[];chrome.notifications.create=async(id,options)=>{__notifications.push({id,options});return id;};const original=fetch;globalThis.__mailRequests=[];globalThis.__mailFixture={mailData:[{mailSN:123,subject:'시험 메일 · 네이버 연결 확인',fromName:'BongExtend 시험',preview:'개인 계정과 무관한 시험 메일이에요.',receivedTime:1794150000},{mailSN:124,subject:'<img src=x onerror=alert(1)>',fromName:'HTML 안전 표시 시험'}],totalCount:2};
   globalThis.fetch=(url,options)=>{if(String(url).startsWith('https://mail.naver.com/')){__mailRequests.push({url:String(url),body:String(options?.body)});return Promise.resolve(new Response(JSON.stringify(__mailFixture),{headers:{'content-type':'application/json'}}));}return original(url,options);};
   await chrome.storage.local.set({'core.update:autoCheck':false,'core.popupTab':'gmail','core.mailProvider':'naver','core.modules':{gmail:true,chzzk:false,trans:false,dc:false,dark:false,fx:false,download:false}});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`chrome-extension://${id}/popup.html`);await page.locator('#naverMailPanel').waitFor();
  await page.locator('#naverMailId').fill('fixture-user@naver.com');await page.locator('#naverMailConnect').click();
  await page.waitForFunction(()=>document.querySelectorAll('#naverMailList li').length===2);
  assert.equal(await page.locator('#naverMailList img').count(),0);
  assert.equal(await page.locator('#checkerPlusMailFrame').isVisible(),false);
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('core.naverMailUnread'))['core.naverMailUnread']),2);
  assert.equal(await worker.evaluate(()=>__notifications.length),0,'첫 연결은 과거 메일을 알리지 않는다');
  await worker.evaluate(async()=>{__mailFixture.mailData.unshift({mailSN:125,subject:'새로 도착한 시험 메일',fromName:'발신자 시험'});__mailFixture.totalCount=3;const s=await chrome.storage.local.get('core.naverMail');await chrome.storage.local.set({'core.naverMail':{...s['core.naverMail'],testRefresh:1}});});
  await page.waitForFunction(()=>document.querySelectorAll('#naverMailList li').length===3);
  assert.equal(await worker.evaluate(()=>__notifications.length),1);
  await page.waitForFunction(()=>document.querySelector('#mailBadge').textContent==='3');
  await page.screenshot({path:path.join(folder,'naver-mail-light.png')});
  await page.emulateMedia({colorScheme:'dark'});
  await page.screenshot({path:path.join(folder,'naver-mail-dark.png')});
  await page.locator('#providerGmail').click();assert.equal(await page.locator('#naverMailPanel').isVisible(),false);
  await page.locator('#providerNaver').click();assert.equal(await page.locator('#naverMailPanel').isVisible(),true);
  await page.reload();await page.locator('#naverMailPanel').waitFor();
  await worker.evaluate(()=>chrome.storage.local.set({'core.modules':{gmail:false}}));
  await page.waitForFunction(()=>document.querySelectorAll('#naverMailList li').length===0);
  await worker.evaluate(()=>chrome.storage.local.set({'core.modules':{gmail:true}}));
  await page.waitForFunction(()=>document.querySelectorAll('#naverMailList li').length===3);
  await worker.evaluate(()=>{globalThis.__mailFixture={Result:'FAIL'};});
  await page.locator('#naverMailNotify').uncheck(); // configuration change resets throttling
  await page.waitForFunction(()=>document.querySelector('#naverMailStatus').textContent.includes('로그인한 뒤'));
  await page.locator('#naverMailDisconnect').click();await page.waitForFunction(()=>document.querySelector('#naverMailId').value==='');
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.session.get('naver.mail.state'))['naver.mail.state']),undefined);
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('core.naverMailUnread'))['core.naverMailUnread']),0);
  const requests=await worker.evaluate(()=>globalThis.__mailRequests);assert.ok(requests.length>=2);assert.ok(requests.every(r=>r.url==='https://mail.naver.com/json/list'&&r.body.includes('isUnread=true')));
  // Checker Plus may report missing Google sessions in this deliberately logged-out fixture.
  assert.deepEqual(errors.filter(e=>/naver-mail|naverMail/.test(e)),[]);
  console.log('PASS fixture: connect, unread list, escaped HTML, Gmail/provider switching, persistence, module off/on, expired login, disconnect and list-only requests;',folder);
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
