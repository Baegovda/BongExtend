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

test('trash clears finished and interrupted rows, cancels resumable ones first, and points to chrome://downloads for any row that stays',async()=>{
 const window=new Window({url:'https://extension.invalid/recent-downloads.html'});
 try{
  window.document.write(readFileSync(new URL('../../../../public/recent-downloads.html',import.meta.url),'utf8').replace(/<script[^>]*>.*?<\/script>/gs,''));
  const t=new Date().toISOString();
  let rows=[
   {id:1,filename:'C:/D/a.zip',url:'https://a.test/a.zip',state:'complete',exists:true,startTime:t},
   {id:2,filename:'C:/D/b.zip',url:'https://b.test/b.zip',state:'interrupted',canResume:false,startTime:t},
   {id:3,filename:'C:/D/viewimage.htm',url:'https://dcimg6.dcinside.co.kr/viewimage.php?x=1',state:'interrupted',canResume:true,error:'NETWORK_FAILED',startTime:t},
   {id:4,filename:'C:/D/stuck.htm',url:'https://stuck.test/s',state:'interrupted',canResume:false,error:'FILE_BLOCKED',startTime:t},
   {id:5,filename:'C:/D/run.zip',url:'https://r.test/r.zip',state:'in_progress',totalBytes:10,bytesReceived:1,startTime:t}];
  const cancelled=[],opened=[],stored={};
  const match=(q,r)=>Object.entries(q).every(([k,v])=>r[k]===v);
  window.confirm=()=>true;
  window.chrome={runtime:{getURL:p=>'https://extension.invalid/'+p},permissions:{},tabs:{create:async o=>{opened.push(o.url);}},
   storage:{local:{get:async()=>({}),set:async o=>{Object.assign(stored,o);}},onChanged:{addListener(){}}},
   downloads:{search:async(q={})=>rows.filter(r=>match(Object.fromEntries(Object.entries(q).filter(([k])=>k!=='limit'&&k!=='orderBy')),r)),getFileIcon:async()=>null,
    cancel:async id=>{cancelled.push(id);rows=rows.map(r=>r.id===id?{...r,canResume:false,error:'USER_CANCELED'}:r);},
    // Chrome refuses to erase id 4 (stands in for whatever kept the real row); a resumable row is only erased after cancel.
    erase:async q=>{rows=rows.filter(r=>!(match(q,r)&&r.id!==4&&!r.canResume));},
    onChanged:{addListener(){}},onCreated:{addListener(){}},onErased:{addListener(){}}}};
  window.eval(readFileSync(new URL('../../../../public/recent-downloads.js',import.meta.url),'utf8'));await new Promise(r=>setImmediate(r));
  window.document.getElementById('clear').onclick();for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(rows.map(r=>r.id),[4,5],'finished, interrupted and resumable rows are gone; the running one stays');
  assert.deepEqual(cancelled,[3],'only the resumable interrupted row is cancelled first');
  const notice=window.document.getElementById('notice');
  assert.match(notice.textContent,/1개는 지우지 못했어요/);assert.match(notice.querySelector('span').title,/stuck\.test: interrupted · FILE_BLOCKED/);
  notice.querySelector('button').click();assert.deepEqual(opened,['chrome://downloads']);
  assert.deepEqual(stored['core.downloads:clearLeft'].items.map(f=>[f.id,f.host,f.error]),[[4,'stuck.test','FILE_BLOCKED']],'the leftover is recorded with only the site name');
 }finally{await window.happyDOM.close();}
});
