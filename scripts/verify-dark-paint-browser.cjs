// Disposable synthetic paint-order tests. No account or personal browser access.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-paint-guard-'));
 const source=fs.readFileSync('src/modules/dark/paint-guard.js','utf8').replace(/export /g,'');
 const dr=fs.readFileSync('node_modules/darkreader/darkreader.js','utf8');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:800,height:600}});
 const markup=(extra='',root='',body='',frame=true)=>`<html style="${root}"><body style="margin:0;${body}"><header style="height:50px;background:green">Header</header><aside style="width:150px;height:550px;background:gray">Sidebar</aside>${frame?'<iframe style="position:absolute;left:150px;top:50px;width:600px;height:500px;z-index:-1;border:0" srcdoc="<body style=\'background:white;color:black\'><h1>FRAME CONTENT</h1></body>"></iframe>':''}${extra}</body></html>`;
 const setup=async(html)=>{
  await page.goto('about:blank');await page.setContent(html);await page.waitForTimeout(150);
  await page.addScriptTag({content:source+';window.guard=createPaintGuard(document);window.prepared=guard.prepare();'});
  for(const frame of page.frames())await frame.addScriptTag({content:dr});
 };
 const enable=async()=>{for(const frame of page.frames())await frame.evaluate(()=>DarkReader.enable());await page.waitForTimeout(350)};
 const stop=async()=>{await page.evaluate(()=>guard.stop());for(const frame of page.frames())await frame.evaluate(()=>{if(typeof DarkReader!=='undefined')DarkReader.disable()});await page.waitForTimeout(100)};
 const checkUnrelatedAnimations=async()=>{
  await page.evaluate(()=>{const node=document.createElement('span');node.id='unrelatedAnimation';node.textContent='Animation';document.body.append(node)});await page.waitForTimeout(150);
  const result=await page.evaluate(async()=>{
   let queries=0,rects=0;
   const originalElement=Element.prototype.querySelectorAll,originalDocument=Document.prototype.querySelectorAll,originalRect=Element.prototype.getBoundingClientRect;
   Element.prototype.querySelectorAll=function(selector){if(selector==='iframe')queries++;return originalElement.call(this,selector)};
   Document.prototype.querySelectorAll=function(selector){if(selector==='iframe')queries++;return originalDocument.call(this,selector)};
   Element.prototype.getBoundingClientRect=function(){if(this.tagName==='IFRAME')rects++;return originalRect.call(this)};
   try{
    for(let i=0;i<20;i++){document.getElementById('unrelatedAnimation').style.transform=`rotate(${i}deg)`;await new Promise(r=>setTimeout(r,20));}
    await new Promise(r=>setTimeout(r,100));return {queries,rects};
   }finally{Element.prototype.querySelectorAll=originalElement;Document.prototype.querySelectorAll=originalDocument;Element.prototype.getBoundingClientRect=originalRect}
  });
  assert.deepEqual(result,{queries:0,rects:0},'unrelated style animation must not scan or measure frames');
 };
 const brightPixels=async buffer=>page.evaluate(async data=>{
  const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(155,55,500,100).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>500)count++;return count;
 },buffer.toString('base64'));
 try{
  await setup(markup());assert.equal(await page.evaluate(()=>prepared),true);await enable();
  const hidden=await page.screenshot({path:path.join(folder,'negative-dark-hidden.png')});
  assert.ok(await brightPixels(hidden)<20,'engine canvas hides negative frame');
  await page.evaluate(()=>guard.start());await page.waitForTimeout(300);
  const restored=await page.screenshot({path:path.join(folder,'negative-dark-restored.png')});
  assert.ok(await brightPixels(restored)>100,'both-themed iframe text pixels must be visible');
  assert.match(await page.frames()[1].locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),/24, 26, 27/);
  assert.equal(await page.locator('iframe').evaluate(e=>getComputedStyle(e).zIndex),'-1');
  await checkUnrelatedAnimations();
  await stop();assert.equal(await page.locator('body').evaluate(e=>e.style.backgroundColor),'');
  assert.equal(await page.locator('html').evaluate(e=>e.style.backgroundColor),'');
  await page.screenshot({path:path.join(folder,'negative-off.png')});
  // The page can replace an owned property; stopping must preserve that new value.
  await page.evaluate(()=>guard.prepare());await enable();await page.evaluate(()=>guard.start());await page.waitForTimeout(200);
  await page.locator('body').evaluate(e=>e.style.setProperty('background-color','rgb(60, 70, 80)','important'));await page.waitForTimeout(200);
  await page.evaluate(()=>guard.stop());assert.equal(await page.locator('body').evaluate(e=>e.style.backgroundColor),'rgb(60, 70, 80)');
  for(const [root,body] of [['background:white',''],['','background:white']]){
   await setup(markup('',root,body));assert.equal(await page.evaluate(()=>prepared),false);await enable();await page.evaluate(()=>guard.start());await page.waitForTimeout(100);
   assert.notEqual(await page.locator('body').evaluate(e=>e.style.getPropertyPriority('background-color')),'important');await stop();
  }
  await setup(markup('','','',false));await enable();await page.evaluate(()=>guard.start());await page.waitForTimeout(150);
  assert.equal(await page.locator('html').evaluate(e=>e.style.backgroundColor),'');await checkUnrelatedAnimations();await stop();
  await setup(markup('','','',false));await enable();await page.evaluate(()=>guard.start());
  await page.evaluate(()=>{
   const iframe=document.createElement('iframe');iframe.style.cssText='position:absolute;left:150px;top:50px;width:600px;height:500px;z-index:-1;border:0';iframe.srcdoc='<body>Dynamic frame</body>';document.body.append(iframe);
  });await page.waitForTimeout(250);
  assert.equal(await page.locator('html').evaluate(e=>e.style.backgroundColor),'transparent');
  await page.locator('iframe').evaluate(e=>e.hidden=true);await page.waitForTimeout(150);
  assert.equal(await page.locator('html').evaluate(e=>e.style.backgroundColor),'');await stop();
  await setup(markup('<div style="position:fixed;inset:0;background:#555;z-index:2">Intentional cover</div>'));await enable();await page.evaluate(()=>guard.start());await page.waitForTimeout(150);
  assert.equal(await page.locator('html').evaluate(e=>e.style.backgroundColor),'');await stop();
  await setup(markup());await page.locator('iframe').evaluate(e=>e.hidden=true);await enable();await page.evaluate(()=>guard.start());await page.waitForTimeout(150);
  assert.equal(await page.locator('html').evaluate(e=>e.style.backgroundColor),'');assert.equal(await page.locator('iframe').evaluate(e=>getComputedStyle(e).display),'none');await stop();
  console.log('PASS paint guard: parent/child dark pixels, OFF restore, site inline replacement, opaque roots, no frame, overlay and hidden frame protections.',folder);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
