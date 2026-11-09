// Anonymous public source-helper test. Resource bridge simulates the proposed
// permission-checked extension relay; it is NOT proof of product integration.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-malltail-icons-'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1600}});
  page.on('console',m=>{if(m.text().startsWith('ICON-DECODE:'))console.log(m.text())});
  await page.goto('https://post.malltail.com/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);
  const original=await page.locator('.hotdeal-feature-card__image').evaluate(e=>({url:e.currentSrc,natural:e.naturalWidth}));
  await page.screenshot({path:path.join(folder,'before.png')});
  await page.exposeFunction('publicResource',async url=>{
   const host=new URL(url).hostname;if(!/(^|\.)malltail\.com$/.test(host))throw Error('Public fixture host only');
   const response=await fetch(url,{credentials:'omit',redirect:'error'});const data=await response.arrayBuffer();if(data.byteLength>1048576)throw Error('Test resource too large');
   return {data:Buffer.from(data).toString('base64'),type:response.headers.get('content-type')};
  });
  await page.addScriptTag({content:fs.readFileSync('node_modules/darkreader/darkreader.js','utf8')});
  await page.evaluate(()=>{window.fetchPublic=async url=>{const r=await publicResource(url);return new Response(Uint8Array.from(atob(r.data),c=>c.charCodeAt(0)),{headers:{'content-type':r.type}})};DarkReader.setFetchMethod(fetchPublic);DarkReader.enable({}, {ignoreImageAnalysis:['*'],disableInlineScriptInjection:true,ignoreInlineStyle:['[data-bong-icon-owned="1"]','[data-bong-contrast-owned="1"]']})});
  await page.waitForTimeout(2500);
  const helpers=fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/modules/dark/icon-contrast.js','utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'').replace('catch {return null;} finally','catch(error){console.log("ICON-DECODE:",error.message);return null;} finally');
  await page.addScriptTag({content:helpers+';window.icons=createIconContrastController(document,()=>contrast.update(),{fetchImage:fetchPublic});window.contrast=createContrastController(document,{inspectImage:icons.inspect});icons.start();contrast.start();'});
  await page.waitForFunction(()=>document.querySelector('.malltail-logo[data-bong-icon-owned]')&&document.querySelectorAll('.header-icon[data-bong-icon-owned]').length>=3,null,{timeout:15000});
  const repaired=await page.locator('[data-bong-icon-owned]').count();assert.ok(repaired>=4);
  const pixels=await page.locator('.malltail-logo[data-bong-icon-owned]').first().evaluate(async el=>{
   const read=async blob=>{const url=URL.createObjectURL(blob);try{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,c.width,c.height).data}finally{URL.revokeObjectURL(url)}};
   const original=await read(await(await fetchPublic('https://cdn.malltail.com/goods_img/contents/index/header_logo2025_D.svg')).blob());
   const repaired=await read(await(await fetch(el.style.backgroundImage.slice(5,-2))).blob());let changed=0,brand=0,alphaDifferences=0,brandDifferences=0,maxAlphaDelta=0;
   for(let i=0;i<original.length;i+=4){
    if(original[i+3]!==repaired[i+3]){alphaDifferences++;maxAlphaDelta=Math.max(maxAlphaDelta,Math.abs(original[i+3]-repaired[i+3]));}
    const colored=Math.max(...original.slice(i,i+3))-Math.min(...original.slice(i,i+3))>25;
    if(colored){brand++;if(original.slice(i,i+4).some((v,j)=>v!==repaired[i+j]))brandDifferences++;}
    else if(original.slice(i,i+3).some((v,j)=>v!==repaired[i+j]))changed++;
   }return{changed,brand,alphaDifferences,brandDifferences,maxAlphaDelta};
  });assert.ok(pixels.changed>100);assert.ok(pixels.brand>100);
  assert.equal(pixels.alphaDifferences,0);assert.equal(pixels.brandDifferences,0);
  const photo=await page.locator('.hotdeal-feature-card__image').evaluate(e=>({url:e.currentSrc,natural:e.naturalWidth,filter:getComputedStyle(e).filter,opacity:getComputedStyle(e).opacity}));
  assert.equal(photo.url,original.url);assert.equal(photo.natural,original.natural);assert.equal(photo.filter,'none');assert.equal(photo.opacity,'1');
  await page.screenshot({path:path.join(folder,'source-helpers-dark.png')});
  await page.evaluate(()=>{icons.stop();contrast.stop();DarkReader.disable()});assert.equal(await page.locator('[data-bong-icon-owned]').count(),0);
  await page.screenshot({path:path.join(folder,'off.png')});console.log('PASS public SVG source helper:',{repaired,pixels,photo},folder);
  await page.evaluate(async()=>{
   document.body.style.backgroundColor='#181a1b';
   for(const content of ['<script>alert(1)</script>','<image href="https://example.com/photo.png"/>','<style>path{fill:black}</style>','<path fill="url(https://example.com/a.svg#p)"/>']){
    const button=document.createElement('button');button.style.cssText='background:#181a1b;border:0';button.innerHTML='<span style="display:block;width:28px;height:28px;background-image:url(https://cdn.malltail.com/invalid-static-test.svg)"></span>';document.body.append(button);const glyph=button.firstElementChild;
    const bad=createIconContrastController(document,()=>{}, {fetchImage:async()=>new Response('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">'+content+'</svg>',{headers:{'content-type':'image/svg+xml'}})});
    bad.start();bad.inspect(glyph);await new Promise(r=>setTimeout(r,60));if(glyph.hasAttribute('data-bong-icon-owned'))throw Error('Unsafe SVG accepted');bad.stop();button.remove();
   }
  });console.log('PASS unsafe SVG content/reference rejection');
  await page.evaluate(async()=>{
   const text='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><defs><mask id="m" maskUnits="userSpaceOnUse"><rect width="40" height="40" fill="white"/><rect x="10" y="10" width="8" height="8" fill="black"/></mask><clipPath id="c"><rect x="2" y="2" width="28" height="28" fill="black"/></clipPath></defs><path fill="black" mask="url(#m)" clip-path="url(#c)" d="M4 4h24v24H4z"/></svg>';
   const button=document.createElement('button');button.style.cssText='background:#181a1b;border:0';button.innerHTML='<span style="display:block;width:40px;height:40px;background-image:url(https://cdn.malltail.com/mask-test.svg)"></span>';document.body.append(button);const glyph=button.firstElementChild;
   const masked=createIconContrastController(document,()=>{}, {fetchImage:async()=>new Response(text,{headers:{'content-type':'image/svg+xml'}})});masked.start();masked.inspect(glyph);
   for(let i=0;i<20&&!glyph.hasAttribute('data-bong-icon-owned');i++)await new Promise(r=>setTimeout(r,50));
   if(!glyph.hasAttribute('data-bong-icon-owned'))throw Error('Masked static glyph not repaired');
   const after=new DOMParser().parseFromString(atob(glyph.style.backgroundImage.slice(5,-2).split(',')[1]),'image/svg+xml');
   const before=new DOMParser().parseFromString(text,'image/svg+xml');
   if(new XMLSerializer().serializeToString(before.querySelector('defs'))!==new XMLSerializer().serializeToString(after.querySelector('defs')))throw Error('Mask/clip paint changed');
   if(after.querySelector('svg > path').getAttribute('fill')==='black')throw Error('Visible glyph not repaired');
   masked.stop();button.remove();
  });console.log('PASS mask/clip definition preservation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
