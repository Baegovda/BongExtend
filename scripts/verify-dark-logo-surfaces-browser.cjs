// Disposable local Chrome fixture; no account, checkout or protected site access.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'be-logo-surfaces-')),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:760}});
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="90" height="24"><path fill="#111" d="M3 4h5v16H3zM8 4h12v4H8zM16 8h4v7h-4zM8 12h9v4H8zM27 4h4v16h-4zM31 4h14v4H31zM40 8h5v12h-5zM31 12h9v4h-9z"/><path fill="#00c76a" d="M60 4h5v16h-5zM65 9h8v5h-8zM73 4h5v16h-5z"/></svg>';
  const url='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  await page.setContent(`<body style="margin:0;background:rgb(24,26,27);color:#eee;font:16px Arial"><style>.card{background:rgb(24,26,27);border:1px solid #202223;border-radius:12px;padding:20px;margin:14px}.band{min-height:320px;width:100%;background:rgb(31,32,33)}#brand{background:rgb(32,25,65)}#overlay{position:fixed;right:0;bottom:0;width:100%;height:320px;background:rgb(29,30,31);pointer-events:none;opacity:0}img{vertical-align:middle}</style><main class="band" id="canvas"><div class="card" id="low">Transparent brand logos <img id="logo" alt="Payment logo" width="90" height="24" src="${url}"> <button><img id="control" width="90" height="24" src="${url}"></button></div><div class="card" id="clear" style="border-color:#89929a">Card fill stays original</div><button disabled><img id="disabled" width="90" height="24" src="${url}"></button><img id="photo" alt="Photo" width="90" height="24"></main><section class="band" id="brand">Brand surface preserved</section><div id="overlay"></div>`);
  await page.evaluate(()=>{const c=document.createElement('canvas');c.width=90;c.height=24;const x=c.getContext('2d');x.fillStyle='#111';x.fillRect(0,0,90,24);document.querySelector('#photo').src=c.toDataURL();document.querySelector('button:not([disabled])').style.background='transparent'});
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
  const sample=()=>page.evaluate(()=>Object.fromEntries(['canvas','low','clear','brand','overlay','logo','control','disabled','photo'].map(id=>{const e=document.getElementById(id),s=getComputedStyle(e),r=e.getBoundingClientRect();return[id,{bg:s.backgroundColor,outline:s.outline,src:e.src,content:s.content,width:r.width,height:r.height,filter:s.filter}]})));
  await page.evaluate(()=>document.documentElement.setAttribute('data-darkreader-scheme','dark'));
  const before=await sample();await page.screenshot({path:path.join(folder,'before.png')});
  const helpers=['contrast','icon-contrast'].map(name=>fs.readFileSync(`src/modules/dark/${name}.js`,'utf8').replace(/^import[^\n]+\n/gm,'').replace(/export /g,'')).join('\n');
  await page.addScriptTag({content:helpers+';window.icons=createIconContrastController(document,()=>contrast.update());window.contrast=createContrastController(document,{inspectImage:icons.inspect});icons.start();contrast.start();'});
  try {await page.waitForFunction(()=>document.querySelector('#logo').hasAttribute('data-bong-icon-owned')&&document.querySelector('#control').hasAttribute('data-bong-icon-owned'),null,{timeout:6000});} catch(error) {console.log(await sample(),await page.evaluate(()=>contrast.stats));throw error;}
  await page.waitForTimeout(200);const after=await sample();
  assert.equal(after.canvas.bg,'rgb(24, 26, 27)');assert.equal(after.low.bg,before.low.bg);assert.equal(after.clear.bg,before.clear.bg);
  for(const id of ['brand','overlay','disabled','photo'])assert.deepEqual(after[id],before[id],id+' preserved');
  for(const id of ['logo','control']){assert.notEqual(after[id].content,before[id].content);for(const key of ['src','width','height','filter'])assert.equal(after[id][key],before[id][key]);}
  const pixels=await page.locator('#logo').evaluate(async e=>{
   const read=async url=>{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,c.width,c.height).data;};
   const a=await read(e.src),b=await read(e.style.content.match(/url\("(.*)"\)/)[1]);let changed=0,brand=0;
   for(let i=0;i<a.length;i+=4){if(a[i]!==b[i])changed++;if(Math.max(...a.slice(i,i+3))-Math.min(...a.slice(i,i+3))>25){brand++;for(let j=0;j<4;j++)if(a[i+j]!==b[i+j])throw Error('brand changed');}if(a[i+3]!==b[i+3])throw Error('alpha changed');}return{changed,brand};
  });assert.ok(pixels.changed>80&&pixels.brand>40);
  await page.screenshot({path:path.join(folder,'dark.png')});
  const passes=await page.evaluate(()=>contrast.stats.passes);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>contrast.stats.passes),passes,'no feedback loop');
  await page.evaluate(()=>{document.querySelector('#control').src=document.querySelector('#photo').src;document.querySelector('#logo').style.setProperty('content','none','important');});await page.waitForTimeout(200);
  assert.equal(await page.locator('#control').evaluate(e=>getComputedStyle(e).content),'normal','new opaque source restores original rendering');
  await page.evaluate(()=>{icons.stop();contrast.stop()});const off=await sample();
  assert.equal(await page.locator('#logo').evaluate(e=>e.style.content),'none','author replacement kept');for(const id of ['canvas','low','clear','brand','overlay','disabled','photo'])assert.deepEqual(off[id],before[id],id+' restored');
  fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({before,after,pixels,off},null,2));console.log('PASS logo colors/alpha/geometry, neutral canvases/card fill, author updates/OFF/stability:',folder);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
