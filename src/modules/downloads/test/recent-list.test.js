import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {readFileSync} from 'node:fs';
test('download list shows real file icons, missing-file state, search and native video entries',async()=>{
 const window=new Window({url:'https://extension.invalid/recent-downloads.html'});let iconCalls=0;
 try{
  window.document.write(readFileSync(new URL('../../../../public/recent-downloads.html',import.meta.url),'utf8').replace(/<script[^>]*>.*?<\/script>/gs,''));
  window.chrome={runtime:{getURL:path=>'https://extension.invalid/'+path},permissions:{},tabs:{},downloads:{search:async()=>[
   {id:1,filename:'C:/Downloads/first.zip',url:'https://github.com/file.zip',state:'complete',exists:true,fileSize:1200,startTime:new Date().toISOString()},
   {id:2,filename:'C:/Downloads/missing.exe',url:'https://example.com/missing.exe',state:'complete',exists:false,fileSize:2000,startTime:new Date().toISOString()}],getFileIcon:async(id,options)=>{assert.equal(options.size,32);iconCalls++;return 'data:image/png;base64,fixture';},onChanged:{addListener(){}},onCreated:{addListener(){}},onErased:{addListener(){}}},storage:{local:{get:async()=>({'core.video:history':[{id:'v1',filename:'C:/Downloads/video.mkv',completedAt:Date.now()}]})},onChanged:{addListener(){}}}};
  window.eval(readFileSync(new URL('../../../../public/recent-downloads.js',import.meta.url),'utf8'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(window.document.querySelectorAll('.download-row').length,3);assert.equal(window.document.querySelectorAll('table,aside').length,0);assert.equal(iconCalls,2);assert.match(window.document.querySelector('.missing').textContent,/파일을 찾을 수 없습니다/);assert.ok([...window.document.querySelectorAll('.download-icon')].some(img=>img.src.startsWith('data:image/png')));
  const search=window.document.getElementById('search');search.value='first';search.dispatchEvent(new window.Event('input'));assert.equal(window.document.querySelectorAll('.download-row').length,1);assert.equal(iconCalls,2,'file icons are cached across renders');
 }finally{await window.happyDOM.close();}
});
