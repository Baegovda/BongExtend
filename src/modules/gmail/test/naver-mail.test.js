import test from 'node:test';
import assert from 'node:assert/strict';
import {naverId,parseList,mailUrl,fetchNaverInbox} from '../../naver-mail/client.js';
test('네이버 아이디와 메일 링크는 허용된 형식으로 제한한다',()=>{
 assert.equal(naverId(' Test.user@naver.com '),'test.user');
 assert.equal(naverId('test@gmail.com'),'');assert.equal(naverId('../escape'),'');
 assert.equal(mailUrl('1'),'https://mail.naver.com/v2/read/0/1');assert.equal(mailUrl('javascript:alert(1)'),'https://mail.naver.com/v2/folders/0/all');
});
test('네이버 목록을 정규화하고 로그인 오류와 예상 밖 형식을 구분한다',()=>{
 const value=parseList({mailData:[{mailSN:12,subject:'<img onerror=alert(1)>',fromName:'시험',receivedTime:100},{mailSN:'bad'}],totalCount:50});
 assert.equal(value.unread,50);assert.equal(value.messages.length,1);assert.equal(value.messages[0].time,100000);assert.equal(value.messages[0].subject,'<img onerror=alert(1)>');
 assert.throws(()=>parseList({Result:'FAIL'}));assert.deepEqual(parseList({mailData:[]}),{messages:[],unread:0});
});
test('목록만 요청하고 읽음·삭제·보내기를 실행하지 않는다',async()=>{
 let request;const result=await fetchNaverInbox('tester',async(url,options)=>{request={url,options};return {ok:true,json:async()=>({mailData:[]})};});
 assert.equal(request.url,'https://mail.naver.com/json/list');assert.equal(request.options.credentials,'include');assert.equal(request.options.redirect,'error');
 assert.equal(request.options.body.get('u'),'tester');assert.equal(request.options.body.get('isUnread'),'true');assert.equal(result.unread,0);
 await assert.rejects(fetchNaverInbox('tester',async()=>({ok:true,json:async()=>{throw Error('HTML login page')}})),/로그인/);
 await assert.rejects(fetchNaverInbox('tester',async()=>({status:429,headers:{get:()=>120}})),e=>e.retryAfter===120000);
});

test('합산 배지는 Gmail 원본 수를 보존하고 재계산해도 네이버 수를 중복하지 않는다',async t=>{
 const {paintToolbarBadge}=await import('../../toolbar-badge.js');
 const original=globalThis.chrome;t.after(()=>{globalThis.chrome=original;});
 const data={'gmail.unread':4,'core.naverMailUnread':3,'core.modules':{gmail:true}};let text;
 globalThis.chrome={storage:{local:{get:async()=>({...data}),set:async value=>Object.assign(data,value)}},action:{setBadgeText:async v=>{text=v.text},setBadgeBackgroundColor:async()=>{},setBadgeTextColor:async()=>{}}};
 await paintToolbarBadge(4);assert.equal(text,'7');assert.equal(data['gmail.unread'],4);assert.equal(data['core.mailUnreadTotal'],7);
 await paintToolbarBadge(4);assert.equal(text,'7');
 data['core.modules']={gmail:false};await paintToolbarBadge();assert.equal(text,'');assert.equal(data['core.mailUnreadTotal'],0);
});
