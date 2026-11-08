import test from 'node:test';
import assert from 'node:assert/strict';
import {createOtpToast} from '../otp-toast.js';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
test('copied OTP is centered and delivered once without appearing in its URL',async()=>{
 let listener,created;
 const api={runtime:{id:'self',getURL:path=>'chrome-extension://self/'+path,onMessage:{addListener:fn=>listener=fn}},windows:{getLastFocused:async()=>({left:100,top:50,width:1000,height:800}),create:async value=>{created=value;}}};
 await createOtpToast(api)('001234');
 assert.equal(created.left,410);assert.equal(created.top,335);assert.equal(created.focused,false);assert.ok(!created.url.includes('001234'));
 const token=new URL(created.url).searchParams.get('token');let reply;
 listener({type:'BONG_OTP_TOAST_READ',token},{id:'self',url:'https://example.com/'},()=>assert.fail('web pages cannot read OTP'));
 listener({type:'BONG_OTP_TOAST_READ',token},{id:'self',url:'chrome-extension://self/otp-toast.html?token='+token},value=>reply=value);
 assert.equal(reply.code,'001234');
 listener({type:'BONG_OTP_TOAST_READ',token},{id:'self',url:'chrome-extension://self/otp-toast.html'},value=>reply=value);
 assert.deepEqual(reply,{});
});
test('toast page renders the copied code and exact confirmation message as text',async()=>{
 const window=new Window({url:'https://extension.invalid/otp-toast.html?token=fixture'});
 try{
  window.document.body.innerHTML='<strong id="code"></strong><p id="message"></p><button id="close">닫기</button>';
  window.chrome={runtime:{sendMessage:async message=>{assert.equal(message.token,'fixture');return {code:'001234'};}}};
  window.eval(readFileSync(new URL('../../../../public/otp-toast.js',import.meta.url),'utf8'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(window.document.getElementById('code').textContent,'001234');
  assert.equal(window.document.getElementById('message').textContent,'클립보드에 복사되었습니다');
 }finally{await window.happyDOM.close();}
});
