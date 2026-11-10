// Local diagnostics only; not a Smartstore DOM reproduction or shopping action.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-nested-surfaces-')),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.setContent(`<body style="font:16px Arial;background:white;color:#222"><style>.box{background:white;border:1px solid #ddd;padding:12px;margin:8px}.rounded{border-radius:8px}#divider{border:0;border-bottom:1px solid #ddd}#low{border-color:white}#clear{border-color:#333}</style><section id="frame" class="box"><h2>로컬 중첩 면 진단</h2><div id="flat" class="box">가격/안내<div id="nested" class="box">옵션 영역</div></div><div id="divider" class="box">한쪽 구분선</div><div id="low" class="box rounded">낮은 대비의 라운드 카드</div><div id="clear" class="box rounded">이미 보이는 경계의 라운드 카드</div></section>`);
  await page.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
  const fixes=await import(require('node:url').pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')).href);
  await page.evaluate(f=>DarkReader.enable({},f),fixes.withTranslationColors());await page.waitForTimeout(250);
  const sample=()=>page.locator('.box').evaluateAll(es=>es.map(e=>({id:e.id,border:getComputedStyle(e).borderTopColor,bg:getComputedStyle(e).backgroundColor,outline:getComputedStyle(e).outline,owned:e.getAttribute('data-bong-contrast-owned')})));
  const baseline=await sample();await page.screenshot({path:path.join(folder,'baseline.png')});
  await page.addScriptTag({content:fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+';window.contrast=createContrastController(document);contrast.start()'});await page.waitForTimeout(350);
  const helper=await sample();await page.screenshot({path:path.join(folder,'helper.png')});await page.evaluate(()=>contrast.stop());
  const stopped=await sample();
  fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({baseline,helper,stopped},null,2));
  for(const id of ['frame','flat','nested','divider','clear']) assert.deepEqual(helper.find(e=>e.id===id),baseline.find(e=>e.id===id),id+' preserved');
  assert.match(helper.find(e=>e.id==='low').outline,/solid/,'low-contrast rounded card strengthened');
  assert.equal(helper.find(e=>e.id==='low').bg,baseline.find(e=>e.id==='low').bg,'card fill preserved');
  assert.deepEqual(stopped,baseline,'helper stop restores upstream');
  await page.evaluate(()=>DarkReader.disable());await page.waitForTimeout(100);
  assert.equal(await page.locator('#low').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await page.locator('[data-bong-contrast-owned]').count(),0);
  console.log(JSON.stringify({result:'PASS',preserved:5,strengthened:1,stopAndOffRestored:true,folder}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
