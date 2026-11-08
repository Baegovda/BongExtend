// Isolated development profile and locally generated files; never opens the user's browser profile.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-download-list-')),server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'application/octet-stream'});res.end('local fixture');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:980,height:740}});
 try{
  const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.join(folder,'files')});
  const {id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve('.output/chrome-mv3')});const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(async port=>{await chrome.storage.local.set({'core.popupTab':'download','core.chronoPopup':'/recent-downloads.html','core.update:autoCheck':false});for(const filename of ['BongExtend-test.zip','image.webp','readme.txt'])await chrome.downloads.download({url:`http://127.0.0.1:${port}/${filename}`,filename,saveAs:false});},port);
  const page=await context.newPage();await page.goto(`chrome-extension://${id}/popup.html`);const frame=page.frameLocator('#chronoPopupFrame');await frame.locator('.download-row').nth(2).waitFor();
  await page.waitForFunction(()=>{const doc=document.querySelector('#chronoPopupFrame').contentDocument;return [...doc.querySelectorAll('.download-icon')].length===3&&[...doc.querySelectorAll('.download-icon')].every(img=>img.src.startsWith('data:image'));});
  assert.equal(await frame.locator('table,aside').count(),0);assert.equal(await page.locator('.download-module-toolbar').isVisible(),false);assert.equal(await frame.locator('#manager').isVisible(),true);
  await frame.locator('#searchToggle').click();await frame.locator('#search').fill('image');assert.equal(await frame.locator('.download-row').count(),1);await frame.locator('#search').fill('');await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-frame=download]')).opacity==='1');
  await page.screenshot({path:path.join(folder,'list-real-icons.png')});console.log('PASS actual Chrome downloads, OS file icons, list-only shell and search;',folder);
 }finally{await context.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
