// Screenshot-derived DC login fixture, not a live login/account test. Disposable Chrome only.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-dc-login-dark-')),extension=path.join(folder,'extension');
 fs.cpSync('.output/chrome-mv3',extension,{recursive:true});
 const css='body{margin:0;background:#fff;color:#222;font:16px Arial}header{background:#293875;color:white;text-align:center;padding:26px}main{min-height:500px;display:grid;place-items:center}.login-box{width:520px;padding:40px;background:#fff;border:1px solid #3b4890}.login-input{display:block;box-sizing:border-box;width:100%;padding:15px;margin-bottom:8px;background:#f3f3f3;color:#333;border:0}.login-btn{width:100%;background:#3b4890;color:white;border:0;padding:15px}label{display:block;margin:16px 0;color:#555}.links{color:#333;text-align:center}footer{padding:34px;text-align:center;background:white;color:#555;border-top:1px solid #eee}';
 const workerPath=path.join(extension,'background.js');
 fs.writeFileSync(workerPath,`globalThis.__cssFetches=0;globalThis.__denyCss=true;const nativeFetch=fetch;globalThis.fetch=async(input,init)=>{if(String(input).startsWith('https://nstatic.dcinside.com/')){__cssFetches++;return new Response(__denyCss?'':${JSON.stringify(css)},{status:__denyCss?503:200,headers:{'Content-Type':'text/css'}});}return nativeFetch(input,init);};`+fs.readFileSync(workerPath,'utf8'));
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1300,height:900}});
 try{
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith('https://nstatic.dcinside.com/'))return route.fulfill({status:200,contentType:'text/css',body:css});
   if(url.startsWith('https://sign.dcinside.com/login'))return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://nstatic.dcinside.com/dc/w/css/login.css"><header>dcinside 로그인</header><main><form class="login-box"><input class="login-input" placeholder="식별 코드"><input class="login-input" type="password" placeholder="비밀번호"><button class="login-btn" type="button">로그인</button><label><input type="checkbox"> 식별 코드 저장</label><div class="links">식별 코드 찾기 · 비밀번호 찾기 · 고정닉 신청</div></form></main><footer>회사소개 · 제휴안내 · 개인정보처리방침<br>Copyright © dcinside. All rights reserved.</footer>'});
   return route.abort();
  });
  const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Extensions.loadUnpacked',{path:extension});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.modules':{dark:true,dc:false,gmail:false,trans:false,chzzk:false,fx:false,download:false},'core.darkMode':{enabledSites:['sign.dcinside.com'],followSystem:false}}));
  const page=await context.newPage();await page.goto('https://sign.dcinside.com/login');
  await page.waitForFunction(()=>document.documentElement.dataset.darkreaderScheme==='dark');
  await page.waitForTimeout(600);
  const backgrounds=()=>page.evaluate(()=>Object.fromEntries(['body','.login-box','.login-input','footer'].map(s=>[s,getComputedStyle(document.querySelector(s)).backgroundColor])));
  const isDark=color=>Math.max(...color.match(/\d+/g).slice(0,3).map(Number))<110;
  assert.equal(isDark((await backgrounds())['.login-box']),false,'unreadable external CSS reproduces the white panel');
  await page.screenshot({path:path.join(folder,'css-unavailable.png')});
  await worker.evaluate(()=>{__denyCss=false;});
  await page.reload();
  await page.waitForFunction(()=>['.login-box','.login-input','footer'].every(s=>Math.max(...getComputedStyle(document.querySelector(s)).backgroundColor.match(/\d+/g).slice(0,3).map(Number))<110));
  const dark=await backgrounds();assert.ok(Object.values(dark).every(isDark));
  const textColor=await page.locator('.login-input').first().evaluate(e=>getComputedStyle(e).color);
  assert.ok(Math.min(...textColor.match(/\d+/g).slice(0,3).map(Number))>150);
  await page.screenshot({path:path.join(folder,'dc-login-dark.png')});
  // New security/login notices use the fetched stylesheet too.
  await page.evaluate(()=>{const notice=document.createElement('div');notice.className='login-input';notice.textContent='보안 안내';document.querySelector('.login-box').append(notice);});
  assert.ok(isDark((await backgrounds())['.login-input']));
  assert.ok(await worker.evaluate(()=>__cssFetches)>0);
  await worker.evaluate(()=>chrome.storage.local.set({'core.darkMode':{enabledSites:[],followSystem:false}}));
  await page.waitForFunction(()=>!document.querySelector('.darkreader'));
  assert.equal(isDark((await backgrounds())['.login-box']),false);
  console.log('PASS cross-origin CSS failure reproduced; dark login panel, inputs, footer, readable text, dynamic notice and disable restore');
  console.log('screenshots',folder);
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
