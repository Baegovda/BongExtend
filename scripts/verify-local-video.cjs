const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'be-native-video-')),ext=path.join(tmp,'extension');fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
 const extensionManifest=path.join(ext,'manifest.json'),config=JSON.parse(fs.readFileSync(extensionManifest));config.host_permissions.push('https://video.example.test/*');fs.writeFileSync(extensionManifest,JSON.stringify(config));
 const manifest=path.join(process.env.LOCALAPPDATA,'BongExtend/video-helper/com.bongextend.video.json'),saved=fs.readFileSync(manifest);
 const ctx=await chromium.launchPersistentContext(path.join(tmp,'profile'),{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1100,height:800}});
 try{
  await ctx.route('https://jasonsavard.com/**',route=>route.fulfill({contentType:'text/html',body:'Installation fixture'}));
  const installedTab=ctx.waitForEvent('page');
  const cdp=await ctx.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:ext});
  const welcome=await installedTab;await welcome.waitForURL('https://jasonsavard.com/**');await welcome.close();
  const data=JSON.parse(saved.toString('utf8').replace(/^\uFEFF/,''));data.allowed_origins.push('chrome-extension://'+id+'/');fs.writeFileSync(manifest,JSON.stringify(data));
  await ctx.route('https://video.example.test/**',route=>route.fulfill({contentType:'text/html',body:'<video src="https://download.blender.org/peach/trailer/trailer_400p.ogg"></video>'}));
  const source=await ctx.newPage();await source.goto('https://video.example.test/watch');
  const shell=await ctx.newPage();await shell.goto('chrome-extension://'+id+'/popup.html');
  await shell.evaluate(()=>chrome.storage.local.set({'core.popupTab':'download','core.update:autoCheck':false}));
  await shell.locator('[data-tab=download]').click();
  const opened=ctx.waitForEvent('page');await shell.locator('#currentVideoDownloader').click();
  const selected=await opened;await selected.waitForLoadState('domcontentloaded');
  assert.equal(await selected.locator('#videoUrl').inputValue(),'https://download.blender.org/peach/trailer/trailer_400p.ogg','current-page button discovers the actual video source');
  await selected.close();await shell.close();await source.close();
  const page=await ctx.newPage();page.on('pageerror',e=>console.log('pageerror',e.message));page.on('console',m=>console.log(m.text()));await page.addInitScript(()=>chrome.storage.onChanged.addListener(c=>{if(c['core.video:status'])console.log(JSON.stringify(c['core.video:status'].newValue));}));
  await page.goto('chrome-extension://'+id+'/video-downloader.html?url='+encodeURIComponent('https://download.blender.org/peach/trailer/trailer_400p.ogg'));
  const waitState=async(types)=>{const until=Date.now()+120000;while(Date.now()<until){const state=await page.evaluate(async()=> (await chrome.storage.local.get('core.video:status'))['core.video:status']);if(types.includes(state?.type))return state;await new Promise(r=>setTimeout(r,150));}throw Error('native status timeout');};
  await waitState(['ready']);
  await page.screenshot({path:path.join(tmp,'connected.png')});await page.evaluate(()=>chrome.storage.local.remove('core.video:status'));await page.locator('#start').click();
  const result=await waitState(['done','error','missing']);console.log('result',result);assert.equal(result.type,'done');assert.ok(fs.statSync(result.filename).size>100000);
  await page.waitForFunction(()=>!document.querySelector('#start').disabled && document.querySelector('#cancel').disabled);
  await page.screenshot({path:path.join(tmp,'downloaded.png')});console.log('screenshots',tmp);
  await page.emulateMedia({colorScheme:'dark'});await page.setViewportSize({width:360,height:760});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'narrow screen has no horizontal clipping');
  await page.screenshot({path:path.join(tmp,'downloaded-dark-narrow.png')});
 }finally{fs.writeFileSync(manifest,saved);await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
