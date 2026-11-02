import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/ads.js', import.meta.url), 'utf8'), ctx);
const A = ctx.BongAds;

const playback = '{"media":[{"path":"https://cdn.example/live.m3u8"}]}';

test('GFP 일정에서 광고만 비우고 나머지 필드는 둔다', () => {
  const schedule = {
    head: { version: '0.0.1', description: 'GFP Video Ad Schedule' },
    requestId: 'keep-me',
    videoAdScheduleId: 'LIVE_CHZZK_NDP_SCH',
    adBreaks: [{ id: 'PREROLL-1', adSources: [{ id: 'PREROLL-1-1' }] }]
  };
  assert.equal(A.patchAdResponse(schedule), true);
  assert.equal(JSON.stringify(schedule.adBreaks), '[]');
  assert.equal(schedule.requestId, 'keep-me');
});

test('워터폴 광고 목록만 비우고 추적 주소는 둔다', () => {
  const waterfall = {
    head: { version: '0.0.1', description: 'Naver SSP Waterfall List' },
    adUnit: 'w_live',
    adDivId: 'live_player_layout',
    ads: [{ encrypted: 'x' }],
    eventTracking: { clicks: [{ url: 'https://siape.veta.naver.com/openrtb/nback' }] }
  };
  assert.equal(A.patchAdResponse(waterfall), true);
  assert.equal(JSON.stringify(waterfall.ads), '[]');
  assert.equal(waterfall.eventTracking.clicks[0].url, 'https://siape.veta.naver.com/openrtb/nback');
});

test('재생 주소는 두고 프리롤·미드롤 표시만 끈다', () => {
  const body = {
    code: 200,
    content: {
      playerAdDisplayResponse: { preRoll: true, midRoll: true, postRoll: true },
      livePlaybackJson: playback,
      liveId: 9,
      skipPreRollAd: false,
      chatChannelId: 'chat-1'
    }
  };
  assert.equal(A.patchAdResponse(body), true);
  assert.equal(body.content.playerAdDisplayResponse.preRoll, false);
  assert.equal(body.content.playerAdDisplayResponse.midRoll, false);
  assert.equal(body.content.playerAdDisplayResponse.postRoll, false);
  assert.equal(body.content.livePlaybackJson, playback);
  assert.equal(body.content.liveId, 9);
  assert.equal(body.content.skipPreRollAd, true);
  assert.equal(body.content.chatChannelId, 'chat-1');
  assert.equal(A.patchAdResponse(body), false);
});

test('시청자 수·채팅·상품 목록은 바꾸지 않는다', () => {
  const live = { code: 200, content: { status: 'OPEN', concurrentUserCount: 3, liveId: 1, chatChannelId: 'abc' } };
  const chat = { content: { message: '안녕', userIdHash: 'u' } };
  const shop = { ads: [{ name: '상품' }], title: '추천' };
  assert.equal(A.patchAdResponse(live), false);
  assert.equal(live.content.concurrentUserCount, 3);
  assert.equal(A.patchAdResponse(chat), false);
  assert.equal(chat.content.message, '안녕');
  assert.equal(A.patchAdResponse(shop), false);
  assert.equal(shop.ads.length, 1);
  assert.equal(A.patchAdResponse(null), false);
  assert.equal(A.patchAdResponse('live'), false);
});

test('광고 폴링만 중단으로 바꾸고 재생 객체는 중단하지 않는다', () => {
  const poll = { adControlType: 'LIVE', event: 'START', adCount: 2, id: 'break-1' };
  assert.equal(A.patchAdResponse(poll), true);
  assert.equal(poll.event, 'ABORT');
  assert.equal(poll.adCount, 0);
  assert.equal(poll.id, 'break-1');
  const media = { liveId: 3, livePlaybackJson: playback, adControlType: 'LIVE', event: 'START', adCount: 1 };
  assert.equal(A.patchAdPayload(media), false);
  assert.equal(media.event, 'START');
});

test('광고 전용 주소만 가로챈다', () => {
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/vas?x=1'), true);
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/gfp/v1'), true);
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/call'), true);
  assert.equal(A.isAdEndpoint('https://gfp.veta.naver.com/adcall?y=1'), true);
  assert.equal(A.isAdEndpoint('https://siape.veta.naver.com/openrtb/nback'), true);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/ad-polling/v1/lives/123/ad'), true);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/service/v3/lives/abc/ads/current?z=1'), true);
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/vas', 'OPTIONS'), false);
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/nac/'), false);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/service/v1/seoraksan'), false);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/service/v2/channels/abc/live-detail'), false);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/polling/v3.1/channels/abc/live-status'), false);
  assert.equal(A.emptyBodyFor('https://api.chzzk.naver.com/service/v1/seoraksan'), null);
  assert.deepEqual(JSON.parse(A.emptyBodyFor('https://nam.veta.naver.com/vas')).adBreaks, []);
  assert.deepEqual(JSON.parse(A.emptyBodyFor('https://siape.veta.naver.com/openrtb/x')).ads, []);
  assert.equal(JSON.parse(A.emptyBodyFor('https://api.chzzk.naver.com/service/v1/lives/abc/ads/current')).content.event, 'ABORT');
});

test('동적 규칙은 광고 주소만 바꾸고 재생 API 는 빼 둔다', () => {
  const rules = A.chzzkAdRules();
  assert.deepEqual(rules.map(rule => rule.id), A.CHZZK_AD_RULE_IDS);
  const blob = JSON.stringify(rules);
  assert.equal(/seoraksan|live-detail|live-status|chatChannel/.test(blob), false);
  assert.match(blob, /gfp-instream/);
  assert.match(blob, /glad_admute/);
  assert.match(blob, /ima3\.js/);
  for (const rule of rules) {
    assert.equal(rule.action.type, 'redirect');
    assert.equal(rule.condition.initiatorDomains[0], 'chzzk.naver.com');
    const rel = rule.action.redirect.extensionPath.replace(/^\/chzzk\//, '');
    assert.equal(existsSync(new URL('../' + rel, import.meta.url)), true);
    if (!rule.condition.resourceTypes.includes('script')) assert.equal(JSON.stringify(rule.condition.excludedRequestMethods), '["options"]');
  }
  assert.deepEqual(JSON.parse(readFileSync(new URL('../empty-ad-schedule.json', import.meta.url), 'utf8')), JSON.parse(A.emptyBodyFor('https://nam.veta.naver.com/vas')));
  assert.deepEqual(JSON.parse(readFileSync(new URL('../empty-ad-waterfall.json', import.meta.url), 'utf8')), JSON.parse(A.emptyBodyFor('https://nam.veta.naver.com/gfp')));
  assert.deepEqual(JSON.parse(readFileSync(new URL('../empty-ad-poll.json', import.meta.url), 'utf8')), JSON.parse(A.emptyBodyFor('https://api.chzzk.naver.com/ad-polling/v1/lives/1/ad')));
});

function headerMap(obj) {
  const map = new Map(Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: name => map.get(String(name).toLowerCase()) ?? null };
}
class FakeResponse {
  constructor(body, init = {}) {
    this._body = String(body ?? '');
    this.status = init.status ?? 200;
    this.statusText = init.statusText || 'OK';
    this.headers = headerMap(init.headers || {});
  }
  clone() {
    return new FakeResponse(this._body, { status: this.status, statusText: this.statusText, headers: { 'content-type': this.headers.get('content-type') || '' } });
  }
  text() { return Promise.resolve(this._body); }
  json() { return Promise.resolve(JSON.parse(this._body)); }
}
function makeXhr() {
  class XHR {
    constructor() { this.readyState = 0; this.status = 0; this._raw = ''; this._sent = false; }
    open() { this.readyState = 1; }
    send() { this._sent = true; this.readyState = 4; this.status = 200; this._raw = this._body || ''; }
    addEventListener() {}
    dispatchEvent() { return true; }
  }
  Object.defineProperty(XHR.prototype, 'responseText', { configurable: true, get() { return this._raw; } });
  Object.defineProperty(XHR.prototype, 'response', { configurable: true, get() { return this._raw; } });
  return XHR;
}
function makeWin(fetchImpl) {
  return {
    JSON: { parse: JSON.parse, stringify: JSON.stringify },
    Response: FakeResponse,
    fetch: fetchImpl,
    XMLHttpRequest: makeXhr(),
    Event: class { constructor(type) { this.type = type; } },
    queueMicrotask: fn => queueMicrotask(fn)
  };
}

test('fetch 는 광고 주소를 네트워크 전에 비우고 재생 JSON 은 주소만 유지한다', async () => {
  let calls = 0;
  const win = makeWin(async () => {
    calls += 1;
    return new FakeResponse(JSON.stringify({
      code: 200,
      content: {
        playerAdDisplayResponse: { preRoll: true, midRoll: true, postRoll: true },
        livePlaybackJson: playback,
        liveId: 9,
        skipPreRollAd: false
      }
    }), { headers: { 'content-type': 'application/json' } });
  });
  assert.equal(A.installAdHooks(win, () => true), true);
  const blocked = await win.fetch('https://nam.veta.naver.com/vas?x=1');
  assert.equal(calls, 0);
  assert.deepEqual((await blocked.json()).adBreaks, []);
  const live = await win.fetch('https://api.chzzk.naver.com/service/v1/seoraksan');
  assert.equal(calls, 1);
  const data = await live.json();
  assert.equal(data.content.playerAdDisplayResponse.preRoll, false);
  assert.equal(data.content.livePlaybackJson, playback);
  assert.equal(data.content.skipPreRollAd, true);
  const statusRaw = JSON.stringify({ code: 200, content: { status: 'OPEN', concurrentUserCount: 4, liveId: 1 } });
  win.fetch = async () => new FakeResponse(statusRaw, { headers: { 'content-type': 'application/json' } });
  // 이미 설치된 훅이 원본 fetch 를 가리키므로, 시청자 조회는 JSON.parse 경로로 확인한다.
  const status = win.JSON.parse(statusRaw);
  assert.equal(status.content.concurrentUserCount, 4);
  const chat = win.JSON.parse('{"content":{"message":"안녕"}}');
  assert.equal(chat.content.message, '안녕');
});

test('광고 차단이 꺼지면 응답을 바꾸지 않는다', () => {
  const win = makeWin(async () => new FakeResponse('{}'));
  A.installAdHooks(win, () => false);
  const schedule = { head: { description: 'GFP Video Ad Schedule' }, videoAdScheduleId: 'LIVE_CHZZK_NDP_SCH', adBreaks: [{ id: 'a' }] };
  assert.equal(win.JSON.parse(JSON.stringify(schedule)).adBreaks.length, 1);
});

test('XHR 재생 응답은 광고 표시만 끄고 광고 주소는 요청하지 않는다', async () => {
  const win = makeWin(async () => new FakeResponse('{}'));
  A.installAdHooks(win, () => true);
  const live = new win.XMLHttpRequest();
  live._body = JSON.stringify({
    code: 200,
    content: { playerAdDisplayResponse: { preRoll: true, midRoll: false, postRoll: true }, livePlaybackJson: playback, liveId: 2 }
  });
  live.open('GET', 'https://api.chzzk.naver.com/service/v1/seoraksan');
  live.send();
  assert.equal(live._sent, true);
  const data = JSON.parse(live.responseText);
  assert.equal(data.content.playerAdDisplayResponse.preRoll, false);
  assert.equal(data.content.livePlaybackJson, playback);
  const ad = new win.XMLHttpRequest();
  ad.open('POST', 'https://nam.veta.naver.com/gfp');
  ad.send();
  assert.equal(ad._sent, false);
  assert.equal(ad.status, 200);
  assert.deepEqual(JSON.parse(ad.responseText).ads, []);
});
