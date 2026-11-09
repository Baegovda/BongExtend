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
  await context.route('https://mail.naver.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic Naver destination</title>'}));
  await page.goto(`chrome-extension://${id}/popup.html`);
  const frame=page.frameLocator('#checkerPlusMailFrame');
  await frame.locator('#bongextendNaverAccount').waitFor();
  await frame.locator('html[data-bong-mail-ready="true"]').waitFor();
  assert.equal(await page.locator('#providerGmail,#providerNaver').count(),0,'provider tabs have been removed');
  assert.equal(await frame.locator('dialog[open]').count(),0,'Naver-only use is not blocked by a Gmail login dialog');
  await frame.locator('#bongextendNaverAccount button').click();await page.locator('#mailSettingsDialog').waitFor();
  await page.locator('#naverMailId').fill('fixture-user@naver.com');await page.locator('#naverMailConnect').click();
  await frame.locator('#naverMailList li').nth(1).waitFor();
  await page.waitForFunction(()=>!document.querySelector('#mailSettingsSave').disabled);
  await page.screenshot({path:path.join(folder,'unified-mail-settings.png'),animations:'disabled'});
  await page.locator('#mailSettingsClose').click();
  assert.equal(await frame.locator('#naverMailList img').count(),0);
  assert.equal(await page.locator('#checkerPlusMailFrame').isVisible(),true);
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('core.naverMailUnread'))['core.naverMailUnread']),2);
  assert.equal(await worker.evaluate(()=>__notifications.length),0,'첫 연결은 과거 메일을 알리지 않는다');
  await worker.evaluate(async()=>{__mailFixture.mailData.unshift({mailSN:125,subject:'새로 도착한 시험 메일',fromName:'발신자 시험'});__mailFixture.totalCount=3;const s=await chrome.storage.local.get('core.naverMail');await chrome.storage.local.set({'core.naverMail':{...s['core.naverMail'],testRefresh:1}});});
  await frame.locator('#naverMailList li').nth(2).waitFor();
  assert.equal(await worker.evaluate(()=>__notifications.length),1);
  await page.waitForFunction(()=>document.querySelector('#mailBadge').textContent==='3');
  const inbox=page.frames().find(f=>f.url().includes('/checkerplus-popup.html'));
  await inbox.evaluate(()=>{
    const account=document.createElement('section');account.className='account';account.id='fixtureGmail';account._account={email:'fixture@gmail.com'};
    account.innerHTML='<div class="accountHeader"><div class="accountTitleArea"><div class="accountTitle">fixture@gmail.com</div><div class="unreadCount">1</div></div></div><div class="mail"><div class="sender">Gmail 시험 발신자</div><div class="subject">Gmail과 네이버가 함께 보이는 시험 메일</div></div>';
    document.getElementById('inbox').append(account);
  });
  await frame.locator('#fixtureGmail').waitFor();
  await frame.locator('#bongextendGmailEmpty').waitFor({state:'hidden'});
  const together=await inbox.evaluate(()=>{const a=document.getElementById('fixtureGmail'),b=document.getElementById('bongextendNaverAccount');return {shared:a.parentElement===b.parentElement,order:Boolean(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING),naverIsGmail:b.matches('.account')};});
  assert.deepEqual(together,{shared:true,order:true,naverIsGmail:false});
  const logo=frame.locator('.be-naver-logo');assert.ok(await logo.evaluate(e=>e.complete&&e.naturalWidth>0));
  const lb=await logo.boundingBox(),email=await frame.locator('.be-naver-title strong').boundingBox();assert.ok(lb.x+lb.width<=email.x);
  assert.equal(await frame.locator('.be-naver-title strong').textContent(),'fixture-user@naver.com');
  await page.screenshot({path:path.join(folder,'unified-mail-light.png'),animations:'disabled'});
  await page.emulateMedia({colorScheme:'dark'});
  await page.screenshot({path:path.join(folder,'naver-mail-dark.png'),animations:'disabled'});
  // A timestamp-only poll must preserve the exact row and its keyboard focus.
  await frame.locator('#naverMailList button').first().focus();
  await inbox.evaluate(()=>{window.__naverFirst=document.querySelector('#naverMailList button');});
  await worker.evaluate(async()=>{const s=await chrome.storage.session.get('naver.mail.state');await chrome.storage.session.set({'naver.mail.state':{...s['naver.mail.state'],checkedAt:Date.now()+1000}});});
  await page.waitForTimeout(100);assert.equal(await inbox.evaluate(()=>document.querySelector('#naverMailList button')===window.__naverFirst&&document.activeElement===window.__naverFirst),true);
  // A Naver message keeps its existing web-mail destination, never a Gmail action.
  await page.evaluate(()=>{window.__naverOpens=[];const create=chrome.tabs.create.bind(chrome.tabs);chrome.tabs.create=async options=>{__naverOpens.push(options);return {id:999,...options};};});
  await frame.locator('#naverMailList button').first().click();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>window.__naverOpens[0]?.url),'https://mail.naver.com/v2/read/0/125');
  await page.reload();await frame.locator('#naverMailList li').nth(2).waitFor();
  await worker.evaluate(()=>chrome.storage.local.set({'core.modules':{gmail:false}}));
  await frame.locator('#naverMailList li').first().waitFor({state:'hidden'});
  await worker.evaluate(()=>chrome.storage.local.set({'core.modules':{gmail:true}}));
  await frame.locator('#naverMailList li').nth(2).waitFor();
  await worker.evaluate(()=>{globalThis.__mailFixture={Result:'FAIL'};});
  await page.locator('#mailSettingsOpen').click();
  await page.locator('#naverMailNotify').uncheck(); // configuration change resets throttling
  await page.waitForFunction(()=>document.querySelector('#naverMailStatus').textContent.includes('로그인한 뒤'));
  await page.locator('#naverMailDisconnect').click();await page.waitForFunction(()=>document.querySelector('#naverMailId').value==='');
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.session.get('naver.mail.state'))['naver.mail.state']),undefined);
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('core.naverMailUnread'))['core.naverMailUnread']),0);
  const requests=await worker.evaluate(()=>globalThis.__mailRequests);assert.ok(requests.length>=2);assert.ok(requests.every(r=>r.url==='https://mail.naver.com/json/list'&&r.body.includes('isUnread=true')));
  // Checker Plus may report missing Google sessions in this deliberately logged-out fixture.
  assert.deepEqual(errors.filter(e=>/naver-mail|naverMail/.test(e)),[]);
  console.log('PASS fixture: connect, unread list, escaped HTML, unified Gmail/Naver accounts, local N logo, common settings, persistence, module off/on, expired login, disconnect and list-only requests;',folder);
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
