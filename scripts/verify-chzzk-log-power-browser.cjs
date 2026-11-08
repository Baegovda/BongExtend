// Disposable headless Chrome + synthetic Chzzk page. Never uses the user's profile or real rewards.
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'be-log-power-'));
  const context = await chromium.launchPersistentContext(path.join(folder, 'profile'), {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,
    viewport:{width:780,height:590}, ignoreDefaultArgs:['--disable-extensions'],
    args:['--enable-unsafe-extension-debugging']
  });
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const {id} = await cdp.send('Extensions.loadUnpacked', {path:path.resolve('.output/chrome-mv3')});
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(async () => {
      await chrome.storage.local.set({'core.update:autoCheck':false, 'core.modules':{chzzk:true,trans:false,dc:false,gmail:false,fx:false,dark:false,download:false}});
      await chrome.storage.sync.set(Object.fromEntries(['enabled','followRefresh','watchEnabled','lockQuality','autoWide','autoPlay','adBlock','adSkip','vivid','viewerChat','viewerOverlay'].map(key => ['chzzk.'+key,false])));
      for (let i=0;i<100;i++) {
        const scripts = await chrome.scripting.getRegisteredContentScripts({ids:['bongextend-chzzk']});
        if (scripts[0]?.js.includes('chzzk/content-log-power.js')) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw Error('Log power content script was not registered');
    });
    const markup = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>통나무 보상 시험</title>
      <style>body{background:#111;color:#eee;font:14px system-ui}aside{width:340px;padding:20px}button{background:#111;color:#00efa9;border:1px solid #00bd86;border-radius:5px;padding:8px}</style>
      <button id="outside">통나무 파워 100 받기</button><aside id="aside-chatting"><div role="log"><button id="message">통나무 파워 100 받기</button></div>
      <button id="donation">후원하기</button><div id="slot"></div></aside>
      <script>window.clicks=[];document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;clicks.push(b.id);if(b.id==='reward')b.hidden=true;});</script></html>`;
    await context.route('https://chzzk.naver.com/**', route => route.fulfill({contentType:'text/html',body:markup}));
    await context.route('https://api.chzzk.naver.com/**', route => route.fulfill({contentType:'application/json',body:'{"code":200,"content":{}}'}));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://chzzk.naver.com/live/'+'a'.repeat(32));
    async function show(attributes = '', text = '1시간 시청 통나무 파워 배달 완료! <span>100 받기</span>') {
      await page.evaluate(({attributes,text}) => {document.querySelector('#slot').innerHTML = '<button id="reward" class="live_chatting_power_button__hash" '+attributes+'>'+text+'</button>';}, {attributes,text});
    }
    const count = () => page.evaluate(() => window.clicks.filter(id => id==='reward').length);
    async function waitCount(expected) {
      await page.waitForFunction(expected => window.clicks.filter(id=>id==='reward').length === expected, expected, {timeout:22000});
    }
    await show(); await waitCount(1);
    // The actual registered content script runs in the isolated world. Advance only its clock for cooldown tests.
    const tabId = await worker.evaluate(async url => (await chrome.tabs.query({url}))[0].id, page.url());
    const nextReward = async () => {
      await page.waitForTimeout(600); // observe the old banner disappearing
      await worker.evaluate(tabId => chrome.scripting.executeScript({target:{tabId},func:() => {
        window.__logClock = (window.__logClock || 0) + 20000;
        if (!window.__logRealNow) {window.__logRealNow = Date.now.bind(Date); Date.now = () => window.__logRealNow()+window.__logClock;}
      }}), tabId);
    };
    await nextReward();
    await page.evaluate(() => {document.querySelector('#reward').hidden=false;}); await waitCount(2);
    await nextReward(); await show('disabled'); await page.waitForTimeout(700); assert.equal(await count(),2);
    await page.locator('#reward').evaluate(button => {button.disabled=false;}); await waitCount(3);
    await nextReward();
    await worker.evaluate(() => chrome.storage.sync.set({'chzzk.autoLogPower':false}));
    await show(); await page.waitForTimeout(700); assert.equal(await count(),3);
    await worker.evaluate(() => chrome.storage.sync.set({'chzzk.autoLogPower':true})); await waitCount(4);
    await nextReward();
    await worker.evaluate(() => chrome.storage.local.set({'core.modules':{chzzk:false}}));
    await show(); await page.waitForTimeout(700); assert.equal(await count(),4);
    await worker.evaluate(() => chrome.storage.local.set({'core.modules':{chzzk:true}})); await waitCount(5);
    await nextReward();
    await page.evaluate(() => history.pushState({},'', '/video/123'));
    await show(); await page.waitForTimeout(700); assert.equal(await count(),5);
    await page.evaluate(() => {history.pushState({},'', '/live/'+'b'.repeat(32));document.querySelector('#reward').className='new_hash';});
    await waitCount(6);
    assert.deepEqual(await page.evaluate(() => [...new Set(window.clicks)]), ['reward']);
    await page.goto(`chrome-extension://${id}/chzzk/popup.html`);
    await page.locator('#autoLogPower').waitFor();
    assert.equal(await page.locator('#autoLogPower').isChecked(),true);
    await page.locator('#autoLogPower').uncheck();
    await page.waitForFunction(() => !document.querySelector('#autoLogPower').checked);
    assert.equal(await worker.evaluate(async () => (await chrome.storage.sync.get('chzzk.autoLogPower'))['chzzk.autoLogPower']),false);
    await page.screenshot({path:path.join(folder,'log-power-setting.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS registered extension: delayed/repeated reward, reused node, disabled button, setting/module toggle, SPA navigation, text fallback, non-reward exclusion and settings persistence;', folder);
  } finally {await context.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
