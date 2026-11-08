import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../content-log-power.js', import.meta.url), 'utf8');
const live = 'https://chzzk.naver.com/live/' + 'a'.repeat(32);
async function fixture(t, {enabled = true, moduleEnabled = true, url = live} = {}) {
  const window = new Window({url}), document = window.document;
  t.after(() => window.happyDOM.close());
  document.body.innerHTML = '<aside id="aside-chatting"><div id="reward"></div><div role="log"></div></aside>';
  window.HTMLElement.prototype.getClientRects = () => [{width:100, height:30}]; // 레이아웃은 별도 실제 Chrome 시험으로 검증해요.
  let now = 100000, id = 0, observer, syncChange, localChange, alive = true;
  const tasks = new Map();
  window.Date.now = () => now;
  window.setTimeout = (fn, ms) => {const key = ++id; tasks.set(key, {fn, at:now + ms}); return key;};
  window.setInterval = (fn, ms) => {const key = ++id; tasks.set(key, {fn, at:now + ms, ms}); return key;};
  window.clearTimeout = window.clearInterval = key => tasks.delete(key);
  window.MutationObserver = class {
    constructor(fn) {this.fn = fn;}
    observe() {observer = this;}
    disconnect() {if (observer === this) observer = null;}
  };
  window.BongAlive = () => alive;
  window.BCStore = {sync:{get:async () => ({autoLogPower:enabled})}, onChanged:{addListener:fn => {syncChange = fn;}}};
  window.chrome = {storage:{local:{get:async () => ({'core.modules':{chzzk:moduleEnabled}})}, onChanged:{addListener:fn => {localChange = fn;}}}};
  window.eval(source);
  await new Promise(resolve => setImmediate(resolve));
  function advance(ms = 250) {
    const end = now + ms;
    for (;;) {
      const next = [...tasks].filter(([,task]) => task.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [key, task] = next; now = task.at;
      if (task.ms) task.at += task.ms; else tasks.delete(key);
      task.fn();
    }
    now = end;
  }
  function changed() {observer?.fn([{target:document.querySelector('#reward')}]); advance();}
  let clicks = 0;
  document.addEventListener('click', () => clicks++);
  return {window, document, advance, changed, clicks:() => clicks, tasks,
    button(html = '<button class="live_chatting_power_button__hash">1시간 시청 통나무 파워 배달 완료! <span>100 받기</span></button>') {
      document.querySelector('#reward').innerHTML = html;
      return document.querySelector('#reward button');
    },
    setting(value) {syncChange({autoLogPower:{newValue:value}}, 'sync');},
    module(value) {localChange({'core.modules':{newValue:{chzzk:value}}}, 'local');},
    invalidate() {alive = false;}
  };
}

test('처음·지연 표시·같은 노드 재사용·다른 채널의 다음 보상을 수령한다', async t => {
  const f = await fixture(t);
  f.advance(); assert.equal(f.clicks(), 0);
  const button = f.button(); f.changed(); assert.equal(f.clicks(), 1);
  for (let i = 0; i < 10; i++) f.changed();
  assert.equal(f.clicks(), 1, '채팅/화면 갱신마다 중복 클릭하지 않는다');
  button.hidden = true; f.changed(); f.advance(3600000);
  button.hidden = false; f.changed(); assert.equal(f.clicks(), 2);
  f.window.history.pushState({}, '', '/live/' + 'b'.repeat(32));
  f.advance(20000); assert.equal(f.clicks(), 3);
});

test('실패 재시도는 15초 간격으로 3번까지이며 노드 교체로 제한을 우회하지 않는다', async t => {
  const f = await fixture(t); f.button(); f.changed();
  f.button(); f.changed(); assert.equal(f.clicks(), 1);
  f.advance(60000); assert.equal(f.clicks(), 3);
  f.advance(3600000); assert.equal(f.clicks(), 3);
  f.button(''); f.changed(); f.button(); f.changed(); assert.equal(f.clicks(), 4);
});

test('일반 버튼·채팅 메시지·숨김·비활성·완료·방송 외 페이지를 제외한다', async t => {
  const f = await fixture(t);
  for (const html of [
    '<button>100 받기</button>', '<button>통나무 파워 후원하기</button>',
    '<div role="log"><button class="power_button">통나무 파워 100 받기</button></div>',
    '<div style="display:none"><button class="power_button">100 받기</button></div>',
    '<div style="opacity:0"><button class="power_button">100 받기</button></div>',
    '<button hidden class="power_button">100 받기</button>',
    '<fieldset disabled><button class="power_button">100 받기</button></fieldset>',
    '<button aria-disabled="true" class="power_button">100 받기</button>',
    '<button class="power_button">100 받기 완료</button>'
  ]) {f.button(html); f.changed(); f.advance(16000); assert.equal(f.clicks(), 0, html);}
  const button = f.button('<button disabled class="power_button">100 받기</button>'); f.changed();
  button.disabled = false; f.changed(); assert.equal(f.clicks(), 1);
  f.window.history.pushState({}, '', '/video/123'); f.advance(60000); assert.equal(f.clicks(), 1);
  f.window.history.pushState({}, '', '/live/' + 'b'.repeat(32));
  f.button('<button>1시간 시청 통나무 파워 배달 완료! 100 받기</button>'); f.changed(); assert.equal(f.clicks(), 2);
});

test('설정·모듈 끄기와 확장 컨텍스트 종료 시 멈추고 켜면 재개한다', async t => {
  const f = await fixture(t, {enabled:false}); f.button(); f.advance(60000); assert.equal(f.clicks(), 0);
  f.setting(true); f.advance(); assert.equal(f.clicks(), 1);
  f.setting(false); f.advance(60000); assert.equal(f.clicks(), 1); assert.equal(f.tasks.size, 0);
  f.setting(true); f.module(false); f.advance(60000); assert.equal(f.clicks(), 1);
  f.module(true); f.advance(); assert.equal(f.clicks(), 2);
  f.invalidate(); f.advance(60000); assert.equal(f.clicks(), 2); assert.equal(f.tasks.size, 0);
});

test('처음부터 모듈이 꺼져 있으면 자동 클릭을 시작하지 않는다', async t => {
  const f = await fixture(t, {moduleEnabled:false}); f.button(); f.advance(60000);
  assert.equal(f.clicks(), 0); assert.equal(f.tasks.size, 0);
});
