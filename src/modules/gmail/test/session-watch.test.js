import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {Window} from 'happy-dom';

test('session polling baselines accounts, detects changes, skips logged-out feeds and serializes ticks', async () => {
    const window = new Window();
    let tick, enabled = false, changes = 0, code = 'one', pending, reads = 0;
    const context = {
        navigator:{onLine:true}, DOMParser:window.DOMParser, AbortSignal,
        setInterval(fn, ms) {assert.equal(ms,1000); tick=fn;},
        chrome:{runtime:{async sendMessage(message) {
            if (message.command === 'BongExtendGetSessionWatchConfig') return {enabled, accounts:[0,1,0,-1,20,'2']};
            assert.equal(message.command,'BongExtendMailSessionChanged'); changes++;
        }}},
        async fetch(url, options) {
            reads++;
            assert.equal(options.credentials,'include'); assert.equal(options.cache,'no-store');
            if (pending) await pending;
            return {ok:true,url, async text() {return url.includes('/u/1/') ? '<html>Sign in</html>' : `<feed><fullcount>1</fullcount><entry><id>${code}</id></entry></feed>`;}};
        },
    };
    vm.runInNewContext(readFileSync(new URL('../../../../public/js/gmail-session-watch.js',import.meta.url),'utf8'), context);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(reads,0);
    enabled=true; await tick(); assert.equal(changes,0); assert.equal(reads,2);
    await tick(); assert.equal(changes,0);
    code='two'; await tick(); assert.equal(changes,1);
    let release; pending=new Promise(resolve=>{release=resolve;});
    const running=tick(); await new Promise(resolve=>setImmediate(resolve));
    const previous=reads; await tick(); assert.equal(reads,previous); release(); await running;
    pending=null; enabled=false; await tick(); assert.equal(reads,previous);
    await window.happyDOM.close();
});

test('one-second session watcher honors server retry-after and isolates account failures',async()=>{
 const window=new Window();let tick,now=100000,reads=0;
 const context={navigator:{onLine:true},DOMParser:window.DOMParser,AbortSignal,
  Date:class extends Date{static now(){return now;}},setInterval(fn,ms){assert.equal(ms,1000);tick=fn;},
  chrome:{runtime:{sendMessage:async()=>({enabled:true,accounts:[0]})}},
  fetch:async()=>{reads++;return {ok:false,status:429,url:'https://mail.google.com/mail/u/0/feed/atom',headers:{get:()=> '20'}};}};
 try{
  vm.runInNewContext(readFileSync(new URL('../../../../public/js/gmail-session-watch.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(reads,1);
  now+=1000;await tick();assert.equal(reads,1);
  now+=19000;await tick();assert.equal(reads,2);
 }finally{await window.happyDOM.close();}
});
