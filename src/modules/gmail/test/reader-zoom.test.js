import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {readFileSync} from 'node:fs';
test('mail wheel zoom consumes only modified body gestures and stays bounded',async t=>{
 const window=new Window();t.after(()=>window.happyDOM.close());window.eval(readFileSync(new URL('../../../../public/js/bongextend-reader-zoom.js',import.meta.url),'utf8'));
 const body=window.document.createElement('div');window.document.body.append(body);let value=80;
 const stop=window.BongExtendReaderZoom.bind(body,{get:()=>value,set:next=>{value=next;}});
 const wheel=(deltaY,ctrlKey)=>{const event=new window.WheelEvent('wheel',{deltaY,ctrlKey,bubbles:true,cancelable:true});Object.defineProperty(event,'ctrlKey',{value:ctrlKey});body.dispatchEvent(event);return event;};
 assert.equal(wheel(100,false).defaultPrevented,false);assert.equal(value,80);
 assert.equal(wheel(-100,true).defaultPrevented,true);assert.equal(value,90);wheel(100,true);assert.equal(value,80);
 value=200;wheel(-100,true);assert.equal(value,200);value=50;wheel(100,true);assert.equal(value,50);
 stop();assert.equal(wheel(-100,true).defaultPrevented,false);assert.equal(value,50);
});
