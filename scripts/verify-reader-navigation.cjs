// Source-only navigation fixture: no extension build, mailbox, or personal browser.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();await page.route('https://reader.test/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><textarea id="draft">작성 중인 답장</textarea><iframe id="body" sandbox="allow-same-origin" srcdoc="<p>메일 본문</p>"></iframe>'}));await page.goto('https://reader.test/');
  await page.addScriptTag({path:'public/js/bongextend-reader-zoom.js'});
  await page.evaluate(()=>{window.marker=123;window.openReader=true;window.closes=0;window.navigationTest=BongExtendReaderZoom.navigation({isOpen:()=>openReader,back:()=>{openReader=false;closes++;}});navigationTest.addDocument(document.querySelector('iframe').contentDocument);navigationTest.sync();});
  const cdp=await page.context().newCDPSession(page);
  const mouseBack=async(x,y)=>{await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'back',buttons:8,x,y});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'back',buttons:0,x,y});};
  await mouseBack(30,30);assert.equal(await page.evaluate(()=>closes),1);assert.equal(await page.locator('#draft').inputValue(),'작성 중인 답장');assert.equal(page.url(),'https://reader.test/');
  // Allow the duplicate-event suppression window to expire before a new gesture.
  await page.waitForTimeout(550);await page.evaluate(()=>{openReader=true;navigationTest.sync();});
  const rect=await page.locator('#body').boundingBox();await mouseBack(rect.x+20,rect.y+20);assert.equal(await page.evaluate(()=>closes),2);assert.equal(await page.evaluate(()=>marker),123);
  await page.evaluate(()=>{openReader=true;navigationTest.sync();history.back();});await page.waitForFunction(()=>closes===3);assert.equal(await page.locator('#draft').inputValue(),'작성 중인 답장');assert.equal(page.url(),'https://reader.test/');
  await page.evaluate(()=>{openReader=true;navigationTest.sync();openReader=false;openReader=true;navigationTest.sync();history.back();});await page.waitForFunction(()=>closes===4);
  for(let i=0;i<3;i++)await page.evaluate(()=>{openReader=true;navigationTest.sync();openReader=false;});
  await page.evaluate(()=>{openReader=true;navigationTest.sync();});await page.goBack({waitUntil:'commit'});await page.waitForFunction(()=>closes===5);assert.equal(await page.evaluate(()=>marker),123);
  // Module switches are represented by hiding the mail iframe, as in the real shell.
  await page.evaluate(()=>navigationTest.stop());
  const mail=page.frames().find(frame=>frame.parentFrame());
  // The body is scriptless, so use a separate same-origin module frame for registration.
  await page.evaluate(()=>{const frame=document.createElement('iframe');frame.id='mail-module';frame.srcdoc='<p>메일 모듈</p>';document.body.append(frame);});
  const moduleFrame=page.frames().find(frame=>frame!==page.mainFrame()&&frame!==mail);await moduleFrame.waitForLoadState();await moduleFrame.addScriptTag({path:'public/js/bongextend-reader-zoom.js'});
  await moduleFrame.evaluate(()=>{window.readerOpen=true;window.closeCount=0;window.nav=BongExtendReaderZoom.navigation({isOpen:()=>readerOpen,back:()=>{readerOpen=false;window.closeCount++;}});nav.sync();});
  await page.evaluate(()=>document.getElementById('mail-module').hidden=true);await page.goBack({waitUntil:'commit'});assert.equal(await moduleFrame.evaluate(()=>readerOpen),true);
  await page.evaluate(()=>document.getElementById('mail-module').hidden=false);await page.waitForFunction(()=>history.state?.beReaderNavigation===true);await page.goBack({waitUntil:'commit'});await moduleFrame.waitForFunction(()=>!readerOpen);assert.equal(page.url(),'https://reader.test/');
  console.log('PASS auxiliary host/sandbox back, history/page.goBack, repeated close/reopen, hidden module switch, unchanged URL/marker/draft');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
