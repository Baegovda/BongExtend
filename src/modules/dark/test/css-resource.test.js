import assert from 'node:assert/strict';
import {test} from 'node:test';
import {darkStylesheetPermission as permission} from '../css-resource.js';
import {darkStylesheetOrigins,fetchDarkStylesheet,MAX_DARK_CSS_BYTES} from '../css-resource.js';

test('generic CSS origins use exact existing page/resource grants without a site list',()=>{
 assert.deepEqual(darkStylesheetOrigins('https://www.musinsa.com/brand/example','https://static.msscdn.net/static/mds/main.CSS?v=1'),['https://www.musinsa.com/*','https://static.msscdn.net/*']);
 assert.deepEqual(darkStylesheetOrigins('https://example.com/','https://example.com/theme.css'),['https://example.com/*']);
 for(const bad of ['http://example.com/theme.css','https://127.0.0.1/theme.css','https://192.168.1.2/theme.css','https://[::1]/theme.css','https://foo.local/theme.css','https://example.com:8443/theme.css','https://user:pass@example.com/theme.css','https://example.com/theme.js','data:text/css,body{}'])assert.equal(darkStylesheetOrigins('https://example.com/',bad),null,bad);
 for(const page of ['file:///test','http://example.com/','https://localhost/','https://internal.test/'])assert.equal(darkStylesheetOrigins(page,'https://cdn.example.com/theme.css'),null,page);
});
test('CSS fetch omits credentials, refuses redirects/MIME, and bounds declared and streamed size',async()=>{
 let init;
 const text=await fetchDarkStylesheet('https://cdn.example.com/theme.css',{fetchImpl:async(url,options)=>{init=options;return new Response('body{color:red}',{headers:{'content-type':'text/css; charset=utf-8'}})}});
 assert.equal(text,'body{color:red}');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
 await assert.rejects(fetchDarkStylesheet('https://cdn.example.com/x.css',{fetchImpl:async()=>new Response('<html>',{headers:{'content-type':'text/html'}})}));
 await assert.rejects(fetchDarkStylesheet('https://cdn.example.com/x.css',{fetchImpl:async()=>new Response('small',{headers:{'content-type':'text/css','content-length':String(MAX_DARK_CSS_BYTES+1)}})}));
 let cancelled=false;
 await assert.rejects(fetchDarkStylesheet('https://cdn.example.com/x.css',{fetchImpl:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_DARK_CSS_BYTES+1))},cancel(){cancelled=true}}),{headers:{'content-type':'text/css'}})}));
 assert.equal(cancelled,true);
});

test('DC login can read its cross-origin DC stylesheets with existing permission', () => {
  assert.equal(permission('https://sign.dcinside.com/login', 'https://nstatic.dcinside.com/dc/w/css/login.css?v=1'), 'https://*.dcinside.com/*');
  assert.equal(permission('https://gall.dcinside.com/', 'https://ssl.dcinside.com/css/common.css'), 'https://*.dcinside.com/*');
});
test('Naver stylesheet routes keep their existing permission requirements', () => {
  assert.equal(permission('https://www.naver.com/', 'https://pm.pstatic.net/main.css'), 'https://*.pstatic.net/*');
  assert.equal(permission('https://www.naver.com/', 'https://spastatic.naver.com/main.css'), 'https://*.naver.com/*');
});
test('CSS bridge refuses unrelated origins, non-CSS, credentials and insecure resources', () => {
  for (const page of ['https://dcinside.com.evil.test/', 'https://unrelated.test/', 'http://sign.dcinside.com/'])
    assert.equal(permission(page, 'https://nstatic.dcinside.com/login.css'), null);
  for (const resource of ['https://dcinside.com.evil.test/login.css', 'https://nstatic.dcinside.com/login',
    'http://nstatic.dcinside.com/login.css', 'https://user:pass@nstatic.dcinside.com/login.css',
    'https://nstatic.dcinside.com:8443/login.css', 'https://pm.pstatic.net/main.css'])
    assert.equal(permission('https://sign.dcinside.com/login', resource), null);
});
