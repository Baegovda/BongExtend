// Synthetic account headers only. The parent protocol adapter is a fixture, not a Gmail login.
const {chromium}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-mail-drag-'));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:600,height:500}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<!doctype html><html class="bongextend-checkerplus-embedded"><body><div id="inbox" style="height:460px;overflow:auto"></div></body></html>');
  await page.addStyleTag({path:'src/modules/theme/theme.css'});await page.addStyleTag({path:'public/checkerplus-embed.css'});
  await page.evaluate(()=>{
   window.actions=0;window.requests=[];window.saved=[];const inbox=document.getElementById('inbox');
   for(let i=0;i<7;i++){
    const row=document.createElement('section'),naver=i===2;row.id='account-'+i;row.className=naver?'be-naver-account':'account hasMail';row.setAttribute('email',`fixture${i}@gmail.test`);row._account={id:i,email:`fixture${i}@gmail.test`};if(naver)row.dataset.accountKey='naver:fixture@naver.com';
    row.innerHTML=`<header class="${naver?'be-naver-header':'accountHeader'}"><div class="${naver?'be-naver-title':'accountTitleArea'}"><strong class="accountTitle">시험 계정 ${i}</strong></div><span class="unreadCount">2</span><span class="be-account-order"><button>↑</button><button>↓</button></span></header><div class="${naver?'be-naver-list':'mails'}" style="height:65px">합성 메일 본문 · 선택 가능한 글</div>`;
    row.querySelector('header').addEventListener('mouseup',()=>window.actions++);
    row.querySelectorAll('.be-account-order button').forEach((button,index)=>button.addEventListener('click',()=>{const other=index?row.nextElementSibling:row.previousElementSibling;if(other)inbox.insertBefore(index?other:row,index?row:other);}));
    inbox.append(row);
   }
   const key=row=>row.dataset.accountKey||'gmail:'+row.getAttribute('email');
   document.addEventListener('bongextend-mail-account-move',event=>{window.requests.push(event.detail);if(window.rejectMove)return;const rows=[...inbox.children],source=rows.find(row=>key(row)===event.detail.sourceKey),target=rows.find(row=>key(row)===event.detail.targetKey);if(!source||!target)return;inbox.insertBefore(source,event.detail.placement==='before'?target:target.nextSibling);window.saved=[...inbox.children].map(key);event.preventDefault();});
  });
  await page.addScriptTag({path:'public/js/bongextend-mail-ui.js'});await page.locator('.be-account-grip').nth(6).waitFor();
  const drag=async(source,target,cancel)=>{const a=await page.locator(`#${source} .be-account-grip`).boundingBox(),b=await page.locator(`#${target} header`).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+20,b.y+4,{steps:5});await page.waitForFunction(()=>document.querySelector('.be-drop-before,.be-drop-after'));if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(380);};
  await drag('account-2','account-0');
  assert.deepEqual(await page.evaluate(()=>requests[0]),{sourceKey:'naver:fixture@naver.com',targetKey:'gmail:fixture0@gmail.test',placement:'before'});
  assert.equal(await page.locator('#inbox > section').first().getAttribute('id'),'account-2');
  assert.equal(await page.evaluate(()=>document.getElementById('account-0')._account.id),0);
  await drag('account-1','account-2',true);assert.equal(await page.evaluate(()=>requests.length),1);
  await page.evaluate(()=>window.rejectMove=true);await drag('account-1','account-2');assert.equal(await page.locator('#inbox > section').first().getAttribute('id'),'account-2');
  await page.evaluate(()=>window.rejectMove=false);
  await page.locator('#account-0 .be-account-grip').press('ArrowUp');assert.equal(await page.locator('#inbox > section').first().getAttribute('id'),'account-0');
  const grip=await page.locator('#account-0 .be-account-grip').boundingBox();await page.mouse.move(grip.x+8,grip.y+8);await page.mouse.down();await page.mouse.move(590,490,{steps:5});await page.mouse.up();assert.equal(await page.evaluate(()=>requests.length),2,'outside inbox does not submit');
  const cancelGrip=await page.locator('#account-0 .be-account-grip').boundingBox();await page.mouse.move(cancelGrip.x+8,cancelGrip.y+8);await page.mouse.down();
  await page.locator('#account-0 .be-account-grip').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
  assert.equal(await page.evaluate(()=>actions),0,'grip never opens mail or account');
  assert.equal(await page.locator('.be-account-drag-active,.be-drop-before,.be-drop-after').count(),0);
  const auto=await page.locator('#account-0 .be-account-grip').boundingBox(),bounds=await page.locator('#inbox').boundingBox();
  await page.mouse.move(auto.x+8,auto.y+8);await page.mouse.down();await page.mouse.move(bounds.x+30,bounds.y+bounds.height-6,{steps:5});
  await page.waitForFunction(()=>document.getElementById('inbox').scrollTop>0);await page.screenshot({path:path.join(folder,'drag-scroll.png')});await page.keyboard.press('Escape');await page.mouse.up();
  await page.evaluate(()=>document.getElementById('inbox').scrollTop=0);
  // Live follow + slide, and downward drag of the Naver row (the protocol must say placement 'after').
  await page.evaluate(()=>{document.getElementById('inbox').scrollTop=0;});await page.waitForTimeout(300);
  const order=await page.evaluate(()=>[...document.querySelectorAll('#inbox > section')].map(row=>row.id));
  const naverAt=order.indexOf('account-2'),targetId=order[naverAt+2];
  const grabbed=await page.locator('#account-2 .be-account-grip').boundingBox(),targetHeader=await page.locator(`#${targetId} header`).boundingBox();
  const beforeTop=(await page.locator('#account-2').boundingBox()).y;
  await page.mouse.move(grabbed.x+grabbed.width/2,grabbed.y+grabbed.height/2);await page.mouse.down();
  await page.mouse.move(grabbed.x+grabbed.width/2,grabbed.y+grabbed.height/2+60,{steps:6});
  const midway=await page.evaluate(()=>({moving:getComputedStyle(document.getElementById('account-2')).transform,others:[...document.querySelectorAll('#inbox > section')].filter(row=>row.id!=='account-2'&&row.style.transform).length}));
  const midTop=(await page.locator('#account-2').boundingBox()).y;
  assert.ok(midTop-beforeTop>=50,`the grabbed row follows the pointer live (${beforeTop} -> ${midTop})`);
  assert.notEqual(midway.moving,'none');
  await page.mouse.move(grabbed.x+20,targetHeader.y+targetHeader.height-2,{steps:8});
  await page.waitForFunction(()=>document.querySelector('.be-drop-after'));
  const shifted=await page.evaluate(()=>[...document.querySelectorAll('#inbox > section')].filter(row=>row.id!=='account-2'&&row.style.transform&&row.style.transition).length);
  assert.ok(shifted>=2,'rows between slide out of the way with a transition');
  await page.screenshot({path:path.join(folder,'drag-midway.png')});
  await page.mouse.up();await page.waitForTimeout(400);
  const moved=await page.evaluate(()=>requests.at(-1));
  assert.equal(moved.sourceKey,'naver:fixture@naver.com');assert.equal(moved.targetKey,'gmail:'+(await page.evaluate(id=>document.getElementById(id).getAttribute('email'),targetId)));assert.equal(moved.placement,'after');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#inbox > section')].some(row=>row.style.transform||row.style.transition)),false,'no inline motion styles left behind');
  for(const scheme of ['light','dark']){await page.emulateMedia({colorScheme:scheme});await page.screenshot({path:path.join(folder,scheme+'.png')});}
  assert.deepEqual(errors,[]);console.log('PASS pointer reorder/protocol, native ID, Escape, rejected/outside drop, keyboard, cancel, no mail actions;',folder);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
