import test from 'node:test';import assert from 'node:assert/strict';
import {startVerticalTabBridge} from '../vertical-tabs.js';
test('native tab shortcut only accepts focused, active Chzzk tabs and uses the browser title',async()=>{
 let listener,opened=0,nativeMessage,focused=false,saved,handler;
 const port={onMessage:{addListener:fn=>handler=fn},onDisconnect:{addListener(){}},postMessage:msg=>{nativeMessage=msg;queueMicrotask(()=>handler({type:'tabs',status:'already-collapsed'}));},disconnect(){}};
 globalThis.chrome={runtime:{id:'self',onMessage:{addListener:fn=>listener=fn},connectNative:()=>{opened++;return port;}},windows:{get:async()=>({focused})},storage:{local:{get:async()=>({}),set:async value=>{saved=value;}}}};
 startVerticalTabBridge();const sender={id:'self',url:'https://chzzk.naver.com/live/'+'a'.repeat(32),tab:{active:true,windowId:9,title:'실제 방송 제목',url:'https://chzzk.naver.com/live/'+'a'.repeat(32)}};
 assert.equal(listener({type:'BONG_COLLAPSE_VERTICAL_TABS'},{...sender,url:'https://example.com/'},()=>assert.fail()),undefined);
 await new Promise(resolve=>listener({type:'BONG_COLLAPSE_VERTICAL_TABS'},sender,resolve));assert.equal(opened,0);
 focused=true;await new Promise(resolve=>listener({type:'BONG_COLLAPSE_VERTICAL_TABS',title:'forged',expandedHint:true},sender,resolve));assert.equal(nativeMessage.title,'실제 방송 제목');assert.equal(nativeMessage.expandedHint,true);assert.equal(saved['core.chzzkTabs:status'],'already-collapsed');
});
