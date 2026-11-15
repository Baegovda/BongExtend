import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {readFileSync} from 'node:fs';
test('download list shows real file icons, missing-file state, search and native video entries',async()=>{
 const window=new Window({url:'https://extension.invalid/recent-downloads.html'});let iconCalls=0;
 try{
  window.document.write(readFileSync(new URL('../../../../public/recent-downloads.html',import.meta.url),'utf8').replace(/<script[^>]*>.*?<\/script>/gs,''));
  window.chrome={runtime:{getURL:path=>'https://extension.invalid/'+path},permissions:{},tabs:{},downloads:{search:async()=>[
   {id:1,filename:'C:/Downloads/first.zip',url:'https://github.com/file.zip',state:'complete',exists:true,fileSize:1200,startTime:new Date().toISOString()},
   {id:2,filename:'C:/Downloads/missing.exe',url:'https://example.com/missing.exe',state:'complete',exists:false,fileSize:2000,startTime:new Date().toISOString()}],getFileIcon:async(id,options)=>{assert.equal(options.size,32);iconCalls++;return 'data:image/png;base64,fixture';},onChanged:{addListener(){}},onCreated:{addListener(){}},onErased:{addListener(){}}},storage:{local:{get:async()=>({'core.video:history':[{id:'v1',filename:'C:/Downloads/video.mkv',completedAt:Date.now()}]})},onChanged:{addListener(){}}}};
  window.eval(readFileSync(new URL('../../../../public/recent-downloads.js',import.meta.url),'utf8'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(window.document.querySelectorAll('.download-row').length,3);assert.equal(window.document.querySelectorAll('table,aside').length,0);assert.equal(iconCalls,2);assert.match(window.document.querySelector('.missing .error').title,/파일을 찾을 수 없습니다/);assert.ok([...window.document.querySelectorAll('.download-icon')].some(img=>img.src.startsWith('data:image/png')));
  const search=window.document.getElementById('search');search.value='first';search.dispatchEvent(new window.Event('input'));assert.equal(window.document.querySelectorAll('.download-row').length,1);assert.equal(iconCalls,2,'file icons are cached across renders');
 }finally{await window.happyDOM.close();}
});

test('a running download shows received / total size, speed and time left instead of just "받는 중"',async()=>{
 const window=new Window({url:'https://extension.invalid/recent-downloads.html'});
 try{
  window.document.write(readFileSync(new URL('../../../../public/recent-downloads.html',import.meta.url),'utf8').replace(/<script[^>]*>.*?<\/script>/gs,''));
  const end=new Date(Date.now()+90500).toISOString();
  window.chrome={runtime:{getURL:path=>'https://extension.invalid/'+path},permissions:{},tabs:{},downloads:{search:async()=>[
   {id:7,filename:'C:/Downloads/big.mp4',url:'https://cdn.example.com/big.mp4',state:'in_progress',bytesReceived:104857600,totalBytes:314572800,estimatedEndTime:end,startTime:new Date().toISOString()},
   {id:8,filename:'C:/Downloads/stream.bin',url:'https://cdn.example.com/s',state:'in_progress',bytesReceived:5242880,totalBytes:0,startTime:new Date().toISOString()}],getFileIcon:async()=>null,onChanged:{addListener(){}},onCreated:{addListener(){}},onErased:{addListener(){}}},storage:{local:{get:async()=>({})},onChanged:{addListener(){}}}};
  window.eval(readFileSync(new URL('../../../../public/recent-downloads.js',import.meta.url),'utf8'));await new Promise(resolve=>setImmediate(resolve));
  const rows=[...window.document.querySelectorAll('.download-row.active')];assert.equal(rows.length,2);
  const big=rows.find(r=>r.dataset.id==='7');assert.equal(big.querySelector('.meta>span').textContent,'33%');
  assert.match(big.querySelector('.source').textContent,/^100\.00 MB \/ 300\.00 MB · 1분 30초 남음$/);
  const unknown=rows.find(r=>r.dataset.id==='8');assert.match(unknown.querySelector('.source').textContent,/5\.00 MB 받음 \(전체 크기 모름\)/);
  assert.ok(!window.document.body.textContent.includes('받는 중'));
 }finally{await window.happyDOM.close();}
});
