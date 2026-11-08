// Test the actual nested frames inside the BongExtend shell, not just standalone engine pages.
const {chromium}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'be-downloader-shell-')),ext=path.join(temp,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 const ctx=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1000,height:760}});
 try{
  const cdp=await ctx.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:ext});
  const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.popupTab':'download','core.update:autoCheck':false}));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`chrome-extension://${id}/popup.html`);
  const frame=page.frameLocator('#chronoPopupFrame');
  await frame.locator('#dlist_wrap').waitFor({state:'attached'});
  const size=await page.locator('#chronoPopupFrame').boundingBox();console.log('frame size',size);
  if(!process.env.BASELINE)assert.ok(size.height>300,'the nested downloader frame must not collapse to zero height');
  if(process.env.BASELINE)return;
  assert.match(await page.locator('[data-tab=download]').innerText(),/다운로더/);
  await frame.locator('#dlist_btn_manager').waitFor({state:'visible'});
  await page.screenshot({path:path.join(temp,'recent.png')});
  await page.locator('[data-download-view="/ui/options.html"]').click();
  await frame.locator('input:visible').first().waitFor();
  assert.ok((await page.locator('#chronoPopupFrame').boundingBox()).height>300);
  const count=await frame.locator('input:visible').count();assert.ok(count>2,'settings must render usable controls');
  const box=frame.locator('input[type=checkbox]:visible').first();const checked=await box.isChecked();await box.setChecked(!checked);assert.equal(await box.isChecked(),!checked);
  await page.waitForFunction(()=>{const doc=document.querySelector('#chronoPopupFrame').contentDocument;return getComputedStyle(doc.querySelector('.mainview > .selected')).opacity==='1' && doc.querySelector('.mainview').getBoundingClientRect().height>300;});
  await page.screenshot({path:path.join(temp,'settings.png')});
  await page.locator('[data-download-view="/ui/index.html"]').click();await frame.locator('#dy_tbar_add').waitFor({state:'visible'});
  await frame.locator('.loading-overlay').waitFor({state:'hidden'});
  await page.screenshot({path:path.join(temp,'manager.png')});
  await page.locator('[data-download-view="/pop/pop.html"]').click();await frame.locator('#dlist_btn_manager').waitFor({state:'visible'});
  await page.emulateMedia({colorScheme:'dark'});
  await page.locator('[data-download-view="/ui/options.html"]').click();await frame.locator('input:visible').first().waitFor();
  await page.waitForFunction(()=>{const doc=document.querySelector('#chronoPopupFrame').contentDocument;return getComputedStyle(doc.querySelector('.mainview > .selected')).opacity==='1';});
  assert.notEqual(await frame.locator('.mainview section:visible').first().evaluate(e=>getComputedStyle(e).color),'rgb(0, 0, 0)','settings sections stay readable in dark mode');
  await page.screenshot({path:path.join(temp,'settings-dark.png')});
  assert.deepEqual(errors,[]);console.log('PASS recent list, settings controls, manager and return navigation inside the downloader tab');console.log('screenshots',temp);
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
