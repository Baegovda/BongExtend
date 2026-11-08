// Real Chrome layout with deterministic local translations; no private pages or API key.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:950}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setContent(`<style>
      body{margin:24px;background:#f0f3f8;color:#233044;font:17px/1.8 Arial,sans-serif}
      main{width:620px;background:#fff;padding:24px;border-radius:16px}
      .case{margin:0 0 12px} #center{text-align:center;padding:8px 26px;font-size:23px;line-height:1.9}
      #wrap{width:245px;padding:12px;border:2px solid #64748b;text-indent:18px;font-size:18px;line-height:2}
      #spaced{font-size:20px;font-variant-numeric:tabular-nums;letter-spacing:2px;word-spacing:5px}
      #inline{color:#b84516;font-size:22px} #scaled{transform:scale(.85);transform-origin:left}
      #clipped{width:240px;height:40px;overflow:auto;border:1px solid #ccd}
      #clipText{width:400px;white-space:nowrap;line-height:40px;margin:0}
      #variable{font-size:19px;font-feature-settings:'kern';font-variant-numeric:tabular-nums;font-weight:650}
      #rtl{direction:rtl;text-align:right;padding:5px 20px;font-size:21px}
    </style><main><p class="case" id="center">Free shipping</p>
    <p class="case" id="wrap">New summer products with free delivery</p>
    <p class="case" id="spaced">Limited sale</p>
    <p class="case">★ <span id="inline">Product</span> · <b id="variable">Available now</b></p>
    <p class="case" id="scaled">Scaled product label</p><p class="case" id="rtl">Right aligned text</p>
    <div id="clipped"><p id="clipText">Special offer</p></div></main>`);
    await page.addScriptTag({content:fs.readFileSync(process.env.CONTENT_SOURCE || 'src/modules/trans/content/content.js','utf8')});
    const result=await page.evaluate(async()=>{
      const translations={'Free shipping':'전국 어디든 무료로 배송해 드려요','New summer products with free delivery':'여름 신상품을 만나보세요. 모든 상품은 무료로 배송하며 빠르고 안전하게 받아보실 수 있어요.',
        'Limited sale':'오늘만 특별 할인','Product':'추천 상품','Available now':'지금 구매할 수 있어요','Scaled product label':'크기가 조정된 상품 이름','Special offer':'기간 한정 특별 할인 상품','Right aligned text':'오른쪽에서 시작하는 번역문'};
      const frames=[]; let clock=0;
      const session=__pageTranslator.createSession({root:document.querySelector('main'),enableBanner:false,prefersReducedMotion:false,
        now:()=>clock,requestAnimationFrame:fn=>(frames.push(fn),frames.length),
        sendBatch:async texts=>({ok:true,translations:texts.map(t=>translations[t] || t)})});
      session.start();await session.whenIdle();
      const advance=t=>{clock=t;for(const fn of frames.splice(0))fn(t);};
      advance(0);advance(980);
      const rect=node=>{const r=document.createRange();r.selectNodeContents(node);const b=r.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,lines:Array.from(r.getClientRects()).map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}))};};
      const boxes=Array.from(document.querySelectorAll('.pt-page-translator-sweep'));
      const during={};
      for(const id of ['center','wrap','spaced','inline','variable','scaled','rtl','clipText']) {
        const element=document.getElementById(id),text=element.firstChild,target=translations[text.nodeValue] || text.nodeValue;
        const box=boxes.find(box=>box.querySelector('.pt-next')?.textContent===target);
        const ink=rect(text),beam=box?.querySelector('.pt-sweep-edge').getBoundingClientRect();
        during[id]={native:ink,overlay:box ? rect(box.querySelector('.pt-next')):null,font:getComputedStyle(element).fontSize,
          beamError:beam ? Math.abs(beam.x+beam.width/2-(ink.x+ink.width/2)):0,
          overlayFont:box ? getComputedStyle(box.querySelector('.pt-next')).fontSize:null,translated:text.nodeValue===target};
      }
      globalThis.geometryFinish=()=>{
        // An image or late paragraph can move a whole batch without firing scroll.
        const before=document.querySelector('main').getBoundingClientRect().y;
        document.querySelector('main').style.marginTop='45px'; advance(1100);
        const shift=document.querySelector('main').getBoundingClientRect().y-before;
        const shifts=boxes.filter(b=>b.isConnected).map(box=>{
          const native=Object.keys(during).map(id=>document.getElementById(id)).find(e=>e.textContent===box.querySelector('.pt-next').textContent);
          return Math.abs(rect(native.firstChild).y-rect(box.querySelector('.pt-next')).y);
        });
        advance(2480);return {shifts,shift,after:Object.fromEntries(Object.keys(during).map(id=>[id,rect(document.getElementById(id).firstChild)]))};
      };
      return {during,overlays:boxes.length};
    });
    const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-geometry-'));
    await page.screenshot({path:path.join(folder,'during.png')});
    const {after,shifts,shift}=await page.evaluate(()=>geometryFinish());
    await page.screenshot({path:path.join(folder,'after.png')});
    const mismatch=[];
    for(const [id,row] of Object.entries(result.during)) {
      if(row.overlay) {
        for(const key of ['x','y','width','height'])if(Math.abs(row.overlay[key]-(after[id][key]-(key==='y'?shift:0)))>1)mismatch.push(`${id} ${key}: effect=${row.overlay[key].toFixed(2)} final=${after[id][key].toFixed(2)}`);
        if(row.overlay.lines.length!==after[id].lines.length)mismatch.push(`${id}: line count differs`);
        else for(let i=0;i<row.overlay.lines.length;i++)for(const key of ['x','y','width','height']) {
          if(Math.abs(row.overlay.lines[i][key]-(after[id].lines[i][key]-(key==='y'?shift:0)))>1)mismatch.push(`${id}: line ${i} ${key} differs`);
        }
        if(row.beamError>1)mismatch.push(`${id}: beam is not at the glyph midpoint (${row.beamError})`);
        if(row.font!==row.overlayFont)mismatch.push(`${id} font: ${row.overlayFont} / ${row.font}`);
      }
      if(!row.translated)mismatch.push(`${id}: translation space is not reserved`);
    }
    if(shifts.some(error=>error>1))mismatch.push('a late layout shift detached the overlay');
    console.log(JSON.stringify({mismatch,overlays:result.overlays,errors,screenshots:folder},null,2));
    if(!process.env.BASELINE){assert.ok(result.overlays>=3);assert.deepEqual(mismatch,[]);assert.deepEqual(errors,[]);}
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
