// Disposable Chrome profile and synthetic rates; does not access the user's browser.
const {chromium}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-all-fx-')),extension=path.join(folder,'extension');
 fs.cpSync('.output/chrome-mv3',extension,{recursive:true});
 const fixture={date:'2026-11-09',krw:{krw:1,usd:0.0007,eur:0.0006,jpy:0.11,cny:0.005,gbp:0.0005,btc:0.00000001,eth:0.0000002,nzd:0.001,aed:0.002,sol:0.000003}};
 const mock=`const realFetch=fetch;globalThis.fetch=(url,options)=>String(url).includes('currency-api.pages.dev')?Promise.resolve(new Response(JSON.stringify(${JSON.stringify(fixture)}))):String(url).includes('scanner.tradingview.com')?Promise.reject(Error('fixture')):realFetch(url,options);`;
 const background=path.join(extension,'background.js');fs.writeFileSync(background,mock+fs.readFileSync(background,'utf8'));
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:780,height:590},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  await context.addInitScript({content:mock});
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:extension});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async()=>{
   await chrome.storage.local.set({'core.update:autoCheck':false,'core.popupTab':'fx','fx.favorites':['keep-me'],'fx.table':{base:'krw',date:'2026-11-09',fetchedAt:Date.now()+3600000,rates:{krw:1,usd:0.0007,eur:0.0006,jpy:0.11,cny:0.005,gbp:0.0005,btc:0.00000001,eth:0.0000002,nzd:0.001,aed:0.002,sol:0.000003}}});
  });
  await context.addInitScript(()=>{globalThis.WebSocket=class{constructor(){this.readyState=0;}close(){}};});
  const page=await context.newPage();await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForFunction(()=>document.querySelectorAll('#fxMore [data-code]').length===8);
  await page.locator('#fxManageCurrencies').click();await page.locator('#fxCurrencySearch').fill('뉴질랜드');
  assert.equal(await page.locator('#fxCurrencyList input').count(),1);
  await page.locator('[data-currency="nzd"]').check();await page.locator('#fxPickerApply').click();
  await page.locator('#fxMore [data-code="nzd"]').waitFor();
  await page.locator('#fxManageCurrencies').click();await page.locator('#fxCurrencySearch').fill('solana');await page.locator('[data-currency="sol"]').check();await page.locator('#fxPickerApply').click();
  await page.reload();await page.locator('#fxMore [data-code="sol"]').waitFor();
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('fx.favorites'))['fx.favorites'][0]),'keep-me');
  await page.locator('#fxManageCurrencies').click();await page.locator('#fxSelectAll').click();await page.locator('#fxPickerApply').click();
  assert.equal(await page.locator('#fxMore [data-code]').count(),11);
  await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(folder,'all-currencies-dark.png')});
  await page.locator('#fxManageCurrencies').click();await page.locator('#fxCurrencySearch').fill('aed');await page.screenshot({path:path.join(folder,'currency-search.png')});
  await page.locator('#fxSelectNone').click();await page.locator('#fxPickerApply').click();assert.equal(await page.locator('#fxMore [data-code]').count(),0);
  await page.locator('#fxManageCurrencies').click();await page.locator('[data-currency="aed"]').check();await page.locator('#fxPickerApply').click();
  await page.locator('#fxMore [data-code="aed"]').click();assert.equal(await page.locator('#fxTo').inputValue(),'aed');
  const catalog=JSON.parse(fs.readFileSync('src/modules/fx/currency-names.js','utf8').split('export const CURRENCY_NAMES = ')[1].trim().replace(/;$/,''));
  await worker.evaluate(async codes=>{const rates=Object.fromEntries(codes.map(code=>[code,code==='krw'?1:0.001]));await chrome.storage.local.set({'fx.table':{base:'krw',date:'2026-11-09',fetchedAt:Date.now()+3600000,rates}});},Object.keys(catalog));
  await page.reload();await page.locator('#fxManageCurrencies').click();await page.locator('#fxSelectAll').click();await page.locator('#fxPickerApply').click();
  assert.equal(await page.locator('#fxMore [data-code]').count(),Object.keys(catalog).length);
  await page.locator('#fxMore [data-code]').last().scrollIntoViewIfNeeded();
  console.log('PASS complete catalog renders and scrolls:',Object.keys(catalog).length);
  console.log('PASS all-currency fixture: Korean/English/code search, multi-select, all/none, persistence, preserved favorites, card conversion, scrolling and dark UI;',folder);
  // Headless Chrome has no action toolbar; attached sizing is verified on the popup document by the reader fixture.
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
