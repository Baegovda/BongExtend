import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
import {fetchNaverMessage,parseMessage} from '../../naver-mail/client.js';
import {messageDocument,safeMailUrl} from '../../naver-mail/message.js';
test('only the requested Naver message is fetched with the connected session',async()=>{
 let request;const message=await fetchNaverMessage('fixture-user','125',{fetchImpl:async(url,options)=>{request={url,options};return new Response(JSON.stringify({mailInfo:{mailSN:125,subject:'제목',body:'<p>본문</p>'}}));}});
 assert.equal(request.url,'https://mail.naver.com/json/read');assert.equal(request.options.credentials,'include');assert.equal(request.options.redirect,'error');assert.equal(request.options.body.get('mailSN'),'125');assert.equal(request.options.body.get('u'),'fixture-user');assert.equal(message.html,'<p>본문</p>');
 await assert.rejects(fetchNaverMessage('fixture-user','../1'),/주소/);
 assert.throws(()=>parseMessage({mailInfo:{mailSN:126,body:'other'}},'125'),/다른 메일/);
 assert.throws(()=>parseMessage({Result:'FAIL'},'125'),/로그인/);
 assert.equal(parseMessage({mailInfo:{mailSN:125},mailBody:{content:'separate body'}},'125').html,'separate body');
});
test('login, throttling and cancellation do not render a successful message',async()=>{
 await assert.rejects(fetchNaverMessage('fixture-user','125',{fetchImpl:async()=>{throw new TypeError('Failed to fetch');}}),/연결하지 못했어요/);
 await assert.rejects(fetchNaverMessage('fixture-user','125',{fetchImpl:async()=>new Response('<html>login</html>')}),/로그인/);
 await assert.rejects(fetchNaverMessage('fixture-user','125',{fetchImpl:async()=>new Response('',{status:429})}),/제한/);
 const controller=new AbortController();controller.abort();await assert.rejects(fetchNaverMessage('fixture-user','125',{signal:controller.signal,fetchImpl:async(_,options)=>{options.signal.throwIfAborted();}}),e=>e.name==='AbortError');
});
test('sender colors/images survive while executable mail markup is removed',async t=>{
 const window=new Window();t.after(()=>window.happyDOM.close());
 const html=messageDocument(window.document,{html:'<body style="background-color:#fff;color:#111"><h2 style="color:#ab1234">메일</h2><img src="https://example.test/photo.png" onerror="alert(1)"><a href="javascript:alert(1)">bad</a><a href="https://example.test/">safe</a><script>chrome.storage.local.clear()</script><iframe src="https://example.test"></iframe><form action="https://example.test"><input value="private"></form><style>body{display:none}</style><div style="background:url(https://example.test/track);color:blue">content</div></body>'},80);
 const doc=new window.DOMParser().parseFromString(html,'text/html');
 assert.equal(doc.querySelectorAll('script,iframe,form,input,svg').length,0);assert.equal(doc.querySelector('h2').style.color,'#ab1234');assert.equal(doc.querySelector('img').getAttribute('src'),'https://example.test/photo.png');assert.equal(doc.querySelector('img').hasAttribute('onerror'),false);assert.equal(doc.querySelector('a').hasAttribute('href'),false);assert.equal(doc.querySelectorAll('a')[1].rel,'noopener noreferrer');assert.equal(doc.querySelector('div').style.background,'');assert.match(doc.querySelector('meta').content,/script-src 'none'/);assert.match(doc.querySelector('style').textContent,/zoom:0.8/);
 assert.equal(safeMailUrl('data:text/html,x',true),null);assert.equal(safeMailUrl('chrome-extension://secret'),null);
 const plain=messageDocument(window.document,{html:'<script>text only</script>',plain:true});assert.match(plain,/&lt;script&gt;text only&lt;\/script&gt;/);
});
