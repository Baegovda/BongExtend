import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';

function fixture(t, reply) {
  const window = new Window({url:'https://chzzk.naver.com/live/' + 'a'.repeat(32)});
  t.after(() => window.happyDOM.close());
  window.document.body.innerHTML = '<main id="live_player_layout" class="is_large"><button class="pzp-pc-viewmode-button" aria-label="기본 화면"></button><video></video></main>';
  let tick, now = 10000;
  window.Date.now = () => now;
  window.setInterval = fn => {tick = fn; return 1;};
  window.BCStore = {sync:{get:(_, callback) => queueMicrotask(() => callback({autoWide:false, wideFullscreen:true}))}, onChanged:{addListener(){}}};
  const requests = [];
  window.chrome = {runtime:{id:'self',onMessage:{addListener(){}},sendMessage:async message => {requests.push(message); return reply(requests.length);}}};
  window.eval(readFileSync(new URL('../lib/wide.js', import.meta.url), 'utf8'));
  window.eval(readFileSync(new URL('../content-wide.js', import.meta.url), 'utf8'));
  return {requests, tick:async () => {now += 5000; tick(); await new Promise(resolve => setImmediate(resolve));}};
}

test('wide fullscreen retries a transient rejected request without another layout change', async t => {
  const f = fixture(t, n => n === 1 ? {ok:false,status:'inactive'} : {ok:true,status:'fullscreen'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests.length, 1);
  await f.tick();
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].wide, true);
  await f.tick(); assert.equal(f.requests.length, 2, 'acknowledged state is not resent');
});

test('permanent API failures stop after a bounded number of attempts', async t => {
  const f = fixture(t, () => {throw Error('Window API rejected');});
  await new Promise(resolve => setImmediate(resolve));
  for (let i=0; i<30; i++) await f.tick();
  assert.equal(f.requests.length, 12);
});

test('an unfocused window keeps being retried without using up the attempt budget', async t => {
  const f = fixture(t, n => n < 20 ? {ok:false,status:'inactive'} : {ok:true,status:'fullscreen'});
  await new Promise(resolve => setImmediate(resolve));
  for (let i=0; i<25; i++) await f.tick();
  assert.equal(f.requests.length, 20, 'stops once the window finally accepted fullscreen');
});

test('a transiently unavailable window keeps being retried past the normal attempt budget', async t => {
  const f = fixture(t, n => n < 20 ? {ok:false,status:'unavailable'} : {ok:true,status:'fullscreen'});
  await new Promise(resolve => setImmediate(resolve));
  for (let i=0; i<40; i++) await f.tick();
  assert.equal(f.requests.length, 20, 'stops once the window finally accepted fullscreen');
});

test('manual fullscreen exit and disabled settings are not repeatedly overridden', async t => {
  for (const reply of [{ok:true,status:'manual-exit'}, {ok:false,status:'disabled'}]) {
    const f = fixture(t, () => reply);
    await new Promise(resolve => setImmediate(resolve));
    for (let i=0; i<4; i++) await f.tick();
    assert.equal(f.requests.length, 1);
  }
});
