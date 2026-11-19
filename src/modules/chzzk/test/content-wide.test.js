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
  return {requests, window, tick:async (step = 5000) => {now += step; tick(); await new Promise(resolve => setImmediate(resolve));}};
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

test('a wide layout that flickers off for a moment does not leave fullscreen', async t => {
  const f = fixture(t, () => ({ok:true, status:'fullscreen'}));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.requests.map(r => r.wide), [true]);
  assert.match(f.requests[0].detail, /is_large/);
  // 전체화면으로 바뀌는 순간 치지직이 잠깐 넓은 화면 표시를 뺐다가 다시 붙여요.
  const box = f.window.document.getElementById('live_player_layout'), button = f.window.document.querySelector('button');
  box.classList.remove('is_large'); button.setAttribute('aria-label', '넓은 화면');
  await f.tick(0);
  box.classList.add('is_large'); button.setAttribute('aria-label', '좁은 화면');
  await f.tick(600);
  assert.deepEqual(f.requests.map(r => r.wide), [true], 'no exit was sent');
});

test('turning wide mode off still leaves fullscreen after a short check', async t => {
  const f = fixture(t, () => ({ok:true, status:'fullscreen'}));
  await new Promise(resolve => setImmediate(resolve));
  const box = f.window.document.getElementById('live_player_layout'), button = f.window.document.querySelector('button');
  box.classList.remove('is_large'); button.setAttribute('aria-label', '넓은 화면');
  await f.tick(0);
  assert.deepEqual(f.requests.map(r => r.wide), [true], 'not yet');
  await f.tick(600);
  assert.deepEqual(f.requests.map(r => r.wide), [true, false]);
});
