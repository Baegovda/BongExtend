// Real extension/window APIs in an isolated headless Chrome profile, with a local Chzzk DOM fixture.
// Never attaches to, focuses, resizes or drives the user's Chrome windows.
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'be-chzzk-wide-'));
  // Reuse the integration build without mutating it while other teams are working.
  const extensionPath = path.join(folder, 'extension');
  fs.cpSync(path.resolve('.output/chrome-mv3'), extensionPath, {recursive:true});
  for (const file of ['content-wide.js', 'lib/wide.js']) {
    fs.copyFileSync(path.resolve('src/modules/chzzk', file), path.join(extensionPath, 'chzzk', file));
  }
  const context = await chromium.launchPersistentContext(path.join(folder, 'profile'), {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, viewport:null,
    ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging', '--window-size=760,560']
  });
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const {id} = await cdp.send('Extensions.loadUnpacked', {path:extensionPath});
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(async () => {
      await chrome.storage.local.set({'core.update:autoCheck':false});
      await chrome.storage.sync.set({'chzzk.autoWide':false, 'chzzk.wideFullscreen':true});
      for (let i=0;i<100;i++) {
        const scripts = (await chrome.scripting.getRegisteredContentScripts()).filter(script => script.id.startsWith('bongextend-chzzk'));
        if (scripts.some(script => script.id === 'bongextend-chzzk')) {
          await chrome.scripting.unregisterContentScripts({ids:scripts.map(script => script.id)}); return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw Error('Chzzk script registration timed out');
    });
    const markup = `<!doctype html><meta charset="utf-8"><title>Local Chzzk wide-layout fixture</title>
      <style>body{margin:0;background:#151719;color:#eee;font:20px system-ui}header{padding:20px}
      #live_player_layout{margin:20px;padding:20px;background:#22272e;border-radius:16px}
      #live_player_layout.is_large{margin:0;border-radius:0;min-height:calc(100vh - 120px)}
      video{display:block;width:80%;height:300px;background:linear-gradient(140deg,#133b4f,#39515c,#593761);margin:20px auto}
      button{font:inherit;padding:12px 20px;border:0;border-radius:12px;background:#00e9a5;color:#12251e}</style>
      <header>치지직 넓은 화면 · Chrome 전체화면 연동 시험</header>
      <main id="live_player_layout"><button class="pzp-pc-viewmode-button" aria-label="넓은 화면" aria-pressed="false">넓은 화면</button><video></video></main>
      <script>document.querySelector('button').onclick=event=>{const wide=document.querySelector('main').classList.toggle('is_large');event.currentTarget.setAttribute('aria-pressed',String(wide));event.currentTarget.setAttribute('aria-label',wide?'기본 화면':'넓은 화면');event.currentTarget.textContent=wide?'기본 화면으로':'넓은 화면';};</script>`;
    await context.route('https://chzzk.naver.com/**', route => route.fulfill({contentType:'text/html', body:markup}));
    await context.route('https://example.test/**', route => route.fulfill({contentType:'text/html', body:'<!doctype html><title>Another page</title>'}));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = 'https://chzzk.naver.com/live/' + 'a'.repeat(32);
    await page.goto(url);
    const tab = await worker.evaluate(async url => (await chrome.tabs.query({url}))[0], url);
    const initial = await worker.evaluate(windowId => chrome.windows.get(windowId), tab.windowId);
    assert.equal(initial.focused, true);
    await worker.evaluate(tabId => chrome.scripting.executeScript({target:{tabId}, func:() => {
      window.__wideTrace = [];
      const send = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = (...args) => {
        const item = {message:args[0]}; window.__wideTrace.push(item);
        const result = send(...args); result.then(value => item.reply=value, error => item.error=error.message); return result;
      };
    }}), tab.id);
    await worker.evaluate(tabId => chrome.scripting.executeScript({target:{tabId}, files:['chzzk/lib/ns.js','chzzk/lib/wide.js','chzzk/content-wide.js']}), tab.id);
    const state = () => worker.evaluate(windowId => chrome.windows.get(windowId), tab.windowId);
    const wait = async (read, expected) => {
      const deadline = Date.now()+10000;
      while (Date.now()<deadline) {const value=await read(); if (value===expected) return; await new Promise(resolve=>setTimeout(resolve,50));}
      console.error('Fixture DOM:', await page.evaluate(() => ({className:document.querySelector('main')?.className, label:document.querySelector('button')?.getAttribute('aria-label')})));
      console.error('Content messages:', JSON.stringify(await worker.evaluate(tabId => chrome.scripting.executeScript({target:{tabId},func:()=>({trace:window.__wideTrace, button:document.querySelector('button')?.outerHTML})}), tab.id)));
      console.error('Window/session:', JSON.stringify(await worker.evaluate(async windowId => ({window:await chrome.windows.get(windowId), session:await chrome.storage.session.get('core.chzzkWideFullscreen')}), tab.windowId)));
      throw Error(`Expected ${expected}, got ${await read()}`);
    };
    const windowState = expected => wait(async () => (await state()).state, expected);
    const toggle = () => page.locator('.pzp-pc-viewmode-button').click();
    // Force one Chrome API rejection in the worker, then let the real API handle the retry.
    await worker.evaluate(() => {
      const update = chrome.windows.update.bind(chrome.windows);
      chrome.windows.update = (id, value) => {
        if (value.state === 'fullscreen') {
          chrome.windows.update = update;
          return Promise.reject(new Error('Fixture: transient fullscreen API rejection'));
        }
        return update(id, value);
      };
    });
    await toggle(); await windowState('fullscreen');
    const entryReplies = await worker.evaluate(tabId => chrome.scripting.executeScript({target:{tabId},func:()=>window.__wideTrace.filter(item=>item.message.wide).map(item=>item.reply)}), tab.id);
    assert.equal(entryReplies[0].result[0].ok, false, 'First API rejection must reach the content script');
    assert.equal(entryReplies[0].result[1].ok, true, 'Retry must enter actual Chrome fullscreen');
    assert.equal(await page.evaluate(() => document.fullscreenElement === null), true, 'Must be browser F11 state, not element fullscreen');
    await page.screenshot({path:path.join(folder,'wide-fullscreen.png')});
    await toggle(); await windowState(initial.state);
    const restored = await state();
    for (const key of ['left','top','width','height']) assert.equal(restored[key], initial[key], `Restored ${key}`);
    await worker.evaluate(windowId => chrome.windows.update(windowId, {state:'maximized'}), tab.windowId);
    await windowState('maximized'); await toggle(); await windowState('fullscreen');
    await toggle(); await windowState('maximized');
    // Fullscreen that existed before wide mode must remain owned by the user.
    await worker.evaluate(windowId => chrome.windows.update(windowId, {state:'fullscreen'}), tab.windowId);
    await windowState('fullscreen'); await toggle();
    await page.waitForTimeout(200); await toggle(); await page.waitForTimeout(200);
    assert.equal((await state()).state, 'fullscreen');
    await worker.evaluate(windowId => chrome.windows.update(windowId, {state:'normal'}), tab.windowId);
    await windowState('normal'); await toggle(); await windowState('fullscreen');
    // Simulate the user leaving F11 via the same Chrome window state API.
    await worker.evaluate(windowId => chrome.windows.update(windowId, {state:'normal'}), tab.windowId);
    await wait(() => worker.evaluate(windowId => chrome.storage.session.get('core.chzzkWideFullscreen').then(data => data['core.chzzkWideFullscreen']?.[windowId]?.manualExit), tab.windowId), true);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(150); assert.equal((await state()).state, 'normal');
    await toggle(); await toggle(); await windowState('fullscreen');
    const other = await context.newPage();
    await windowState('normal'); await other.close();
    await windowState('fullscreen'); // Visibility change re-enters for the active wide Chzzk tab.
    await page.goto('https://example.test/'); await windowState('normal');
    assert.deepEqual(errors, []);
    await page.goto(`chrome-extension://${id}/chzzk/popup.html`);
    await page.locator('#wideFullscreen').waitFor();
    await wait(() => page.locator('#wideFullscreen').isChecked(), true);
    assert.equal(await page.locator('#verticalTabsSetup').count(), 0);
    await page.screenshot({path:path.join(folder,'wide-setting.png')});
    console.log('PASS real Chrome window API: one simulated API rejection then automatic retry, browser fullscreen, normal bounds/maximized restoration, existing fullscreen, manual exit, tab switch/navigation and settings;', folder);
  } finally {await context.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
