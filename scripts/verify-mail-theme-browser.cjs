// Synthetic mail DOM only. Uses the same upstream named color exports as product integration.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-mail-theme-')),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900}});
  await page.setContent(`<body style="background:#303236"><aside id="ui" style="color:#dedede">앱 UI는 그대로</aside><main id="mail" style="max-width:760px;padding:24px;background:white;color:#222;font:16px Arial"><h1>합성 메일 본문</h1><table bgcolor="#ffffff" style="border:1px solid #bbb;width:100%"><tr><td style="padding:20px;background:linear-gradient(90deg,rgb(240,240,255),rgb(255,255,255))"><font color="#333333">원래 HTML 색상과 카드</font><p><a href="#" style="color:#1762aa">의미 있는 링크</a></p><a style="display:inline-block;padding:12px;background:#1976d2;color:white">파란 동작 버튼</a></td></tr></table><div id="darkCard" style="background:#222;color:#ddd;padding:20px">원래 어두운 카드</div><div contenteditable="true" id="editor" style="color:#222;background:#eee">편집 중인 답장 유지</div><span hidden id="hidden">숨김</span><button disabled id="disabled">비활성</button><img id="art" width="80" height="60" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Crect width='80' height='60' fill='orange'/%3E%3Ccircle cx='40' cy='30' r='20' fill='blue'/%3E%3C/svg%3E"></main></body>`);
  await page.evaluate(()=>document.querySelector('td').insertAdjacentHTML('beforeend','<svg id="vector" width="30" height="20"><path fill="currentColor" d="M0 0h30v20H0z"/></svg>'));
  const vector=await page.locator('#vector').evaluate(e=>({html:e.outerHTML,color:getComputedStyle(e).color}));
  const ui=await page.locator('#ui').evaluate(e=>e.style.cssText),editor=await page.locator('#editor').evaluate(e=>e.style.cssText),image=await page.locator('#art').getAttribute('src');
  await page.screenshot({path:path.join(folder,'before.png')});
  await page.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
  const helpers=fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/modules/dark/mail-theme.js','utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'');
  const settings=await import(require('node:url').pathToFileURL(path.resolve('src/modules/dark/settings.js')).href);
  await page.addScriptTag({content:helpers});
  await page.evaluate(theme=>{
   const adapt=fn=>(color,theme)=>fn({r:color[0],g:color[1],b:color[2],a:color[3]},theme,false);
   window.mailTheme=createMailThemeController(document.querySelector('#mail'),{background:adapt(DarkReader.modifyBackgroundColor),foreground:adapt(DarkReader.modifyForegroundColor),border:adapt(DarkReader.modifyBorderColor)});
   mailTheme.update(true,{...theme,lightSchemeBackgroundColor:'#ffffff',lightSchemeTextColor:'#181a1b'});
  },settings.DEFAULT_DARK_SETTINGS);await page.waitForTimeout(350);
  assert.equal(await page.locator('#ui').evaluate(e=>e.style.cssText),ui);assert.equal(await page.locator('#editor').evaluate(e=>e.style.cssText),editor);assert.equal(await page.locator('#art').getAttribute('src'),image);
  assert.notEqual(await page.locator('#mail').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await page.locator('#mail').evaluate(e=>getComputedStyle(e).colorScheme),'dark');
  assert.notEqual(await page.locator('#mail').evaluate(e=>getComputedStyle(e).scrollbarColor),'auto');
  assert.equal(await page.locator('#hidden').evaluate(e=>getComputedStyle(e).display),'none');
  assert.deepEqual(await page.locator('#vector').evaluate(e=>({html:e.outerHTML,color:getComputedStyle(e).color})),vector);
  const passes=await page.evaluate(()=>mailTheme.stats.passes);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>mailTheme.stats.passes),passes);
  await page.evaluate(()=>document.querySelector('#mail').insertAdjacentHTML('beforeend','<p id="late" style="background:white;color:#111">나중에 도착한 번역문</p>'));await page.waitForTimeout(100);assert.notEqual(await page.locator('#late').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  await page.screenshot({path:path.join(folder,'dark.png')});await page.evaluate(()=>mailTheme.stop());assert.equal(await page.locator('#mail').evaluate(e=>e.style.backgroundColor),'white');
  assert.equal(await page.locator('#mail').evaluate(e=>e.style.getPropertyValue('color-scheme')),'');assert.equal(await page.locator('#mail').evaluate(e=>e.style.getPropertyValue('scrollbar-color')),'');
  assert.equal(await page.locator('table').getAttribute('bgcolor'),'#ffffff');await page.screenshot({path:path.join(folder,'restored.png')});
  await page.evaluate(()=>{const root=document.querySelector('#mail');root.innerHTML=Array.from({length:10000},()=>'<p style="background:white;color:#111">Large mail</p>').join('');mailTheme.update(true,{darkSchemeBackgroundColor:'#181a1b',darkSchemeTextColor:'#e8e6e3',lightSchemeBackgroundColor:'#fff',lightSchemeTextColor:'#181a1b',mode:1,brightness:100,contrast:100,grayscale:0,sepia:0})});
  await page.waitForTimeout(2000);const stats=await page.evaluate(()=>({...mailTheme.stats}));assert.equal(stats.limitHit,true);assert.ok(stats.maxBatch<=120);
  assert.equal(await page.locator('#mail').evaluate(e=>e.style.backgroundColor),'white');
  assert.equal(await page.locator('#mail p').first().evaluate(e=>e.style.color),'rgb(17, 17, 17)');
  assert.equal(await page.locator('#mail p').last().evaluate(e=>e.style.backgroundColor),'white');
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>mailTheme.stats.passes),stats.passes);
  await page.evaluate(()=>{document.querySelector('#mail').innerHTML='<p style="color:#111">Small mail</p>';mailTheme.update(true,{darkSchemeBackgroundColor:'#181a1b',darkSchemeTextColor:'#e8e6e3',lightSchemeBackgroundColor:'#fff',lightSchemeTextColor:'#181a1b',mode:1,brightness:100,contrast:100,grayscale:0,sepia:0})});await page.waitForTimeout(100);
  assert.notEqual(await page.locator('#mail').evaluate(e=>e.style.backgroundColor),'white');
  await page.evaluate(()=>document.querySelector('#mail').insertAdjacentHTML('beforeend','<section>'+Array.from({length:10000},()=>'<p style="background:white;color:#111">Late huge body</p>').join('')+'</section>'));await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(()=>mailTheme.stats.limitHit),true);assert.equal(await page.locator('#mail').evaluate(e=>e.style.backgroundColor),'white');assert.equal(await page.locator('#mail p').first().evaluate(e=>e.style.color),'rgb(17, 17, 17)');
  console.log('PASS actual upstream mail-scope theme and whole-original large-mail fallback',stats,folder);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
