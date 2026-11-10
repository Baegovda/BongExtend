// Local synthetic carousel. No logged-in Naver page or private profile.
const {chromium}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-dark-arrows-')),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:900,height:500}});
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M15 4L7 12L15 20" fill="none" stroke="#333333" stroke-width="2"/></svg>',data='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  await page.setContent(`<html data-darkreader-scheme="dark"><body style="background:#181a1b;color:#ddd;font:18px Arial"><style>button{width:44px;height:40px;background:#222;border:1px solid #444;border-radius:8px;color:#222;margin:8px}.glyph{display:block;width:24px;height:24px;margin:auto}</style><h2>합성 carousel: 명시 stroke · data SVG</h2><button id="inline"><svg width="24" height="24"><path id="arrowPath" d="M15 4L7 12L15 20" fill="none" stroke="#333333" stroke-width="2"/></svg></button> 3 / 4 <button id="data"><span class="glyph" style="background-image:url('${data}');transform:rotate(180deg)"></span></button><p>보호 상태:</p><button disabled><svg width="24" height="24"><path id="disabledPath" d="M15 4L7 12L15 20" fill="none" stroke="#333333"/></svg></button><button><svg width="24" height="24"><rect id="brand" width="20" height="20" fill="#168be0"/></svg></button><button hidden><svg width="24" height="24"><path id="hiddenPath" d="M15 4L7 12L15 20" stroke="#333333"/></svg></button></body></html>`);
  const before=await page.locator('#arrowPath').getAttribute('stroke');await page.screenshot({path:path.join(folder,'before.png')});
  const source=fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/modules/dark/icon-contrast.js','utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'');
  await page.addScriptTag({content:source+';window.icons=createIconContrastController(document,()=>contrast.update());window.contrast=createContrastController(document,{inspectImage:icons.inspect});icons.start();contrast.start();'});
  await page.waitForFunction(()=>document.querySelector('#data [data-bong-icon-owned]'));
  assert.notEqual(await page.locator('#arrowPath').evaluate(e=>getComputedStyle(e).stroke),'rgb(51, 51, 51)');
  assert.equal(await page.locator('#arrowPath').getAttribute('stroke'),before);
  assert.equal(await page.locator('#brand').evaluate(e=>getComputedStyle(e).fill),'rgb(22, 139, 224)');
  assert.equal(await page.locator('#disabledPath').getAttribute('style'),null);assert.equal(await page.locator('#hiddenPath').getAttribute('style'),null);
  const passes=await page.evaluate(()=>contrast.stats.passes);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>contrast.stats.passes),passes);
  await page.locator('#arrowPath').evaluate(el=>el.setAttribute('stroke','#168be0'));await page.waitForTimeout(200);
  assert.equal(await page.locator('#arrowPath').evaluate(el=>getComputedStyle(el).stroke),'rgb(22, 139, 224)','later semantic SVG paint replaces the neutral repair');
  await page.locator('#arrowPath').evaluate(el=>el.setAttribute('stroke','#333333'));await page.waitForTimeout(200);
  assert.notEqual(await page.locator('#arrowPath').evaluate(el=>getComputedStyle(el).stroke),'rgb(51, 51, 51)');
  await page.screenshot({path:path.join(folder,'dark.png')});await page.evaluate(()=>{icons.stop();contrast.stop()});
  assert.equal(await page.locator('#arrowPath').evaluate(e=>getComputedStyle(e).stroke),'rgb(51, 51, 51)');assert.equal(await page.locator('[data-bong-icon-owned]').count(),0);
  assert.match(await page.locator('#data .glyph').evaluate(e=>e.style.backgroundImage),/data:image\/svg\+xml;base64/);
  console.log('PASS enabled neutral inline/data SVG arrows, brand/disabled/hidden, stable passes and OFF restore',folder);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
