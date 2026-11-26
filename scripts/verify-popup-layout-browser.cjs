// 실제 크롬(시험용 임시 프로필)에서 세 가지를 확인해요.
// 1) 왼쪽 탭 목록과 내용 사이를 끌면 탭 목록 폭이 바뀌고 저장돼요(아주 좁히면 아이콘만).
// 2) 메일 탭 왼쪽 계정 아이콘을 끌어 놓으면 계정 순서가 바뀌어요.
// 3) 받는 중인 다운로드의 가장 높은 진행률이 도구막대 제목에 나와요(원형 게이지도 이 값으로 차요).
// 실행: node scripts/verify-popup-layout-browser.cjs  (HEADFUL=1 이면 창을 보여요)
const {chromium}=require('playwright');const path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const ext=path.resolve('.output/chrome-mv3');
 // 천천히 보내는 시험 파일: 4MB 중 앞 1MB만 보내고 멈춰요(진행률 25%).
 const sockets=new Set();
 const server=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'application/octet-stream','content-length':String(4*1048576),'content-disposition':'attachment; filename="slow.bin"'});r.write(Buffer.alloc(1048576));}).listen(0,'127.0.0.1');
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 const browser=await chromium.launch({channel:'chrome',headless:!process.env.HEADFUL,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--window-position=0,0','--window-size=1000,700']});
 try{
  const cdp=await browser.newBrowserCDPSession();
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve('D:/BuildTemp/BongExtend/layout-dl')});
  const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});
  let seq=0;const pending=new Map();
  cdp.on('Target.receivedMessageFromTarget',e=>{const m=JSON.parse(e.message);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
  const targetOf=async(match)=>{for(let i=0;i<60;i++){const {targetInfos}=await cdp.send('Target.getTargets');const t=targetInfos.find(match);if(t)return t;await wait(250);}return null;};
  const attach=async(t)=>(await cdp.send('Target.attachToTarget',{targetId:t.targetId,flatten:false})).sessionId;
  const call=async(sessionId,method,params)=>{const mid=++seq;const done=new Promise(r=>pending.set(mid,r));await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:mid,method,params})});const m=await done;if(m.error)throw new Error(JSON.stringify(m.error));if(m.result?.exceptionDetails)throw new Error(JSON.stringify(m.result.exceptionDetails).slice(0,500));return m.result;};
  const evalIn=async(sessionId,expr)=>(await call(sessionId,'Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true})).result?.value;
  const sw=await targetOf(t=>t.type==='service_worker'&&t.url.includes(id));assert.ok(sw,'extension worker');
  const swS=await attach(sw);await wait(2000);
  await evalIn(swS,`chrome.windows.create({url:chrome.runtime.getURL('popup.html?tab=gmail'),focused:true,type:'normal',width:900,height:640}).then(()=>1)`);
  const page=await targetOf(t=>t.type==='page'&&t.url.includes('/popup.html'));const pS=await attach(page);await wait(2500);
  const mouse=async(type,x,y)=>call(pS,'Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,pointerType:'mouse'});
  const drag=async(x1,y1,x2,y2)=>{await call(pS,'Input.dispatchMouseEvent',{type:'mouseMoved',x:x1,y:y1,button:'none',buttons:0});await mouse('mousePressed',x1,y1);for(let i=1;i<=8;i++)await call(pS,'Input.dispatchMouseEvent',{type:'mouseMoved',x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8,button:'left',buttons:1});await mouse('mouseReleased',x2,y2);};

  // 1) 탭 목록 폭
  const box=await evalIn(pS,`(()=>{const h=document.querySelector('.side-resizer');const r=h?.getBoundingClientRect();return h?{x:r.left+r.width/2,y:r.top+200,side:document.querySelector('.tabs').getBoundingClientRect().width}:null})()`);
  console.log('resizer',JSON.stringify(box));assert.ok(box,'resize handle exists');
  await drag(box.x,box.y,box.x+80,box.y);await wait(300);
  const wider=await evalIn(pS,`(async()=>({side:document.querySelector('.tabs').getBoundingClientRect().width,saved:(await chrome.storage.local.get('core.popupSideWidth'))['core.popupSideWidth']}))()`);
  console.log('wider',JSON.stringify(wider));assert.ok(wider.side>box.side+60,'sidebar got wider');assert.ok(wider.saved>box.side+60,'width saved');
  const at=await evalIn(pS,`document.querySelector('.side-resizer').getBoundingClientRect().left+4`);
  await drag(at,box.y,40,box.y);await wait(300);
  const narrow=await evalIn(pS,`({side:document.querySelector('.tabs').getBoundingClientRect().width,compact:document.body.classList.contains('side-compact'),label:getComputedStyle(document.querySelector('.nav-label')).display})`);
  console.log('narrow',JSON.stringify(narrow));assert.ok(narrow.side<=70,'sidebar narrows to icons');assert.equal(narrow.compact,true);assert.equal(narrow.label,'none');
  console.log('tools',JSON.stringify(await evalIn(pS,`(()=>{const w=document.querySelector('.window-tools');const cs=getComputedStyle(w);return {dir:cs.flexDirection,wrap:cs.flexWrap,w:w.getBoundingClientRect().width,btn:[...w.querySelectorAll('button')].filter(b=>b.offsetParent).slice(0,1).map(b=>{const c=getComputedStyle(b);return [b.className,c.width,c.height,c.minWidth,c.maxWidth,c.flex,c.boxSizing,c.padding,c.display]})}})()`)));if(process.env.SHOT){const s=await call(pS,'Page.captureScreenshot',{});require('node:fs').writeFileSync(process.env.SHOT.replace(/\.png$/,'-narrow.png'),Buffer.from(s.data,'base64'));}
  const at2=await evalIn(pS,`document.querySelector('.side-resizer').getBoundingClientRect().left+4`);
  await call(pS,'Input.dispatchMouseEvent',{type:'mousePressed',x:at2,y:box.y,button:'left',buttons:1,clickCount:2});await call(pS,'Input.dispatchMouseEvent',{type:'mouseReleased',x:at2,y:box.y,button:'left',buttons:0,clickCount:2});await wait(300);
  const reset=await evalIn(pS,`(async()=>({side:Math.round(document.querySelector('.tabs').getBoundingClientRect().width),saved:(await chrome.storage.local.get('core.popupSideWidth'))['core.popupSideWidth']}))()`);
  console.log('double click',JSON.stringify(reset));assert.equal(reset.saved,176);

  // 2) 메일 계정 아이콘 끌기: 시험용 계정 줄과 아이콘을 메일 화면에 넣어요(시험 프로필엔 Gmail 계정이 없어요).
  const setup=await evalIn(pS,`(async()=>{const f=document.getElementById('checkerPlusMailFrame');for(let i=0;i<40&&!f.contentDocument?.getElementById('inbox');i++)await new Promise(r=>setTimeout(r,250));const d=f.contentDocument;const inbox=d.getElementById('inbox'),rail=d.getElementById('accountAvatars');rail.classList.add('visible');
   for(const e of ['a@x.test','b@x.test','c@x.test']){const row=d.createElement('div');row.className='account';row.setAttribute('email',e);row.innerHTML='<div class="accountHeader"><span class="accountTitle">'+e+'</span></div>';inbox.append(row);
    const av=d.createElement('div');av.className='accountAvatar';av._account={email:e};av.style.cssText='width:32px;height:32px;border-radius:50%;background:#888';av.title=e;av.addEventListener('click',()=>{d.body.dataset.clicked=e;});rail.append(av);}
   await new Promise(r=>setTimeout(r,500));
   const fr=f.getBoundingClientRect();return {fx:fr.left,fy:fr.top,avatars:[...rail.querySelectorAll('.accountAvatar')].map(a=>{const r=a.getBoundingClientRect();return {e:a._account.email,x:r.left+r.width/2,y:r.top+r.height/2}})};})()`);
  console.log('avatars',JSON.stringify(setup));
  const [a,,c]=setup.avatars;
  await drag(setup.fx+a.x,setup.fy+a.y,setup.fx+c.x,setup.fy+c.y+12);await wait(600);
  const after=await evalIn(pS,`(async()=>{const d=document.getElementById('checkerPlusMailFrame').contentDocument;return {rail:[...d.querySelectorAll('#accountAvatars .accountAvatar')].map(a=>a._account.email),inbox:[...d.querySelectorAll('#inbox > .account')].map(r=>r.getAttribute('email')),saved:(await chrome.storage.local.get('core.mailAccountOrder'))['core.mailAccountOrder'],clicked:d.body.dataset.clicked||''}})()`);
  console.log('after avatar drag',JSON.stringify(after));
  assert.deepEqual(after.inbox,['b@x.test','c@x.test','a@x.test'],'mail list follows the dragged icon');
  assert.deepEqual(after.rail,['b@x.test','c@x.test','a@x.test'],'icon strip follows the same order');
  assert.deepEqual(after.saved.filter(k=>k.startsWith('gmail:')),['gmail:b@x.test','gmail:c@x.test','gmail:a@x.test']);
  assert.equal(after.clicked,'','dropping is not a click');
  const b2=await evalIn(pS,`(()=>{const d=document.getElementById('checkerPlusMailFrame').contentDocument;const r=d.querySelector('#accountAvatars .accountAvatar').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await mouse('mousePressed',setup.fx+b2.x,setup.fy+b2.y);await mouse('mouseReleased',setup.fx+b2.x,setup.fy+b2.y);await wait(300);
  const clicked=await evalIn(pS,`document.getElementById('checkerPlusMailFrame').contentDocument.body.dataset.clicked||''`);
  console.log('plain click',clicked);assert.equal(clicked,'b@x.test','a plain click still jumps to the account');
  if(process.env.SHOT){const s=await call(pS,'Page.captureScreenshot',{});require('node:fs').writeFileSync(process.env.SHOT,Buffer.from(s.data,'base64'));}

  // 3) 도구막대 진행률
  await evalIn(swS,`chrome.downloads.download({url:'http://127.0.0.1:${server.address().port}/slow'}).then(()=>1)`);
  let title='';for(let i=0;i<30&&!/ 25%/.test(title);i++){await wait(500);title=await evalIn(swS,`chrome.action.getTitle({})`);}
  console.log('toolbar title',title);assert.match(title,/가장 많이 받은 것 25%/);
  await evalIn(swS,`chrome.downloads.search({state:'in_progress'}).then(a=>Promise.all(a.map(d=>chrome.downloads.cancel(d.id)))).then(()=>1)`);
  console.log('ok');
 }finally{for(const s of sockets)s.destroy();await browser.close().catch(()=>{});server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
