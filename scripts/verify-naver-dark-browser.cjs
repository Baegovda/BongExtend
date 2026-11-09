// Disposable Chrome profile; public Naver homepage only. No personal browser/account access.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-naver-dark-'));
 const extension=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',extension,{recursive:true});
 const manifestPath=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
 manifest.host_permissions.push('https://*.naver.com/*','https://*.pstatic.net/*');fs.writeFileSync(manifestPath,JSON.stringify(manifest));
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:1500,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Extensions.loadUnpacked',{path:extension});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.darkMode':{enabledSites:['naver.com'],followSystem:false}}));
  const page=await context.newPage();
  await page.goto('https://www.naver.com/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(6000);
  const waitDark=async()=>page.waitForFunction(()=>['body','#account'].every(s=>{const e=document.querySelector(s);return e&&Number(getComputedStyle(e).backgroundColor.match(/\d+/)[0])<100;}),null,{timeout:20000});
  await waitDark();
  const bodyColor=()=>page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);
  const dark=await bodyColor();
  await worker.evaluate(()=>chrome.storage.local.set({'core.darkMode':{enabledSites:[],followSystem:false}}));
  await page.waitForFunction(()=>!document.querySelector('.darkreader'));
  assert.notEqual(await bodyColor(),dark);
  await worker.evaluate(()=>chrome.storage.local.set({'core.darkMode':{enabledSites:['naver.com'],followSystem:false}}));
  await waitDark();await page.reload({waitUntil:'domcontentloaded'});await waitDark();
  // A different module may answer general messages immediately; the CSS port must still work.
  await worker.evaluate(()=>chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m?.type==='dark-fetch-naver-css')reply();}));
  await page.reload({waitUntil:'domcontentloaded'});await waitDark();
  const denied=await worker.evaluate(async url=>{const tab=(await chrome.tabs.query({url}))[0];return chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>new Promise(resolve=>{const port=chrome.runtime.connect({name:'bongextend-dark-css'});port.onMessage.addListener(result=>{port.disconnect();resolve(result.ok)});port.postMessage({url:'https://example.com/private.css'});})});},page.url());
  assert.equal(denied[0].result,false);
  console.log('PASS public Naver: live external CSS, dark body/account, disable/enable, reload, unrelated response isolation, disallowed URL rejection. No logged-in account tested.');
  await page.screenshot({path:path.join(folder,'naver-dark.png')});console.log('Evidence:',folder);
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
