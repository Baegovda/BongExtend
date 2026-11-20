// Dark mode page-backdrop photos (reported on Taobao IM: a pale meeting-room PNG stretched behind the chat window).
// Packaged extension, synthetic HTTPS pages and generated PNGs in a disposable Chrome profile. No accounts, no real sites.
// Checks: a light full-page backdrop gets one dark translucent layer over the same picture (CORS image and the
// worker measurement route for an image without CORS), while a dark backdrop, a small banner, an <img> photo and
// gradients stay original; turning dark mode off restores the page's own inline value.
const {makeTempDir}=require('./temp-dir.cjs');
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');

const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
// Photo-like opaque PNG: soft gradient plus a few darker "chair" blocks.
const png=(w,h,shade)=>{const rows=[];for(let y=0;y<h;y++){const row=Buffer.alloc(1+w*3);for(let x=0;x<w;x++){let v=shade(x,y);if(((x>>6)+(y>>5))%7===0)v-=40;v=Math.max(0,Math.min(255,v));row[1+x*3]=v;row[2+x*3]=v+2>255?255:v+2;row[3+x*3]=v+4>255?255:v+4;}rows.push(row);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);};
const light=png(700,432,(x,y)=>225-Math.round(30*x/700)-Math.round(10*y/432));
const darkImage=png(700,432,(x,y)=>30+Math.round(20*x/700));

const page=body=>`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://css.backdrop-cdn.example.net/app.css"><style>html,body{margin:0;height:100%;background:#fff;color:#222;font:16px system-ui}.shell{min-height:100%;display:flex;flex-direction:column}.top{height:36px;background:#fff;border-bottom:1px solid #eee}.main{position:relative;flex:1}.window{width:520px;margin:100px auto;height:300px;background:#fff;border-radius:8px;padding:16px}</style>${body}`;
(async()=>{
 const folder=makeTempDir('be-dark-backdrop-'),extension=path.join(folder,'extension');fs.cpSync('.output/chrome-mv3',extension,{recursive:true});
 const file=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file));manifest.host_permissions.push('https://*/*');fs.writeFileSync(file,JSON.stringify(manifest));
 const context=await chromium.launchPersistentContext(path.join(folder,'profile'),{channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging'],viewport:{width:1280,height:800}});context.setDefaultTimeout(15000);
 try{
  await(await context.browser().newBrowserCDPSession()).send('Extensions.loadUnpacked',{path:extension});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'core.update:autoCheck':false,'core.modules':{gmail:false,chzzk:false,trans:false,dc:false,dark:true},'core.darkMode':{enabledSites:['backdrop.bongextend.example.com'],followSystem:false}}));
  await context.route('https://img.backdrop-cdn.example.net/**',route=>{const url=route.request().url();const body=url.includes('dark')?darkImage:light;route.fulfill({status:200,contentType:'image/png',headers:url.includes('nocors')?{}:{'access-control-allow-origin':'*'},body});});
  await context.route('https://css.backdrop-cdn.example.net/**',route=>route.fulfill({contentType:'text/css',headers:{'access-control-allow-origin':'*'},body:'.main.light{background-image:url("https://img.backdrop-cdn.example.net/light.png");background-size:100% 100%}.main.nocors{background-image:url("https://img.backdrop-cdn.example.net/light-nocors.png");background-size:cover}.main.darkbg{background-image:url("https://img.backdrop-cdn.example.net/dark.png");background-size:100% 100%}.banner{height:180px;background-image:url("https://img.backdrop-cdn.example.net/light.png");background-size:cover}.main.grad{background-image:linear-gradient(#fff,#eee)}'}));
  const pages={
   light:page('<div class="shell"><div class="top">상단</div><section class="main light"><div class="window">채팅 창</div></section></div>'),
   nocors:page('<div class="shell"><div class="top">상단</div><section class="main nocors"><div class="window">채팅 창</div></section></div>'),
   darkbg:page('<div class="shell"><div class="top">상단</div><section class="main darkbg"><div class="window">채팅 창</div></section></div>'),
   banner:page('<div class="shell"><div class="top">상단</div><div class="banner"><p>배너 글자</p></div><section class="main"><img id="photo" src="https://img.backdrop-cdn.example.net/light.png" width="1200" height="600" alt="상품 사진"></section></div>'),
   grad:page('<div class="shell"><div class="top">상단</div><section class="main grad"><div class="window">채팅 창</div></section></div>'),
   inline:page('<div class="shell"><div class="top">상단</div><section class="main" id="inlineMain" style="background-image:url(&quot;https://img.backdrop-cdn.example.net/light.png&quot;);background-size:100% 100%"><div class="window">채팅 창</div></section></div>')
  };
  await context.route('https://backdrop.bongextend.example.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:pages[new URL(route.request().url()).pathname.slice(1)]||'missing'}));
  const tab=await context.newPage();
  const state=sel=>tab.evaluate(sel=>{const el=document.querySelector(sel);const s=getComputedStyle(el);return {bi:s.backgroundImage,owned:el.getAttribute('data-bong-backdrop'),inline:el.style.getPropertyValue('background-image'),scheme:document.documentElement.getAttribute('data-darkreader-scheme')};},sel);
  const settle=async(sel,want)=>{for(let i=0;i<40;i++){const s=await state(sel);if(s.scheme==='dark'&&(want?s.owned==='1':true)&&(!want||s.bi.startsWith('linear-gradient')))return s;await tab.waitForTimeout(250);}return state(sel);};

  // 1. Light backdrop from a CORS host: dimmed with one dark translucent layer, picture kept underneath.
  await tab.goto('https://backdrop.bongextend.example.com/light');let s=await settle('.main',true);
  assert.equal(s.owned,'1',JSON.stringify(s));assert.match(s.bi,/^linear-gradient\(rgba\(\d+, \d+, \d+, 0\.(7|8|9)\d*\), rgba\(.+\)\), url\("https:\/\/img\.backdrop-cdn\.example\.net\/light\.png"\)$/);
  await tab.screenshot({path:path.join(folder,'light-dimmed.png')});
  // The picture is darkened, not hidden: average screen brightness of the backdrop area drops below 25%.
  const shot=await tab.screenshot({clip:{x:0,y:600,width:1280,height:180}});
  const mean=await tab.evaluate(async b64=>{const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.createElement('canvas');c.width=64;c.height=16;const x=c.getContext('2d');x.drawImage(img,0,0,64,16);const d=x.getImageData(0,0,64,16).data;let s=0;for(let i=0;i<d.length;i+=4)s+=(d[i]+d[i+1]+d[i+2])/3;return s/(d.length/4)/255;},shot.toString('base64'));
  assert.ok(mean<0.25,'backdrop area is dark now: '+mean);
  // 2. No CORS header: the worker measures (numbers only) and the result is the same.
  await tab.goto('https://backdrop.bongextend.example.com/nocors');s=await settle('.main',true);
  assert.equal(s.owned,'1','image without CORS measured by the worker');assert.match(s.bi,/light-nocors\.png/);
  // 3. Dark backdrop, banner, <img> photo and gradient stay original.
  await tab.goto('https://backdrop.bongextend.example.com/darkbg');await settle('.main',false);await tab.waitForTimeout(2500);s=await state('.main');
  assert.equal(s.owned,null);assert.match(s.bi,/^url\(".*dark\.png"\)$/,'dark photo keeps its colours');
  await tab.goto('https://backdrop.bongextend.example.com/banner');await settle('.banner',false);await tab.waitForTimeout(2500);
  assert.equal((await state('.banner')).owned,null,'small banner untouched');
  assert.equal(await tab.evaluate(()=>document.getElementById('photo').hasAttribute('data-bong-backdrop')||getComputedStyle(document.getElementById('photo')).filter!=='none'),false,'<img> photo untouched');
  await tab.goto('https://backdrop.bongextend.example.com/grad');await settle('.main',false);await tab.waitForTimeout(2000);
  assert.equal((await state('.main')).owned,null,'gradients are not photos');
  // 4. The page's own inline value comes back exactly when dark mode is turned off.
  await tab.goto('https://backdrop.bongextend.example.com/inline');s=await settle('#inlineMain',true);assert.equal(s.owned,'1');
  await worker.evaluate(()=>chrome.storage.local.set({'core.modules':{gmail:false,chzzk:false,trans:false,dc:false,dark:false}}));
  for(let i=0;i<40&&(await state('#inlineMain')).owned;i++)await tab.waitForTimeout(250);
  s=await state('#inlineMain');assert.equal(s.owned,null);assert.equal(s.inline,'url("https://img.backdrop-cdn.example.net/light.png")');
  console.log('PASS dark backdrop: light page photo dimmed (CORS and worker-measured), dark photo/banner/<img>/gradient untouched, OFF restores inline value');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exit(1)});
