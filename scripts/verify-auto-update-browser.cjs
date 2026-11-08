// Disposable profile and origin-private test folder only. Never writes a real install.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
(async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'be-autoupdate-')),ext=path.join(temp,'extension'),zipPath=path.join(temp,'fixture.zip');
  fs.cpSync('.output/chrome-mv3',ext,{recursive:true});
  execFileSync('python',['-c',`import zipfile,sys,json
with zipfile.ZipFile(sys.argv[1],'w') as z:
 z.writestr('manifest.json',json.dumps({'name':'BongExtend','version':'100.0.0'}))
 z.writestr('fixture.txt','automatic update succeeded')
`,zipPath]);
  const bytes=Array.from(fs.readFileSync(zipPath)),release={tag_name:'v100.0.0',assets:[{name:'bongextend-100.0.0-chrome.zip',browser_download_url:'https://github.com/Baegovda/BongExtend/releases/download/v100.0.0/fixture.zip',size:bytes.length}]};
  const mock=`const nativeFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(url,options)=>String(url).includes('/releases/latest')?Promise.resolve(new Response(JSON.stringify(${JSON.stringify(release)}),{headers:{'content-type':'application/json'}})):String(url).endsWith('/fixture.zip')?Promise.resolve(new Response(new Uint8Array(${JSON.stringify(bytes)}))):nativeFetch(url,options);`;
  const bg=path.join(ext,'background.js');
  fs.writeFileSync(bg,`${mock}globalThis.__alarms=[];const nativeAlarm=chrome.alarms.onAlarm.addListener.bind(chrome.alarms.onAlarm);chrome.alarms.onAlarm.addListener=fn=>{__alarms.push(fn);nativeAlarm(fn);};`+fs.readFileSync(bg,'utf8'));
  const context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1000,height:760}});
  try {
    await context.addInitScript({content:`${mock}chrome.runtime.reload=()=>chrome.storage.local.set({'test.reloadRequested':true});`});
    const cdp=await context.browser().newBrowserCDPSession();const {id}=await cdp.send('Extensions.loadUnpacked',{path:ext});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const waitState=async phase=>{
      for(let i=0;i<150;i++){
        const state=await worker.evaluate(async()=> (await chrome.storage.local.get('core.update:installState'))['core.update:installState']);
        if(state?.phase===phase)return state;
        if(state?.phase==='error')throw Error(JSON.stringify(state));
        await new Promise(resolve=>setTimeout(resolve,100));
      }throw Error('timeout waiting for '+phase);
    };
    await waitState('blocked');
    let updater=context.pages().find(p=>p.url().includes('/update.html'));
    assert.ok(updater,'background detection opened the updater without a click');
    assert.equal((await worker.evaluate(()=>chrome.tabs.query({url:chrome.runtime.getURL('/update.html')+'*'})))[0].active,false);
    await updater.screenshot({path:path.join(temp,'folder-needed.png')});
    await updater.evaluate(async()=>{
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle('synthetic-install',{create:true});
      const file=await dir.getFileHandle('manifest.json',{create:true}),writer=await file.createWritable();
      await writer.write(JSON.stringify({name:'BongExtend',version:'1.0.0'}));await writer.close();
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('bongextend-install',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(dir,'installDir');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
    });
    await updater.close();
    await worker.evaluate(async()=>{
      await chrome.storage.local.remove(['core.update:installState','core.update:autoAttempt']);
      await chrome.storage.local.set({'core.update:lastCheck':0});
      for(const fn of __alarms)fn({name:'refresher-update-check'});
    });
    await waitState('done');
    updater=context.pages().find(p=>p.url().includes('/update.html'));
    const written=await updater.evaluate(async()=>{
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle('synthetic-install');
      return {manifest:JSON.parse(await (await (await dir.getFileHandle('manifest.json')).getFile()).text()),content:await (await (await dir.getFileHandle('fixture.txt')).getFile()).text()};
    });
    assert.equal(written.manifest.version,'100.0.0');assert.equal(written.content,'automatic update succeeded');
    await updater.waitForFunction(async()=> (await chrome.storage.local.get('test.reloadRequested'))['test.reloadRequested']===true);
    await updater.screenshot({path:path.join(temp,'installed.png')});
    console.log('PASS background detection, inactive updater, folder-needed state, native test-folder writes, pending cleanup and reload request');
    const pending=await updater.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('bongextend-install',1);r.onsuccess=()=>resolve(r.result);});
      return new Promise(resolve=>{const tx=db.transaction('pending');const r=tx.objectStore('pending').get('pending');tx.oncomplete=()=>{db.close();resolve(r.result);};});
    });
    assert.equal(pending,undefined);
    // A stopped write resumes from its saved package without another download.
    await updater.evaluate(async()=>{
      const enc=new TextEncoder(),files=[{path:['manifest.json'],data:enc.encode(JSON.stringify({name:'BongExtend',version:'100.0.1'}))},{path:['resumed.txt'],data:enc.encode('resumed')}];
      const db=await new Promise(resolve=>{const r=indexedDB.open('bongextend-install',1);r.onsuccess=()=>resolve(r.result);});
      await new Promise(resolve=>{const tx=db.transaction('pending','readwrite');tx.objectStore('pending').put({version:'100.0.1',files},'pending');tx.oncomplete=()=>{db.close();resolve();};});
      await chrome.storage.local.remove(['core.update:installState','test.reloadRequested']);
    });
    await updater.reload();
    const resumed=await waitState('done');assert.equal(resumed.version,'100.0.1');
    assert.equal(await updater.evaluate(async()=>{
      const dir=await (await navigator.storage.getDirectory()).getDirectoryHandle('synthetic-install');
      return (await (await dir.getFileHandle('resumed.txt')).getFile()).text();
    }),'resumed');
    console.log('PASS interrupted package automatically resumes from saved files');
    console.log('screenshots',temp);
  }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
