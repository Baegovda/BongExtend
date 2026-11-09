// Representative extension UI states, disposable Chrome profile only.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-glass-ui-')),ext=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 const ctx=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,viewport:{width:800,height:620},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  const {id}=await(await ctx.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:ext});
  const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.popupTab':'dark','refresher:module:schema':{
   '미리보기':{name:'미리보기',desc:'합성 설정 모듈',default_enable:true,settings:{enabled:{type:'check',name:'본문 미리보기',desc:'목록에서 글 내용을 미리 확인해요.',default:true,value:true},size:{type:'range',name:'미리보기 크기',desc:'화면에 맞는 크기를 골라요.',default:350,value:350,min:200,max:600,step:10,unit:'px'},advanced:{type:'text',name:'제외 단어',desc:'적용하지 않을 단어를 입력해요.',default:'',value:'',advanced:true}}},
   '화면':{name:'화면',desc:'합성 화면 모듈',default_enable:true,settings:{layout:{type:'option',name:'목록 밀도',desc:'읽기 편한 간격으로 표시해요.',default:'normal',value:'normal',items:{normal:'기본',compact:'촘촘하게'}}}}
  }}));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`chrome-extension://${id}/popup.html`);
  const checkBounds=async()=>page.evaluate(()=>[...document.querySelectorAll('button,input,select,textarea')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>1&&r.height>1&&s.visibility!=='hidden'&&!e.closest('[hidden]')&&(r.left<-.5||r.right>innerWidth+.5)}).map(e=>({id:e.id,x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width})));
  for(const theme of ['dark','light']){
   await page.emulateMedia({colorScheme:theme});
   for(const tab of ['dark','fx','trans','chzzk','dc','gmail','download']){
    await page.locator(`[data-tab="${tab}"]`).click();await page.waitForTimeout(tab==='fx'?1000:350);
    assert.deepEqual(await checkBounds(),[],theme+' '+tab+' shell horizontal bounds');
    await page.screenshot({path:path.join(folder,`${tab}-${theme}.png`)});
   }
   await page.locator('#settingsGear').click();await page.waitForTimeout(150);await page.screenshot({path:path.join(folder,`settings-${theme}.png`)});
   assert.deepEqual(await checkBounds(),[],theme+' settings shell horizontal bounds');
  }
  // Standalone module layouts exercise small windows separately from popup sizing.
  for(const width of [600,360])for(const route of ['/chzzk/popup.html','/trans/popup/popup.html','/dc.html','/trans/options/options.html']){
   const p=await ctx.newPage();await p.setViewportSize({width,height:680});p.on('pageerror',e=>errors.push(e.message));await p.goto(`chrome-extension://${id}${route}`);await p.waitForTimeout(250);
   const overflow=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(overflow.scroll<=overflow.client+1,route+' '+width+' horizontal overflow '+JSON.stringify(overflow));
   await p.screenshot({path:path.join(folder,`${route.replaceAll('/','_')}-${width}.png`)});await p.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS glass UI themes, module navigation and compact layouts. Evidence:',folder);
 }finally{await ctx.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
