// Disposable Chrome, synthetic mail objects; never marks a real mailbox message.
const {chromium}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-otp-paste-')),extension=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',extension,{recursive:true});
 const mp=path.join(extension,'manifest.json'),m=JSON.parse(fs.readFileSync(mp));m.host_permissions.push('https://*.bongextend.example.com/*');fs.writeFileSync(mp,JSON.stringify(m));
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1000,height:700}});context.setDefaultTimeout(12000);
 try{
  await(await context.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:extension});const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.mailOtpEnabled':true,'core.mailOtpSeen':[],'core.modules':{gmail:true,chzzk:false,trans:false,dc:false,dark:false}}));
  await context.route('https://otp.bongextend.example.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><style>body{font:18px Arial;padding:40px}input{font:28px monospace;padding:14px}h1{font-size:24px}</style><h1>인증번호 붙여넣기 확인</h1><input id="code" autocomplete="one-time-code"><input id="blocked"><script>document.querySelector("#blocked").addEventListener("paste",e=>e.preventDefault())</script>'}));
  const page=await context.newPage();await page.goto('https://otp.bongextend.example.com/');await page.bringToFront();
  const copy=async(id,code)=>worker.evaluate(async({id,code})=>{
   globalThis.__otpMarks??=[];const mail={id,title:`Your verification code ${code}`,issued:new Date().toISOString(),account:{id:990,getEmail:()=> 'fixture@example.invalid'},getThread:async function(){return this},getLastMessageText:async()=>`Verification code: ${code}`,markAsRead:async()=>{__otpMarks.push(id)}};
   const result=await globalThis.BongExtendHandleOtpMails([mail]);return result;
  },{id,code});
  const marks=()=>worker.evaluate(()=>globalThis.__otpMarks||[]);
  const paste=async(selector='#code')=>{await page.locator(selector).focus();await page.keyboard.press('Control+A');await page.keyboard.press('Control+V');};
  await copy('first','123456');assert.deepEqual(await marks(),[],'copy alone leaves unread');
  await page.locator('#code').evaluate(el=>el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:new DataTransfer()})));assert.deepEqual(await marks(),[],'synthetic paste ignored');
  await paste();await page.waitForFunction(()=>document.querySelector('#code').value==='123456');
  await worker.evaluate(async()=>{for(let i=0;i<100;i++){if(__otpMarks.length===1)return;await new Promise(r=>setTimeout(r,20))}throw Error('paste did not mark source')});assert.deepEqual(await marks(),['first']);await paste();assert.deepEqual(await marks(),['first'],'once only');
  await copy('second','654321');await paste('#blocked');assert.deepEqual(await marks(),['first'],'prevented paste stays unread');
  // Change clipboard through a fixture page with explicit disposable clipboard permission.
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:'https://otp.bongextend.example.com'});await page.evaluate(()=>navigator.clipboard.writeText('999999'));await paste();assert.deepEqual(await marks(),['first'],'different code stays unread');
  await page.evaluate(()=>navigator.clipboard.writeText('654321'));await paste();await worker.evaluate(async()=>{for(let i=0;i<100;i++){if(__otpMarks.length===2)return;await new Promise(r=>setTimeout(r,20))}throw Error('matching paste missing')});assert.deepEqual(await marks(),['first','second']);
  await copy('third','778899');await worker.evaluate(()=>chrome.storage.local.set({'core.mailOtpEnabled':false}));await paste();assert.deepEqual(await marks(),['first','second'],'disabled OTP cannot mark mail');
  await page.screenshot({path:path.join(folder,'paste.png')});console.log('PASS real clipboard/native paste -> original synthetic mail, copy-only/synthetic/prevented/wrong/duplicate/OFF:',folder);
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
