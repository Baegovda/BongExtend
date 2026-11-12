import test from 'node:test';
import assert from 'node:assert/strict';
import {createOtpToast,renderCopiedOtpToast} from '../otp-toast.js';
import {Window} from 'happy-dom';
test('copied OTP goes to the active Chrome page without creating a new window',async()=>{
 let injected;
 const api={windows:{getLastFocused:async()=>({id:7}),create(){assert.fail('must not open a titled popup');}},tabs:{query:async query=>{assert.equal(query.windowId,7);return [{id:8,url:'https://example.com/'}];}},scripting:{executeScript:async value=>{injected=value;}}};
 assert.equal(await createOtpToast(api)('001234'),true);assert.equal(injected.target.tabId,8);assert.deepEqual(injected.args,['001234']);assert.equal(injected.func,renderCopiedOtpToast);
 api.scripting.executeScript=async()=>{throw Error('permission denied');};assert.equal(await createOtpToast(api)('001234'),false);
});
test('frameless OTP is isolated in closed shadow DOM, fades out and replaces prior toast',async()=>{
 const window=new Window(),timers=[];let root;
 try{
  const attach=window.Element.prototype.attachShadow;window.Element.prototype.attachShadow=function(options){root=attach.call(this,options);return root;};
  window.setTimeout=(fn,delay)=>{timers.push({fn,delay});return timers.length;};
  window.eval('('+renderCopiedOtpToast.toString()+')('+JSON.stringify('001234')+')');
  const host=window.document.getElementById('bongextend-otp-toast');assert.equal(host.shadowRoot,null);assert.equal(root.querySelector('.code').textContent,'001234');assert.equal(root.querySelector('.message').textContent,'클립보드에 복사되었습니다');assert.match(root.querySelector('style').textContent,/top:50%/);assert.ok(!window.document.documentElement.textContent.includes('001234'));
  assert.equal(timers[0].delay,6500);timers[0].fn();assert.ok(root.querySelector('.toast').classList.contains('leaving'));timers[1].fn();assert.equal(host.isConnected,false);
 }finally{await window.happyDOM.close();}
});
