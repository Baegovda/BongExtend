import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../content-log-count.js', import.meta.url), 'utf8');
const id = 'a'.repeat(32);
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

async function fixture(t, {amounts = [1200], status = 200, enabled = true, loggedIn = true} = {}) {
  const window = new Window({url: 'https://chzzk.naver.com/live/' + id}), document = window.document;
  t.after(() => window.happyDOM.close());
  document.body.innerHTML = '<aside id="aside-chatting"><div class="live_chatting_input_tools__x"><button class="live_chatting_input_donation_button__y">후원</button></div></aside>';
  const store = {}, listeners = [];
  const timers = [];
  window.setTimeout = (fn) => { timers.push(fn); return timers.length; };
  window.setInterval = () => 1; window.clearInterval = () => {};
  let calls = 0;
  window.fetch = async (url) => {
    if (url.includes('getUserStatus')) return {ok: true, status: 200, json: async () => ({content: {loggedIn}})};
    calls++;
    if (url.endsWith('/log-power')) {
      const amount = amounts[Math.min(calls - 1, amounts.length - 1)];
      return {ok: status === 200, status, json: async () => ({code: status, content: {amount}})};
    }
    return {ok: true, status: 200, json: async () => ({content: {channelName: '테스트 채널'}})};
  };
  window.BCStore = {
    sync: {get: async () => ({logPowerCount: enabled})},
    local: {get: async (d) => ({...d, ...store}), set: async (o) => { Object.assign(store, JSON.parse(JSON.stringify(o))); }},
    onChanged: {addListener: (fn) => listeners.push(fn)}
  };
  window.chrome = {storage: {local: {get: async () => ({'core.modules': {chzzk: true}})}, onChanged: {addListener() {}}}};
  window.confirm = () => true;
  window.eval(source);
  await flush();
  const runTimers = async () => { while (timers.length) { timers.shift()(); await flush(); } };
  return {window, document, store, runTimers, setAmounts: (a) => { amounts = a; calls = 0; }};
}

test('채팅 후원 버튼 옆에 지금 방송의 내 통나무 개수를 보여준다', async (t) => {
  const f = await fixture(t);
  const badge = f.document.querySelector('.bongextend-logcount');
  assert.ok(badge, '배지가 생긴다');
  assert.equal(badge.previousElementSibling?.className, 'live_chatting_input_donation_button__y');
  assert.equal(badge.querySelector('.num').textContent, '1,200');
});

test('로그인하지 않았으면(401) 배지를 붙이지 않는다', async (t) => {
  const f = await fixture(t, {status: 401});
  assert.equal(f.document.querySelector('.bongextend-logcount'), null);
});

test('로그아웃 상태(치지직이 0개로 답함)면 배지를 붙이지 않는다', async (t) => {
  const f = await fixture(t, {amounts: [0], loggedIn: false});
  assert.equal(f.document.querySelector('.bongextend-logcount'), null);
});

test('설정을 끄면 배지가 없다', async (t) => {
  const f = await fixture(t, {enabled: false});
  assert.equal(f.document.querySelector('.bongextend-logcount'), null);
});

test('자동 받기를 누르면 기록하고, 늘어난 개수를 확인해 기록 창에 보여준다', async (t) => {
  const f = await fixture(t);
  f.setAmounts([1300]);
  const done = f.window.__bongLogPowerClicked({channel: id, text: '1시간 시청 통나무 파워 배달 완료! 100 받기'});
  await flush();
  let entry = f.store.logPowerHistory[0];
  assert.equal(entry.status, 'pending');
  assert.equal(entry.before, 1200);
  assert.equal(entry.reward, 100);
  await f.runTimers(); await done;
  entry = f.store.logPowerHistory[0];
  assert.equal(entry.status, 'ok');
  assert.equal(entry.gained, 100);
  assert.equal(entry.after, 1300);
  assert.equal(entry.name, '테스트 채널');
  assert.equal(f.document.querySelector('.bongextend-logcount .num').textContent, '1,300');

  f.document.querySelector('.bongextend-logcount').click();
  await flush();
  const panel = f.document.querySelector('.bongextend-logpanel');
  assert.ok(panel, '누르면 기록 창이 열린다');
  const row = panel.querySelector('li');
  assert.match(row.textContent, /테스트 채널/);
  assert.match(row.textContent, /\+100/);
  assert.match(row.textContent, /1,200 → 1,300/);
  f.document.querySelector('.bongextend-logcount').click();
  assert.equal(f.document.querySelector('.bongextend-logpanel'), null, '다시 누르면 닫힌다');
});

test('같은 보상의 재시도는 한 줄로 합치고, 개수가 안 늘면 확인 안 됨으로 남긴다', async (t) => {
  const f = await fixture(t);
  const a = f.window.__bongLogPowerClicked({channel: id, text: '100 받기'});
  await flush();
  const b = f.window.__bongLogPowerClicked({channel: id, text: '100 받기'});
  await flush();
  await f.runTimers(); await a; await b;
  assert.equal(f.store.logPowerHistory.length, 1);
  assert.equal(f.store.logPowerHistory[0].tries, 2);
  assert.equal(f.store.logPowerHistory[0].status, 'unknown');
});
