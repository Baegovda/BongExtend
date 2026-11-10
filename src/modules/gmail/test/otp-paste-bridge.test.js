import test from 'node:test';
import assert from 'node:assert/strict';
import {createOtpPasteTracker} from '../otp-paste.js';
import {startOtpPasteBridge} from '../otp-paste-bridge.js';
function fixture(){
 const session={},listeners=[],local={};const event=()=>({addListener(){}});
 const api={runtime:{id:'extension',onMessage:{addListener(fn){listeners.push(fn)}}},tabs:{query:async()=>[{id:1,url:'https://example.com',active:true}],onActivated:event(),onUpdated:event(),onRemoved:event()},scripting:{executeScript:async()=>[{frameId:0,documentId:'doc'}]},storage:{local:{get:async()=>local},session:{get:async()=>structuredClone(session),set:async value=>Object.assign(session,structuredClone(value)),remove:async key=>delete session[key]}}};
 const sender={id:'extension',tab:{id:1},frameId:0,documentId:'doc',url:'https://example.com/'};
 return{api,session,local,sender,send:(token,override={})=>new Promise(resolve=>listeners.at(-1)({type:'bongextend-otp-pasted',token},{...sender,...override},resolve))};
}
test('source session contains no OTP/body; sender document and latest token must match',async()=>{
 const f=fixture(),tracker=createOtpPasteTracker(),bridge=startOtpPasteBridge(tracker,f.api);let reads=0;
 await bridge.arm({id:'mail',account:{id:2,getEmail:()=> 'a@example.com'},markAsRead:async()=>reads++},'987654');await bridge.refresh();const {token}=tracker.current();
 assert.ok(!JSON.stringify(f.session).includes('987654'));
 for(const override of [{id:'other'},{documentId:'other'},{url:'chrome-extension://extension/popup.html'},{frameId:1}])assert.deepEqual(await f.send(token,override),{ok:false});
 assert.deepEqual(await f.send('old'),{ok:false});assert.equal(reads,0);
 const simultaneous=await Promise.all([f.send(token),f.send(token)]);assert.equal(simultaneous.filter(r=>r.ok).length,1);assert.equal(reads,1);assert.deepEqual(await f.send(token),{ok:false});
});
test('session source recovers after tracker restart with exact account and mail, then consumes once',async()=>{
 const f=fixture(),tracker=createOtpPasteTracker(),bridge=startOtpPasteBridge(tracker,f.api);let reads=0;
 const mail={id:'mail',account:{id:2,getEmail:()=> 'a@example.com'},markAsRead:async()=>reads++};
 await bridge.arm(mail,'123456');await bridge.refresh();const token=tracker.current().token;tracker.clear();startOtpPasteBridge(createOtpPasteTracker(),f.api);
 const previous=globalThis.getAccountByEmail;globalThis.getAccountByEmail=email=>email==='a@example.com'?{getMails:()=>[mail]}:null;
 try{assert.deepEqual(await f.send(token),{ok:true});assert.equal(reads,1);assert.deepEqual(await f.send(token),{ok:false});}finally{globalThis.getAccountByEmail=previous;}
});
test('disabled feature and expired session never call read API',async()=>{
 for(const expired of [false,true]){
  const f=fixture(),tracker=createOtpPasteTracker(),bridge=startOtpPasteBridge(tracker,f.api);await bridge.arm({id:'mail',markAsRead(){assert.fail('must stay unread')}},'123456');await bridge.refresh();const token=tracker.current().token;
  if(expired)f.session['core.mailOtpPastePending'].expires=0;else f.local['core.mailOtpEnabled']=false;
  assert.deepEqual(await f.send(token),{ok:false});
 }
});
