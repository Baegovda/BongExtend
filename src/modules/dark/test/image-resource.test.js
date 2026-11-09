import test from 'node:test';import assert from 'node:assert/strict';
import {darkImageOrigins,fetchDarkImage} from '../image-resource.js';
test('static image relay requires exact public HTTPS page and resource origins',()=>{
 assert.deepEqual(darkImageOrigins('https://site.example.com/a','https://cdn.example.com/icon.svg'),['https://site.example.com/*','https://cdn.example.com/*']);
 for(const resource of ['http://cdn.example.com/a','https://127.0.0.1/a','https://10.0.0.1/a','https://localhost/a','https://user:pass@cdn.example.com/a','https://cdn.example.com:8080/a','file:///secret'])assert.equal(darkImageOrigins('https://site.example.com',resource),null);
 assert.equal(darkImageOrigins('chrome-extension://id/popup.html','https://cdn.example.com/a'),null);
});
test('relay omits credentials and rejects redirects, active types and unbounded images',async()=>{
 let options;const result=await fetchDarkImage('https://cdn.example.com/icon.svg',{fetchImpl:async(_,o)=>{options=o;return new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}});}});
 assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(atob(result.data),'<svg/>');
 await assert.rejects(fetchDarkImage('url',{fetchImpl:async()=>new Response('<html/>',{headers:{'content-type':'text/html'}})}),/unsupported/);
 await assert.rejects(fetchDarkImage('url',{fetchImpl:async()=>new Response(new Uint8Array(131073),{headers:{'content-type':'image/png'}})}),/large/);
});
