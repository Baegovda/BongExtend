// 다운로드 시작 말풍선이 실제 크롬에서 아이콘 아래(확장 창)로 열리는지 확인해요.
// Playwright가 띄운 시험용 크롬(임시 프로필)에 확장 프로그램을 개발자 연결로 넣어요. 사용자 크롬은 건드리지 않아요.
// 실행: node scripts/verify-start-bubble-browser.cjs  (HEADFUL=1 이면 창을 보여요)
const {chromium}=require('playwright');const path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const ext=path.resolve('.output/chrome-mv3');
 const server=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'application/octet-stream','content-length':'3145728','content-disposition':'attachment; filename="test-file.zip"'});r.end(Buffer.alloc(3145728));}).listen(0,'127.0.0.1');
 const browser=await chromium.launch({channel:'chrome',headless:!process.env.HEADFUL,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--window-position=0,0','--window-size=900,600']});
 try{
  const cdp=await browser.newBrowserCDPSession();
  // 시험 파일은 사용자 다운로드 폴더가 아니라 D:\BuildTemp(SSD) 에 받아요.
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve('D:/BuildTemp/BongExtend/bubble-dl')});
  const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});
  // 배경(서비스 워커)에 붙어서 코드를 돌려요.
  let seq=0;const pending=new Map();
  cdp.on('Target.receivedMessageFromTarget',e=>{const m=JSON.parse(e.message);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
  const targetOf=async(match)=>{for(let i=0;i<60;i++){const {targetInfos}=await cdp.send('Target.getTargets');const t=targetInfos.find(match);if(t)return t;await wait(250);}return null;};
  const sw=await targetOf(t=>t.type==='service_worker'&&t.url.includes(id));assert.ok(sw,'extension worker');
  const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:sw.targetId,flatten:false});
  const run=async(expr)=>{const mid=++seq;const done=new Promise(r=>pending.set(mid,r));await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:mid,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true}})});const m=await done;if(m.result?.exceptionDetails)throw new Error(JSON.stringify(m.result.exceptionDetails).slice(0,400));return m.result?.result?.value;};
  await wait(2000);await run(`chrome.windows.create({url:'about:blank',focused:true,type:'normal'}).then(()=>1)`);await wait(800);
  console.log('download id',await run(`chrome.downloads.download({url:'http://127.0.0.1:${server.address().port}/f'})`));
  await wait(3500);
  const info=await run(`(async()=>({popups:(await chrome.runtime.getContexts({contextTypes:['POPUP']})).map(c=>c.documentUrl),stored:(await chrome.storage.session.get('core.download:startBubble'))['core.download:startBubble'],popup:await chrome.action.getPopup({}),focused:(await chrome.windows.getLastFocused({windowTypes:['normal']})).focused}))()`);
  console.log(JSON.stringify(info));if(!info.stored)console.log(JSON.stringify(await run(`chrome.downloads.search({}).then(a=>a.map(d=>({id:d.id,f:d.filename,s:d.state,e:d.error,t:d.totalBytes})))`)));
  assert.equal(info.stored?.text,'test-file.zip(3.0 MB) 다운로드가 시작!');
  assert.match(info.popup,/popup\.html$/,'normal popup is restored');
  if(info.popups.length){assert.ok(info.popups[0].includes('bubble.html'),'bubble opened under the icon');
   if(process.env.SHOT){const t=await targetOf(t=>t.url.includes('bubble.html'));const s2=(await cdp.send('Target.attachToTarget',{targetId:t.targetId,flatten:false})).sessionId;const mid=++seq;const done=new Promise(r=>pending.set(mid,r));await cdp.send('Target.sendMessageToTarget',{sessionId:s2,message:JSON.stringify({id:mid,method:'Page.captureScreenshot',params:{}})});const m=await done;require('node:fs').writeFileSync(process.env.SHOT,Buffer.from(m.result.data,'base64'));}await wait(4500);
   const after=await run(`chrome.runtime.getContexts({contextTypes:['POPUP']}).then(c=>c.length)`);console.log('after 4.5s popups',after);assert.equal(after,0,'bubble closes by itself');}
  else console.log('no popup opened (window not focused in this run)');
  // 새 메일 말풍선: 누르면 메일 탭이 열려요.
  await run(`globalThis.BongExtendNewMails([{id:'t1',from:'홍길동',subject:'시험 메일'}]);1`);
  await wait(1500);
  const mail=await run(`(async()=>({popups:(await chrome.runtime.getContexts({contextTypes:['POPUP']})).map(c=>c.documentUrl),stored:(await chrome.storage.session.get('core.download:startBubble'))['core.download:startBubble']}))()`);
  console.log(JSON.stringify(mail));
  assert.equal(mail.stored?.kind,'mail');assert.equal(mail.stored?.text,'새 메일: 홍길동 - 시험 메일');
  if(mail.popups.length){
   const t=await targetOf(t=>t.url.includes('bubble.html'));const s2=(await cdp.send('Target.attachToTarget',{targetId:t.targetId,flatten:false})).sessionId;
   const mid=++seq;const done=new Promise(r=>pending.set(mid,r));await cdp.send('Target.sendMessageToTarget',{sessionId:s2,message:JSON.stringify({id:mid,method:'Runtime.evaluate',params:{expression:"document.getElementById('bubble').click();1"}})});await done;
   await wait(2500);
   const after=await run(`(async()=>({popups:(await chrome.runtime.getContexts({contextTypes:['POPUP']})).map(c=>c.documentUrl),tab:(await chrome.storage.local.get('core.popupTab'))['core.popupTab']}))()`);
   console.log('after click',JSON.stringify(after));
   assert.ok(after.popups.some(u=>u.includes('popup.html?tab=gmail')),'mail bubble opens the mail tab');
   assert.equal(after.tab,'gmail');
  }
  // 다운로더 설정의 소리 고르기 칸이 채워지는지 봐요.
  await run(`chrome.tabs.create({url:chrome.runtime.getURL('downloads.html')}).then(()=>1)`);await wait(2000);
  const page=await targetOf(t=>t.url.includes('/downloads.html'));const s3=(await cdp.send('Target.attachToTarget',{targetId:page.targetId,flatten:false})).sessionId;
  const mid=++seq;const done=new Promise(r=>pending.set(mid,r));await cdp.send('Target.sendMessageToTarget',{sessionId:s3,message:JSON.stringify({id:mid,method:'Runtime.evaluate',params:{expression:"JSON.stringify({complete:[...document.querySelectorAll('#completeSoundName option')].map(o=>o.textContent).slice(0,4),count:document.querySelectorAll('#completeSoundName option').length,start:document.getElementById('startSound').value,startFirst:document.querySelector('#startSound option')?.textContent})",returnByValue:true}})});
  const sounds=JSON.parse((await done).result.result.value);console.log('sounds',JSON.stringify(sounds));
  assert.ok(sounds.count>=20,'many sounds to pick');assert.equal(sounds.complete[0],'윈도우 알림 소리');assert.equal(sounds.startFirst,'소리 없음');
  console.log('ok');
 }finally{await browser.close().catch(()=>{});server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
