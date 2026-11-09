// Local-only SVG regression. No public network or personal profile.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();await page.route('https://fixture.invalid/**',r=>r.fulfill({body:'',status:404}));
  await page.setContent('<body style="background:#181a1b"><button style="background:#181a1b;border:0"><span id="glyph" style="display:block;width:40px;height:40px;background-image:url(https://fixture.invalid/icon.svg)"></span></button></body>');
  const helpers=fs.readFileSync('src/modules/dark/contrast.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/modules/dark/icon-contrast.js','utf8').replace(/^import[^\n]+\n/,'').replace(/export /g,'');
  await page.addScriptTag({content:helpers});
  const result=await page.evaluate(async()=>{
   const template='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><defs><mask id="m" maskUnits="userSpaceOnUse"><rect width="40" height="40" fill="white"/><rect x="10" y="10" width="8" height="8" fill="black"/></mask><clipPath id="c"><rect x="2" y="2" width="28" height="28" fill="black"/></clipPath></defs><path fill="black" mask="url(#m)" clip-path="url(#c)" d="M4 4h24v24H4z"/><rect x="30" y="4" width="6" height="8" fill="#4492cf"/></svg>';
   const results=[];for(const text of [template,template.replace('<svg xmlns=','<svg fill="black" xmlns=').replace('width="8" height="8" fill="black"','width="8" height="8"')]){
   const glyph=document.querySelector('#glyph');const icons=createIconContrastController(document,()=>{}, {fetchImage:async()=>new Response(text,{headers:{'content-type':'image/svg+xml'}})});icons.start();icons.inspect(glyph);
   for(let i=0;i<40&&!glyph.hasAttribute('data-bong-icon-owned');i++)await new Promise(r=>setTimeout(r,50));
   if(!glyph.hasAttribute('data-bong-icon-owned'))throw Error('Static masked glyph not repaired');
   const data=glyph.style.backgroundImage.slice(5,-2);const after=new DOMParser().parseFromString(atob(data.split(',')[1]),'image/svg+xml'),before=new DOMParser().parseFromString(text,'image/svg+xml');
   if(new XMLSerializer().serializeToString(before.querySelector('defs'))!==new XMLSerializer().serializeToString(after.querySelector('defs')))throw Error('Mask/clip definition changed');
   if(after.querySelector('svg > path').getAttribute('fill')==='black')throw Error('Visible glyph not repaired');
   const read=async url=>{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=40;c.height=40;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,40,40).data};
   const a=await read('data:image/svg+xml;base64,'+btoa(text)),b=await read(data);let changed=0;
   for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])throw Error('Mask alpha changed');if(Math.max(...a.slice(i,i+3))-Math.min(...a.slice(i,i+3))>25&&a.slice(i,i+4).some((v,j)=>v!==b[i+j]))throw Error('Brand changed');if(a.slice(i,i+3).some((v,j)=>v!==b[i+j]))changed++;}
   icons.stop();if(glyph.hasAttribute('data-bong-icon-owned'))throw Error('Restore failed');results.push({changed,alphaDifference:0,brandDifference:0,definitionsPreserved:true});}return results;
  });assert.ok(result.every(item=>item.changed>100));console.log('PASS static SVG mask/clip:',result);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
