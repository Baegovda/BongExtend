// Disposable Chrome + screenshot-derived chat fixture. No live Taobao or paid Gemini requests.
const { chromium } = require('playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const http = require('node:http'), assert = require('node:assert/strict');

(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'be-translation-progress-'));
  const extension = path.join(folder, 'extension');
  fs.cpSync('.output/chrome-mv3', extension, { recursive: true });
  const manifestPath = path.join(extension, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.host_permissions.push('http://127.0.0.1/*');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const workerPath = path.join(extension, 'background.js');
  fs.writeFileSync(workerPath, `
    globalThis.__icons=[];globalThis.__apiInputs=[];globalThis.__holdApi=true;globalThis.__apiWait=[];globalThis.__failApi=false;
    globalThis.__workerErrors=[];
    self.addEventListener('error', e=>__workerErrors.push(e.message));
    self.addEventListener('unhandledrejection', e=>__workerErrors.push(String(e.reason)));
    const originalIcon=chrome.action.setIcon.bind(chrome.action);
    chrome.action.setIcon=details=>{
      if(details.tabId!=null){const image=details.imageData?.[16];let hash=0;
        if(image)for(const byte of image.data)hash=(hash*31+byte)|0;
        __icons.push({tabId:details.tabId,hash,path:details.path,pixels:details.imageData?.[32]?Array.from(details.imageData[32].data):null});}
      return originalIcon(details);
    };
    const originalFetch=globalThis.fetch.bind(globalThis);
    globalThis.__releaseApi=()=>{__holdApi=false;for(const resolve of __apiWait.splice(0))resolve();};
    globalThis.fetch=async(input,init)=>{
      const url=String(input?.url || input);
      if(url.includes('generativelanguage.googleapis.com')){
        if(!url.includes(':generateContent'))return new Response('{}',{status:403});
        const prompt=JSON.parse(init.body).contents[0].parts[0].text;
        const texts=JSON.parse(prompt.split('Input JSON array:\\n')[1].split('\\n')[0]);__apiInputs.push(texts);
        if(__holdApi)await new Promise(resolve=>__apiWait.push(resolve));
        if(__failApi)return Response.json({error:{message:'Fixture invalid API key',status:'PERMISSION_DENIED'}},{status:403});
        const translations=texts.map(text=>text.startsWith('亲，')?'안녕하세요. 행사 할인과 재고가 빠르게 소진되고 있어요. 결제하시면 순서대로 출고해 드려요.':text.includes('新消息')?'새로 도착한 메시지를 확인했어요':text.includes('内嵌')?'하위 프레임의 새 메시지':'공식 스토어 신상품 안내 '+(text.match(/\\d+/)?.[0] || ''));
        return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(translations)}]}}]});
      }
      if(url.startsWith('chrome-extension:'))return originalFetch(input,init);
      return new Response('',{status:503});
    };
  ` + fs.readFileSync(workerPath, 'utf8'));
  const greeting = '亲，双11活动优惠和库存都比较紧张，目前各机型还有店铺优化和国补哦～付款后我们优先给您安排发货，有任何问题也可以随时问我哈❤';
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html;charset=utf-8');
    if (req.url === '/frame') return res.end('<!doctype html><p>内嵌聊天消息</p>');
    res.end(`<!doctype html><meta charset="utf-8"><style>
      body{margin:32px;background:#1c2021;color:#ddd;font:17px/1.6 Arial,sans-serif}
      main{display:grid;grid-template-columns:240px 1fr;gap:24px;max-width:1050px;margin:auto}
      aside,.pane{padding:18px;border:1px solid #42494d;border-radius:12px}
      .row{height:40px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bubble{max-width:650px;background:#121617;padding:16px;border-radius:12px;margin:16px 0}
      h1{font-size:20px;margin:0}textarea{display:block;width:95%;height:60px;background:#232b2e;color:#ddd}
      iframe{width:100%;height:50px;border:0;background:#eee}code{display:block;margin-top:12px}
    </style><main><aside>${Array.from({length:12},(_,i)=>`<div class="row">애니큐빅 官方旗舰店 ${i}</div>`).join('')}</aside><section class="pane"><h1>官方旗舰店</h1><div class="bubble" id="greeting">${greeting}</div>${Array.from({length:6},(_,i)=>`<p class="bubble">新品推荐消息 ${i}</p>`).join('')}<iframe src="/frame"></iframe><textarea>编辑中的草稿</textarea><code>const 原始代码 = 1;</code></section></main>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const context = await chromium.launchPersistentContext(path.join(folder, 'profile'), {
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging'], viewport: {width:1200,height:900},
  });
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: extension });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        'core.modules': { trans:true, chzzk:false, dc:false, gmail:false, fx:false, dark:false, download:false },
        'trans.settings': { apiKey:'fixture-no-billing', modelChoice:'gemini-3.5-flash-lite', revealAnimation:true, targetLanguage:'ko' },
      });
    });
    const page = await context.newPage();
    const errors=[];page.on('pageerror', error=>errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);
    const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab=>tab.url===url).id, url);
    // Chrome scripting receives self-contained functions, never string evaluation.
    const start = () => worker.evaluate(async tabId => {
      await chrome.scripting.executeScript({target:{tabId,allFrames:true},files:['trans/content/content.js']});
      await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:()=>globalThis.__pageTranslator.session.setEnabled(true)});
    }, tabId);
    const title = () => worker.evaluate(tabId=>chrome.action.getTitle({tabId}),tabId);
    const waitTitle = async busy => {
      for(let i=0;i<100;i++){if((await title()).includes('번역 중')===busy)return;await new Promise(resolve=>setTimeout(resolve,80));}
      assert.fail(`toolbar did not become ${busy?'busy':'idle'}`);
    };
    await start(); await waitTitle(true);
    await new Promise(resolve=>setTimeout(resolve,400));
    const moving = await worker.evaluate(tabId=>__icons.filter(icon=>icon.tabId===tabId&&icon.pixels),tabId);
    assert.ok(new Set(moving.map(icon=>icon.hash)).size>=2,'spinner must actually change frames');
    await worker.evaluate(()=>__releaseApi());
    await waitTitle(false);
    assert.match(await page.locator('#greeting').innerText(),/행사 할인/);
    const finalInputs=await worker.evaluate(()=>__apiInputs.length);
    await page.locator('#greeting').evaluate((element,source)=>element.firstChild.nodeValue=source,greeting);
    await page.waitForFunction(()=>document.getElementById('greeting').textContent.includes('행사 할인'));
    assert.equal(await worker.evaluate(()=>__apiInputs.length),finalInputs,'site redraw must reuse the saved translation');
    await page.screenshot({path:path.join(folder,'chat-done.png')});
    assert.equal(await page.locator('textarea').inputValue(),'编辑中的草稿');
    assert.equal(await page.locator('code').innerText(),'const 原始代码 = 1;');
    // A frame translating alone must keep the indicator on, and removal must clear it.
    await worker.evaluate(()=>{__holdApi=true;});
    await page.frames()[1].evaluate(()=>document.querySelector('p').firstChild.nodeValue='内嵌新的消息二');
    await waitTitle(true);
    await page.locator('iframe').evaluate(frame=>frame.remove());
    await waitTitle(false);
    await worker.evaluate(()=>__releaseApi());
    // Error pauses the queue and restores the original icon.
    await worker.evaluate(()=>{__failApi=true;});
    await page.locator('#greeting').evaluate(element=>element.firstChild.nodeValue='新消息失败示例');
    await page.waitForFunction(()=>document.querySelector('#page-translator-root'));
    await waitTitle(false);
    const trace = await worker.evaluate(tabId=>({last:__icons.filter(icon=>icon.tabId===tabId).at(-1),errors:__workerErrors}),tabId);
    assert.ok(trace.last.path && !trace.last.pixels);
    assert.deepEqual(errors,[]);assert.deepEqual(trace.errors,[]);
    // Render the exact icon pixels seen by Chrome at native size and 4x for visual inspection.
    const preview=await context.newPage();
    await preview.setContent('<body style="background:#262b30;color:white;font:15px Arial;padding:24px"><p>BongExtend · 번역 중</p><div id="icons" style="display:flex;gap:24px;align-items:center"></div></body>');
    await preview.evaluate(images=>{
      for(const image of images){const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.pixels),32,32),0,0);canvas.style.width='96px';canvas.style.height='96px';document.getElementById('icons').appendChild(canvas);}
    },moving.slice(0,4));
    await preview.screenshot({path:path.join(folder,'toolbar-frames.png')});
    console.log('PASS real action API frames, completion, cached chat redraw, subframe disconnect and error');
    console.log('screenshots',folder);
  } finally { await context.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
