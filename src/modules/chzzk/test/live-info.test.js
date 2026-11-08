import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';

test('player fixture shows actual quality, elapsed time and viewer change colors with serialized polls',async()=>{
 const window=new Window({url:'https://chzzk.naver.com/live/'+'a'.repeat(32)});
 try{
  window.document.body.innerHTML='<div class="pzp pzp-pc"><video class="webplayer-internal-video"></video></div><aside id="aside-chatting"><div><h2>채팅</h2></div></aside>';
  Object.defineProperty(window.document.querySelector('video'),'videoHeight',{get:()=>1080});
  window.chrome={runtime:{id:'fixture'}};
  window.BCStore={sync:{get:(defaults,callback)=>window.setTimeout(()=>callback({...defaults,adBlock:false,adSkip:false,vivid:false}),0)},onChanged:{addListener(){}}};
  window.BCStore.local={get:(defaults,callback)=>window.setTimeout(()=>callback(defaults),0),set(){}};
  window.Element.prototype.animate=function(frames){this.frames=frames;return {cancel(){}};};
  let polls=0,active=0,peak=0;const starts=[];
  window.fetch=async url=>{
   if(String(url).includes('live-detail'))return {ok:true,json:async()=>({content:{openDate:new Date(Date.now()-65000).toISOString()}})};
   starts.push(Date.now());peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,30));active--;polls++;
   return {ok:true,json:async()=>({content:{status:'OPEN',liveId:1,concurrentUserCount:polls===1?100:polls===2?101:99}})};
  };
  for(const name of ['lib/extras.js','lib/player.js','content-extras.js'])window.eval(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
  await new Promise(resolve=>setTimeout(resolve,1150));
  assert.equal(window.document.querySelector('#bex-quality').textContent,'1080p');
  assert.match(window.document.querySelector('.bc-runtime').textContent,/^00:01:/);
  const num=window.document.querySelector('#bex-vov .bc-num');assert.equal(num.textContent,'101명');assert.equal(num.frames[1].color,'#8ad9b6');
  await new Promise(resolve=>setTimeout(resolve,1000));assert.equal(num.textContent,'99명');assert.equal(num.frames[1].color,'#eea3a3');
  assert.equal(peak,1);assert.ok(starts[1]-starts[0]>=900&&starts[1]-starts[0]<1400);
 }finally{await window.happyDOM.close();}
});
