// Disposable Chrome profile, synthetic mail only; no personal mailbox or API key is used.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), http=require('node:http'), assert=require('node:assert/strict');
(async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'be-reader-')), ext=path.join(temp,'extension');
  fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
  const manifestPath=path.join(ext,'manifest.json'), manifest=JSON.parse(fs.readFileSync(manifestPath));
  manifest.host_permissions.push('http://reader.test/*');
  fs.writeFileSync(manifestPath,JSON.stringify(manifest));
  const background=path.join(ext,'background.js');
  const probe=`globalThis.__testMenus=new Map;globalThis.__testMenuClicks=[];globalThis.__testErrors=[];
    self.addEventListener('error',e=>__testErrors.push(e.message));self.addEventListener('unhandledrejection',e=>__testErrors.push(String(e.reason)));
    const nativeCreate=chrome.contextMenus.create.bind(chrome.contextMenus);chrome.contextMenus.create=(props,callback)=>nativeCreate(props,()=>{const error=chrome.runtime.lastError;if(error)__testErrors.push(error.message);else __testMenus.set(props.id,props);callback?.();});
    const nativeClick=chrome.contextMenus.onClicked.addListener.bind(chrome.contextMenus.onClicked);chrome.contextMenus.onClicked.addListener=handler=>{__testMenuClicks.push(handler);nativeClick(handler);};`;
  fs.writeFileSync(background,probe+fs.readFileSync(background,'utf8'));
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><p>Security notice for your account</p>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--window-size=780,590','--host-resolver-rules=MAP reader.test 127.0.0.1','--no-proxy-server'],viewport:null,colorScheme:'dark'});
  try {
    const cdp=await context.browser().newBrowserCDPSession();
    const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.setViewportSize({width:780,height:590}); // The action popup's real content size.
    await worker.evaluate(()=>chrome.storage.local.set({'core.popupTab':'gmail'}));
    await page.goto(`chrome-extension://${id}/popup.html`);
    await page.frameLocator('#checkerPlusMailFrame').locator('html.bongextend-checkerplus-embedded').waitFor();
    const frame=page.frames().find(frame=>frame.url().includes('/checkerplus-popup.html'));
    frame.on('pageerror',e=>errors.push(e.message));
    // This disposable profile has no Gmail login. Finish that startup state before
    // mounting the synthetic message, so its account dialog cannot cover the reader.
    await frame.locator('dialog[open]').first().waitFor({state:'visible'});
    const mountReader=()=>{
      document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      const section=document.getElementById('openEmailSection'); section.classList.add('active');
      initTemplate('openEmailSectionLayoutTemplate',true).id='openEmailSectionLayout';
      document.querySelector('.openEmailSubject').textContent='보안 알림 · 테스트 메일';
      document.getElementById('openEmailMessages').appendChild(document.getElementById('openEmailMessageTemplate').content.cloneNode(true));
      document.querySelector('.openEmailSender').textContent='알림 서비스';
      document.querySelector('.openEmailSenderEmailAddress').textContent='<hello@example.test>';
      document.querySelector('.messageHeader .date').textContent='2026년 11월 8일 오후 10:04';
      document.getElementById('replyArea').hidden=false;
      const body=document.querySelector('.messageBody');
      setSafeHTML(body,`<div id="whiteMail" style="background:#fff;color:#202124;padding:24px;border:1px solid #dadce0;border-radius:12px"><div style="font-size:24px;font-weight:700;color:#1a73e8">MAIL</div><h2 style="color:#202124">Security notice</h2><p style="color:#202124">Security details for your account</p><p>Plain text stays readable.</p><a href="https://example.invalid/" style="background:#1a73e8;color:#fff;padding:10px 18px;display:inline-block;border-radius:6px">Review activity</a></div><div id="darkMail" style="background:#172033;color:#fff;padding:24px;margin-top:18px;border-radius:12px"><h3 style="color:#fff">Original dark email</h3><p style="color:#fff">White text on the sender's dark background.</p><img alt="테스트 이미지" width="48" height="24" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='24'%3E%3Crect width='48' height='24' fill='red'/%3E%3C/svg%3E"></div>`);
      hideRemoteMessageBackgrounds(body);
    };
    await frame.evaluate(mountReader);
    await frame.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));
    await frame.locator('#back').getByText('메일함').waitFor();
    assert.equal(await frame.locator('#forward').textContent(),'전달');
    const readColors=()=>frame.evaluate(()=>{
      const style=selector=>{const s=getComputedStyle(document.querySelector(selector));return {color:s.color,bg:s.backgroundColor,filter:s.filter};};
      return {body:style('.messageBody'),white:style('#whiteMail'),dark:style('#darkMail'),link:style('#whiteMail a'),image:style('#darkMail img'),header:getComputedStyle(document.querySelector('#openEmailSection .site-header')).display,back:getComputedStyle(document.querySelector('#back').parentElement).display};
    });
    for(const scheme of ['dark','light']) {
      await page.emulateMedia({colorScheme:scheme});
      await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const colors=await readColors();
      assert.equal(await frame.locator('.openEmailSubject').isVisible(), true);
      assert.equal(await frame.evaluate(()=>document.querySelector('#openEmailHeader').parentElement===document.querySelector('#openEmail').parentElement),true);
      assert.equal(await frame.locator('#ai-compose-in-reply-button').isVisible(),false);
      assert.equal(colors.body.bg,'rgb(255, 255, 255)'); assert.equal(colors.body.filter,'none');
      assert.equal(colors.white.color,'rgb(32, 33, 36)'); assert.equal(colors.dark.bg,'rgb(23, 32, 51)'); assert.equal(colors.dark.color,'rgb(255, 255, 255)');
      assert.equal(colors.link.color,'rgb(255, 255, 255)'); assert.equal(colors.image.filter,'none');
      assert.notEqual(colors.header,'none'); assert.notEqual(colors.back,'none');
      await frame.locator('#whiteMail').screenshot({path:path.join(temp,`message-${scheme}.png`)});
      await page.evaluate(()=>window.scrollTo(0,0));
      await frame.evaluate(()=>document.getElementById('openEmail').scrollTop=0);
      await page.screenshot({path:path.join(temp,`reader-${scheme}.png`)});
    }
    console.log('PASS dark/light mail: original colors, dark designed content, links, image colors, back toolbar');
    assert.equal(await page.locator('#windowResizeHandle').isVisible(),true,'ordinary popup page exposes the resize grip');
    const promotedPage=context.waitForEvent('page');
    const ordinaryGrip=await page.locator('#windowResizeHandle').boundingBox();
    await page.mouse.move(ordinaryGrip.x+10,ordinaryGrip.y+10);await page.mouse.down();
    await page.mouse.move(ordinaryGrip.x-70,ordinaryGrip.y-60,{steps:4});await page.mouse.up();
    const promoted=await promotedPage;await promoted.waitForLoadState();
    await promoted.waitForFunction(()=>document.documentElement.classList.contains('is-window'));
    assert.ok(promoted.url().includes('window=1'));
    await promoted.locator('#windowResizeHandle').press('ArrowLeft');
    await promoted.close();
    console.log('PASS ordinary popup grip opens a real resizable app window');
    const opened=context.waitForEvent('page');
    await page.locator('#openResizableWindow').click();
    const floating=await opened; await floating.waitForLoadState();
    await floating.locator('#windowResizeHandle').waitFor();
    const floatingFrame=floating.frames().find(frame=>frame.url().includes('/checkerplus-popup.html'));
    await floatingFrame.locator('dialog[open]').first().waitFor({state:'visible'});
    await floatingFrame.evaluate(mountReader);
    assert.equal(await floating.locator('#openResizableWindow').isVisible(),false);
    const floatingTab=await worker.evaluate(async url=>(await chrome.tabs.query({url}))[0],floating.url());
    await worker.evaluate(id=>chrome.windows.update(id,{width:620,height:540}),floatingTab.windowId);
    await floating.waitForFunction(()=>document.body.clientWidth===innerWidth && document.body.clientHeight===innerHeight);
    await floating.waitForFunction(async()=>{const value=(await chrome.storage.local.get('core.popupWindowSize'))['core.popupWindowSize']; return value?.width===620&&value?.height===540;});
    await floating.locator('#windowResizeHandle').focus();
    await floating.locator('#windowResizeHandle').press('ArrowRight');
    await floating.waitForFunction(async()=>{const value=(await chrome.storage.local.get('core.popupWindowSize'))['core.popupWindowSize'];return value?.width===660;});
    await floatingFrame.locator('#forward').getByText('전달').waitFor();
    await floatingFrame.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));
    assert.equal(await floatingFrame.evaluate(()=>{const footer=document.querySelector('#openEmailSection footer').getBoundingClientRect();return footer.x===0&&footer.bottom<=innerHeight&&footer.height>30;}),true);
    const grip=await floating.locator('#windowResizeHandle').boundingBox();
    await floating.mouse.move(grip.x+10,grip.y+10); await floating.mouse.down();
    await floating.waitForFunction(()=>document.documentElement.classList.contains('resizing'));
    await floating.mouse.move(grip.x-30,grip.y-30,{steps:4}); await floating.mouse.up();
    await floating.waitForFunction(async()=>{const value=(await chrome.storage.local.get('core.popupWindowSize'))['core.popupWindowSize'];return value?.width===620&&value?.height===500;});
    const gear=await floating.locator('.gear-fab').boundingBox(),handle=await floating.locator('#windowResizeHandle').boundingBox();
    assert.ok(gear.x+gear.width<=handle.x || gear.y+gear.height<=handle.y,'settings must not overlap the resize grip');
    await floating.screenshot({path:path.join(temp,'resizable-window.png')});
    await floating.close();
    console.log('PASS real Chrome floating window: responsive fill, native resize, drag/keyboard grip, remembered dimensions');
    const menu=await worker.evaluate(()=>__testMenus.get('toggle-translation'));
    assert.equal(menu.title,'이 페이지 번역하기'); assert.ok(menu.contexts.includes('all'));
    assert.ok(menu.documentUrlPatterns.some(pattern=>pattern.startsWith('chrome-extension://')));
    // Wait for the mail module's own menus, then verify they did not erase translation.
    assert.equal((await worker.evaluate(()=>__testMenus.get('sendPageLink')))?.id,'sendPageLink');
    await frame.evaluate(()=>{
      const nativeConnect=chrome.runtime.connect.bind(chrome.runtime);
      chrome.runtime.connect=options=>{
        if(options.name!=='bongextend-translation-batch')return nativeConnect(options);
        const messages=new Set(), disconnects=new Set();
        return {onMessage:{addListener:fn=>messages.add(fn)},onDisconnect:{addListener:fn=>disconnects.add(fn)},disconnect(){for(const fn of disconnects)fn();},postMessage(message){queueMicrotask(()=>{for(const fn of messages)fn({type:'BONGEXTEND_TRANSLATION_BATCH_RESULT',response:{ok:true,translations:message.texts.map(()=> '번역 완료'),model:'local-fixture'}});});}};
      };
    });
    await worker.evaluate(url=>{for(const handler of __testMenuClicks)handler({menuItemId:'toggle-translation',pageUrl:url},undefined);},frame.url());
    await frame.waitForFunction(()=>document.querySelector('.messageBody')?.textContent.includes('번역 완료'));
    assert.equal(await frame.evaluate(()=>__pageTranslator.installed===true),false,'mail library must not answer unrelated page status requests');
    assert.equal((await readColors()).body.filter,'none');
    console.log('PASS mail context menu translates the mail body through the shared protocol');
    const web=await context.newPage(); await web.goto(`http://reader.test:${server.address().port}/`);
    await worker.evaluate(async url=>{const [tab]=await chrome.tabs.query({url});for(const handler of __testMenuClicks)handler({menuItemId:'toggle-translation',pageUrl:url},tab);},web.url());
    // Translation runs in Chrome's isolated content-script world, not the page's world.
    const readWebStatus=()=>worker.evaluate(async url=>{
      const [tab]=await chrome.tabs.query({url});
      const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.__pageTranslator?.session?.getStatus()});
      return result.result;
    },web.url());
    let webStatus;
    for(let attempt=0;attempt<50;attempt++) {
      webStatus=await readWebStatus();
      if(webStatus?.enabled)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(webStatus?.enabled,true);
    console.log('PASS website context menu enables translation on the clicked tab');
    assert.deepEqual(errors,[]); assert.deepEqual(await worker.evaluate(()=>__testErrors),[]);
    console.log('screenshots',temp);
  } finally {await context.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
