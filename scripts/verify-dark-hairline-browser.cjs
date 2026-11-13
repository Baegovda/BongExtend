// Disposable Chrome profile; public pages only. No personal browser/account access.
// Checks the generic faint-hairline repair on Naver home + other sites, and exact restore on disable.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const SITES=[
 {name:'naver',url:'https://www.naver.com/',site:'naver.com'},
 {name:'dcinside',url:'https://gall.dcinside.com/board/lists/?id=programming',site:'dcinside.com'},
 {name:'coupang',url:'https://www.coupang.com/',site:'coupang.com'},
 {name:'wikipedia',url:'https://ko.wikipedia.org/wiki/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD',site:'wikipedia.org'}
];
const FIXTURE_CSS='#fxw .b{border:1px solid rgba(140,130,115,0.08);padding:6px;display:inline-block;color:#ddd}'+
 '#fxw .ring{box-shadow:rgba(0,0,0,0.1) 0 0 0 1px;padding:8px;display:inline-block;color:#ddd;border-radius:8px}'+
 '#fxw .tick{position:relative;display:inline-block;width:30px;height:50px;color:#ddd}'+
 '#fxw .tick::before{content:"";position:absolute;left:10px;top:4px;width:1px;height:43px;background:rgba(0,0,0,0.08)}'+
 '#fxw .tab{position:relative;margin-left:20px;display:inline-block;color:#ddd}'+
 '#fxw .tab::before{content:"";position:absolute;left:-10px;top:3px;width:1px;height:15px;background:rgba(0,0,0,0.15)}'+
 '#fxw .dot{position:relative;display:inline-block;margin-left:20px;color:#ddd}'+
 '#fxw .dot::after{content:"";position:absolute;left:-10px;top:5px;width:3px;height:3px;background:rgba(0,0,0,0.15)}'+
 '#fxw .red{border:1px solid rgba(200,30,30,0.1);display:inline-block;color:#ddd}'+
 '#fxw .vis{border:1px solid rgba(255,255,255,0.3);display:inline-block;color:#ddd}';
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-hairline-'));
 const extension=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',extension,{recursive:true});
 const manifestPath=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
 manifest.host_permissions.push('https://*.naver.com/*','https://*.pstatic.net/*','https://*.coupang.com/*','https://*.coupangcdn.com/*','https://*.wikipedia.org/*');fs.writeFileSync(manifestPath,JSON.stringify(manifest));
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:1500,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 const summary=[];
 try{
  const cdp=await context.browser().newBrowserCDPSession();await cdp.send('Extensions.loadUnpacked',{path:extension});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const setSites=sites=>worker.evaluate(s=>chrome.storage.local.set({'core.update:autoCheck':false,'core.darkMode':{enabledSites:s,followSystem:false}}),sites);
  await setSites(SITES.map(s=>s.site));
  for(const site of SITES){
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   try{await page.goto(site.url,{waitUntil:'domcontentloaded',timeout:45000});}catch(e){summary.push(`${site.name}: LOAD FAIL ${e.message.split('\n')[0]}`);await page.close();continue;}
   await page.waitForTimeout(7000);
   const dark=await page.evaluate(()=>document.documentElement.getAttribute('data-darkreader-scheme'));
   if(dark!=='dark'){summary.push(`${site.name}: dark not applied (${dark})`);await page.close();continue;}
   if(site.name==='naver'){
    const m=await page.evaluate(()=>{
     const out={};const cs=(sel,pseudo)=>{const e=document.querySelector(sel);return e?getComputedStyle(e,pseudo||null):null;};
     const c=cs('[class*="DailyBoardView-module__celsius___"]','::before');out.celsius=c&&c.backgroundColor;
     const g=cs('[class*="DailyBoardView-module__info_group___"]');out.infoGroupTop=g&&g.borderTopColor;
     out.tab=[...document.querySelectorAll('[class*="ContentHeaderView-module__tab_item___"]')].map(e=>getComputedStyle(e,'::before').backgroundColor).join('|');
     const l=cs('[class*="Layout-module__content_area___"]');out.cardShadow=l&&l.boxShadow;
     return out;});
    console.log('naver measured',JSON.stringify(m));
    await page.evaluate(css=>{
     document.head.insertAdjacentHTML('beforeend','<style id=fx>'+css+'</style>');
     const w=document.createElement('div');w.id='fxw';w.style.cssText='position:fixed;left:20px;top:120px;z-index:99999;background:rgb(24,26,27);padding:16px';
     w.innerHTML='<button class=b id=fb>logout</button> <span class=ring id=fring>card</span> <span class=tick id=ftick></span> <span class=tab id=ftab>tab</span><span class=dot id=fdot>dot</span> <span class=red id=fred>red</span> <span class=vis id=fvis>visible</span> <hr id=fhr style="border:0;border-top:1px solid rgba(0,0,0,.1);width:200px;margin:8px 0">';
     document.body.append(w);},FIXTURE_CSS);
    await page.waitForTimeout(2500);
    const f=await page.evaluate(()=>{const g=(id,ps)=>getComputedStyle(document.getElementById(id),ps||null);return {
     border:g('fb').borderTopColor,ring:g('fring').boxShadow,tick:g('ftick','::before').backgroundColor,tab:g('ftab','::before').backgroundColor,dot:g('fdot','::after').backgroundColor,red:g('fred').borderTopColor,vis:g('fvis').borderTopColor,hr:g('fhr').borderTopColor};});
    console.log('naver fixtures',JSON.stringify(f));
    const light=/rgba\(255, 255, 255, 0\.\d+\)/;
    assert.match(f.border,light,'border');assert.match(f.ring,light,'ring');assert.match(f.tick,light,'tick');assert.match(f.tab,light,'tab');assert.match(f.dot,light,'dot');assert.match(f.hr,light,'hr');
    assert.match(f.red,/^rgba\(\d+, \d+, \d+, 0\.1\)$/);assert.ok(Number(f.red.match(/\d+/)[0])-Number(f.red.match(/\d+/g)[1])>60,'semantic red untouched');assert.doesNotMatch(f.vis,light,'already-visible line untouched');
    if(m.celsius)assert.match(m.celsius,light,'celsius tick');
    if(m.tab)console.log('tab separators (viewport only):',m.tab);
    for(let i=0;i<6;i++){await page.mouse.wheel(0,700);await page.waitForTimeout(700);}
    const all=await page.evaluate(()=>[...document.querySelectorAll('[class*="ContentHeaderView-module__tab_item___"]')].map(e=>getComputedStyle(e,'::before').backgroundColor));
    console.log('tab separators after scrolling:',all.join('|'));
    assert.ok(!all.some(c=>/rgba\(0, 0, 0, 0\.15\)/.test(c)),'tab separators after scroll');
   }
   const owned=await page.evaluate(()=>({pseudo:document.querySelectorAll('[data-bong-hairline-owned]').length,inline:document.querySelectorAll('[data-bong-contrast-owned]').length}));
   await page.screenshot({path:path.join(folder,`${site.name}-dark.png`)});
   await setSites([]);await page.waitForFunction(()=>!document.querySelector('.darkreader'),null,{timeout:20000});await page.waitForTimeout(800);
   const left=await page.evaluate(()=>({pseudo:document.querySelectorAll('[data-bong-hairline-owned]').length,inline:document.querySelectorAll('[data-bong-contrast-owned]').length,sheet:document.querySelectorAll('.bong-hairline-contrast').length}));
   assert.deepEqual(left,{pseudo:0,inline:0,sheet:0},site.name+' restore');
   if(site.name==='naver'){
    const orig=await page.evaluate(()=>({border:getComputedStyle(document.getElementById('fb')).borderTopColor,tick:getComputedStyle(document.getElementById('ftick'),'::before').backgroundColor}));
    assert.equal(orig.border,'rgba(140, 130, 115, 0.08)');assert.equal(orig.tick,'rgba(0, 0, 0, 0.08)');
   }
   summary.push(`${site.name}: dark ok, hairline owned pseudo=${owned.pseudo} inline=${owned.inline}, errors=${errors.length}, restore ok`);
   await setSites(SITES.map(s=>s.site));
   await page.close();
  }
  console.log(summary.join('\n'));console.log('Evidence:',folder);
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
