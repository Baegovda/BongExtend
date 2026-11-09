// Disposable browser only. Helper is injected as a packaged test file; no personal profile.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-contrast-'));
 const source=fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const install=async()=>page.addScriptTag({content:source+';window.contrast=createContrastController(document);window.contrast.start();'});
 try{
  await page.setContent(`<html data-darkreader-scheme="dark"><body style="background:#181a1b;color:#333;font:18px sans-serif"><div id="card" style="background:#181a1b;box-shadow:0 0 0 1px #222;width:400px;padding:20px"><span id="low">일반 글자 대비 보정</span><span id="alpha" style="color:rgba(100,100,100,.5)">반투명 글자</span></div><p id="good" style="color:#ddd">읽기 좋은 글자</p><p id="brand" style="color:rgb(180,30,20)">브랜드색 보존</p><button disabled style="color:#333">비활성</button><div hidden>숨김</div><div style="opacity:.3"><span id="faded">의도적 투명</span></div><div contenteditable="true" style="color:#333">편집 영역</div><button><svg id="icon" width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M0 0h20v20H0z"/></svg></button></body></html>`);
  await install();await page.waitForTimeout(700);
  assert.notEqual(await page.locator('#low').evaluate(e=>getComputedStyle(e).color),'rgb(51, 51, 51)');
  assert.match(await page.locator('#card').evaluate(e=>e.style.outline),/solid/);
  assert.equal(await page.locator('#brand').evaluate(e=>e.style.color),'rgb(180, 30, 20)');
  assert.equal(await page.locator('#faded').evaluate(e=>e.style.color),'');
  assert.equal(await page.locator('[disabled]').evaluate(e=>e.style.color),'rgb(51, 51, 51)');
  assert.equal(await page.locator('[hidden]').evaluate(e=>getComputedStyle(e).display),'none');
  await page.evaluate(()=>{const p=document.createElement('p');p.id='dynamic';p.textContent='동적 글자';p.style.color='#333';document.body.append(p);});
  await page.waitForTimeout(400);
  assert.notEqual(await page.locator('#dynamic').evaluate(e=>getComputedStyle(e).color),'rgb(51, 51, 51)');
  const passes=await page.evaluate(()=>contrast.stats.passes);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>contrast.stats.passes),passes,'self mutations must settle');
  await page.screenshot({path:path.join(folder,'synthetic-dark.png')});
  await page.locator('#dynamic').evaluate(e=>e.style.setProperty('color','rgb(230, 230, 230)','important'));await page.waitForTimeout(250);
  await page.evaluate(()=>contrast.stop());
  assert.equal(await page.locator('#dynamic').evaluate(e=>e.style.color),'rgb(230, 230, 230)');
  assert.equal(await page.locator('#low').evaluate(e=>e.style.color),'');assert.equal(await page.locator('#card').evaluate(e=>e.style.outline),'');
  await page.evaluate(()=>{document.documentElement.removeAttribute('data-darkreader-scheme');contrast.start()});await page.waitForTimeout(250);
  assert.equal(await page.locator('#low').evaluate(e=>e.style.color),'');
  console.log('PASS synthetic:',await page.evaluate(()=>contrast.stats));
  await page.evaluate(()=>{
   contrast.stop();document.documentElement.setAttribute('data-darkreader-scheme','dark');
   const markup=(id,a,b)=>`<section id="${id}"><i class="legend-chip--alpha" style="display:inline-block;width:12px;height:12px;background:${a}"></i><i class="legend-chip--beta" style="display:inline-block;width:12px;height:12px;background:${b}"></i><a data-kind="alpha" style="display:inline-block;width:20px;height:20px;background:${a}"></a><a data-kind="beta" style="display:inline-block;width:20px;height:20px;background:${b}"></a></section>`;
   document.body.innerHTML=markup('close','#bc6a30','#bb783d')+markup('distinct','#e67620','#33bddd');contrast.start();
  });await page.waitForTimeout(600);
  assert.equal(await page.locator('#close [data-kind="beta"]').evaluate(e=>e.style.backgroundColor),'rgb(85, 189, 214)');
  assert.equal(await page.locator('#distinct [data-kind="beta"]').evaluate(e=>e.style.backgroundColor),'rgb(51, 189, 221)');
  const settled=await page.evaluate(()=>contrast.stats.passes);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>contrast.stats.passes),settled);
  await page.evaluate(()=>{contrast.stop();document.body.innerHTML='<p>성능 검사</p>'+Array.from({length:10000},()=>'<span>후보</span>').join('');contrast.start();});
  await page.waitForTimeout(3500);const bounded=await page.evaluate(()=>({...contrast.stats}));
  assert.ok(bounded.maxBatch<=180);const boundedPasses=bounded.passes;await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>contrast.stats.passes),boundedPasses);
  console.log('PASS independent chart scopes and bounded 10000-node traversal:',bounded);await page.evaluate(()=>contrast.stop());
  // Paint-order diagnostic, not a claim about the actual signed-in note DOM.
  const layer=await browser.newPage({viewport:{width:800,height:600}});
  await layer.setContent(`<html><body style="margin:0"><header style="height:50px;background:green">Header</header><aside style="width:150px;height:550px;background:gray">Sidebar</aside><iframe style="position:absolute;left:150px;top:50px;width:600px;height:500px;z-index:-1;border:0" srcdoc="<body style='background:white;color:black'><h1>FRAME CONTENT</h1></body>"></iframe></body></html>`);
  await layer.waitForTimeout(300);await layer.screenshot({path:path.join(folder,'layer-before.png')});
  await layer.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
  await layer.evaluate(()=>DarkReader.enable());await layer.waitForTimeout(400);
  await layer.screenshot({path:path.join(folder,'layer-dark-hidden.png')});
  assert.equal(await layer.frames()[1].locator('h1').textContent(),'FRAME CONTENT');
  await layer.evaluate(()=>{for(const e of [document.documentElement,document.body])e.style.setProperty('background-color','transparent','important')});
  await layer.waitForTimeout(250);await layer.screenshot({path:path.join(folder,'layer-transparent-restored.png')});
  await layer.close();console.log('Paint-order diagnostic screenshots:',folder);
  if(process.argv.includes('--synthetic-only'))return;
  // Public page checks use Dark Reader API plus the same helper, not a signed-in session.
  const darkreader=fs.readFileSync('node_modules/darkreader/darkreader.js','utf8');
  await page.exposeFunction('publicThemeResource',async url=>{
   const host=new URL(url).hostname;
   if(!/(^|\.)(pstatic\.net|naver\.com|codex-resets\.com)$/.test(host))throw Error('Unapproved public theme resource');
   const response=await fetch(url,{credentials:'omit'});
   return {data:Buffer.from(await response.arrayBuffer()).toString('base64'),type:response.headers.get('content-type')};
  });
  const fixes=await import(require('node:url').pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href);
  for(const url of ['https://www.naver.com/','https://codex-resets.com/ko']){
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);
   await page.addScriptTag({content:darkreader});
   await page.evaluate(f=>{DarkReader.setFetchMethod(async url=>{const r=await publicThemeResource(url);return new Response(Uint8Array.from(atob(r.data),c=>c.charCodeAt(0)),{headers:{'content-type':r.type}})});DarkReader.enable({brightness:100,contrast:100},f)},fixes.withTranslationColors(fixes.darkReaderFixesForSite(new URL(url).hostname)));
   await page.waitForTimeout(3000);await install();await page.waitForTimeout(5000);
   if(url.includes('naver')){
    const edge=await page.locator('#account').evaluate(e=>({outline:getComputedStyle(e).outline,shadow:getComputedStyle(e).boxShadow,bg:getComputedStyle(e).backgroundColor}));console.log('Naver account',edge);
    assert.match(edge.outline,/solid/);
    console.log('AI markup',await page.locator('.ai_effect_symbol').evaluateAll(els=>els.map(e=>e.outerHTML.slice(0,1500))));
   }else{
    const colors=await page.locator('.legend-chip--regular,.legend-chip--banked').evaluateAll(els=>els.map(e=>getComputedStyle(e).backgroundColor));
    assert.ok(new Set(colors).size>=2);console.log('Chart colors',colors);
    for(const category of ['regular','banked']){
     const result=await page.locator(`.legend-chip--${category},[data-reset-type="${category}"]`).evaluateAll(els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.bottom>=-100&&r.top<=innerHeight+100&&r.right>=0&&r.left<=innerWidth}).map(e=>getComputedStyle(e).backgroundColor));
     assert.equal(new Set(result).size,1,category+' legend/cells must match');
    }
   }
   console.log(url,await page.evaluate(()=>contrast.stats));
   await page.screenshot({path:path.join(folder,url.includes('naver')?'naver-dark.png':'codex-resets-dark.png')});
  }
  console.log('Evidence:',folder);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
