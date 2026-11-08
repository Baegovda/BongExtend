// Screenshot-derived shopping layout, not a capture or test of the blocked Taobao site.
const {chromium}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
(async()=>{
 const {withTranslationColors}=await import(pathToFileURL(path.resolve('src/modules/dark/site-fixes.js')));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-shopping-prism-'));
 try{
  for(const dark of [false,true]){
   const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(`<style>
    body{margin:28px;font:17px/28px Arial,sans-serif;background:#fff;color:#222}
    main{display:grid;grid-template-columns:250px 1fr;gap:24px} aside{background:#f5f5f5;padding:12px;border-radius:14px}
    .row{height:28px;display:flex;align-items:center;gap:10px;overflow:hidden}.label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .row .label{-webkit-text-fill-color:currentColor!important} .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    article{height:82px;overflow:hidden;background:#eee;padding:10px;border-radius:12px}
    article p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin:0;font-size:16px;line-height:24px}
    #sample{font:30px/48px monospace;white-space:pre;margin:12px 0;color:#222}
   </style><p id="sample">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p><main><aside>${Array.from({length:10},(_,i)=>`<div class="row"><i>◇</i><span class="label">服装家居数码新品 ${i}</span></div>`).join('')}</aside><div class="cards">${Array.from({length:21},(_,i)=>`<article><p>官方旗舰店新款商品 ${i}</p></article>`).join('')}</div></main>`);
   if(dark){await page.addScriptTag({path:'node_modules/darkreader/darkreader.js'});await page.evaluate(fixes=>DarkReader.enable({brightness:100,contrast:100},fixes),withTranslationColors({disableInlineScriptInjection:true,disableStyleSheetsProxy:true}));}
   await page.addScriptTag({path:'src/modules/trans/content/content.js'});
   await page.evaluate(async()=>{
    let clock=0;const frames=[];
    const originalRows=[...document.querySelectorAll('.row')].map(e=>e.getBoundingClientRect().height);
    const session=__pageTranslator.createSession({root:document.body,enableBanner:false,prefersReducedMotion:false,now:()=>clock,
     requestAnimationFrame:fn=>(frames.push(fn),frames.length),sendBatch:async texts=>({ok:true,translations:texts.map(t=>t.startsWith('ABC')?'가나다라마바사아자차카타파하가나다라마바사아자차카타파하':'여성의류 생활가구 디지털 신상품 무료 배송 특가 '+t.match(/\d+/)?.[0])})});
    session.start();await session.whenIdle();
    window.advancePrism=t=>{clock=t;for(const f of frames.splice(0))f(t);};
    window.originalRows=originalRows;window.testSession=session;
    advancePrism(0);
   });
   const baseline=await page.evaluate(()=>{
    const boxes=[...document.querySelectorAll('.pt-page-translator-sweep')];
    const box=boxes.find(b=>b.querySelector('.pt-prev').textContent.startsWith('ABC'));
    const r=document.createRange();r.selectNodeContents(document.getElementById('sample').firstChild);const ink=r.getBoundingClientRect();
    return {boxCount:boxes.length,waiting:[...document.querySelectorAll('article p')].filter(e=>/[\u4e00-\u9fff]/.test(e.textContent)).length,
     sample:{x:ink.x,y:ink.y,width:ink.width,height:ink.height},nativeFill:getComputedStyle(document.querySelector('.row .label.pt-page-translator-hold')).webkitTextFillColor};
   });
   assert.ok(baseline.waiting>0,'overflow must remain original instead of popping into Korean');assert.ok(baseline.boxCount<=16);assert.equal(baseline.nativeFill,'rgba(0, 0, 0, 0)');
   const prefix=path.join(folder,dark?'dark':'light');
   await page.screenshot({path:prefix+'-original.png'});
   await page.evaluate(()=>advancePrism(500));
   await page.screenshot({path:prefix+'-mid.png'});
   const beam=await page.evaluate(()=>{const box=[...document.querySelectorAll('.pt-page-translator-sweep')].find(b=>b.querySelector('.pt-prev').textContent.startsWith('ABC'));const r=box.querySelector('.pt-sweep-edge').getBoundingClientRect();return r.x+r.width/2;});
   await page.evaluate(()=>{for(let wave=1;wave<=5;wave++){advancePrism(wave*1300);advancePrism(wave*1300);}});
   await page.screenshot({path:prefix+'-done.png'});
   const state=await page.evaluate(()=>({left:document.querySelectorAll('.pt-page-translator-sweep,.pt-page-translator-hold,.pt-page-translator-pending').length,
    rows:[...document.querySelectorAll('.row')].map(e=>e.getBoundingClientRect().height),source:[...document.querySelectorAll('.label,article p')].some(e=>/[\u4e00-\u9fff]/.test(e.textContent)),
    fills:[...document.querySelectorAll('.label')].every(e=>getComputedStyle(e).webkitTextFillColor!=='rgba(0, 0, 0, 0)')}));
   assert.equal(state.left,0);assert.equal(state.source,false);assert.equal(state.fills,true);assert.ok(state.rows.every(h=>h===28));assert.deepEqual(errors,[]);
   const pixels=JSON.parse(execFileSync('python',['-c',`from PIL import Image
import sys,json
a,b,c=[Image.open(p).convert('RGB') for p in sys.argv[1:4]]
x,y,w,h,beam=map(float,sys.argv[4:]);pastel=total=changed=front=0
for py in range(int(y)+5,int(y+h)-4):
 for px in range(max(0,int(beam)-55),int(beam)-22):
  ref=c.getpixel((px,py));rgb=b.getpixel((px,py))
  if max(ref)-min(ref)<8:
   bg=c.getpixel((px,max(0,int(y)-3)))
   if max(abs(ref[i]-bg[i]) for i in range(3))>70:
    total+=1
    if min(rgb)>110 and max(rgb)-min(rgb)>20:pastel+=1
 for px in range(int(beam)+24,min(a.width,int(x+w))):
  front+=1
  if max(abs(a.getpixel((px,py))[i]-b.getpixel((px,py))[i]) for i in range(3))>6:changed+=1
print(json.dumps({'pastel':pastel,'glyphPixels':total,'changedAhead':changed,'aheadPixels':front}))`,prefix+'-original.png',prefix+'-mid.png',prefix+'-done.png',...Object.values(baseline.sample).map(String),String(beam)],{encoding:'utf8'}));
   assert.ok(pixels.glyphPixels>20);assert.ok(pixels.pastel/pixels.glyphPixels>.5,'freshly revealed glyphs must be pastel, not the normal ink');
   assert.ok(pixels.changedAhead/Math.max(1,pixels.aheadPixels)<.015,'the area ahead of the beam must still show the original');
   console.log('PASS',dark?'dark':'light',JSON.stringify(pixels));await page.close();
  }
  console.log('screenshots',folder);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
