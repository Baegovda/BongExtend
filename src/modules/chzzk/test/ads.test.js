import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {}; ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/ads.js', import.meta.url), 'utf8'), ctx);
const A = ctx.BongAds;

const playback = '{"media":[{"path":"https://cdn.example/live.m3u8"}]}';

test('광고 일정은 비우지 않는다. 빈 일정은 까만 막을 남긴다', () => {
  const schedule = {
    head: { version: '0.0.1', description: 'GFP Video Ad Schedule' },
    requestId: 'keep-me',
    videoAdScheduleId: 'LIVE_CHZZK_NDP_SCH',
    adBreaks: [{ id: 'PREROLL-1', adSources: [{ id: 'PREROLL-1-1' }] }]
  };
  assert.equal(A.patchAdResponse(schedule), false);
  assert.equal(schedule.adBreaks.length, 1);
  assert.equal(schedule.requestId, 'keep-me');
});

test('워터폴 광고 목록과 추적 주소는 그대로 둔다', () => {
  const waterfall = {
    head: { version: '0.0.1', description: 'Naver SSP Waterfall List' },
    adUnit: 'w_live',
    adDivId: 'live_player_layout',
    ads: [{ encrypted: 'x' }],
    eventTracking: { clicks: [{ url: 'https://siape.veta.naver.com/openrtb/nback' }] }
  };
  assert.equal(A.patchAdResponse(waterfall), false);
  assert.equal(waterfall.ads.length, 1);
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
  const flags = { liveId: 1, livePlaybackJson: playback, showPreroll: true, prerollEnabled: true };
  assert.equal(A.patchAdPayload(flags), true);
  assert.equal(flags.showPreroll, false);
  assert.equal(flags.prerollEnabled, false);
  assert.equal(flags.livePlaybackJson, playback);
  assert.equal(body.content.chatChannelId, 'chat-1');
  assert.equal(A.patchAdResponse(body), false);
  const bait = { liveId: 42, livePlaybackJson: playback, chatChannelId: 'c' };
  assert.equal(A.patchAdPayload(bait), true);
  assert.equal(JSON.stringify(bait.playerAdDisplayResponse), '{"preRoll":false,"midRoll":false,"postRoll":false}');
  assert.equal(bait.liveId, 42);
  assert.equal(bait.livePlaybackJson, playback);
  const numeric = { livePlaybackJson: playback, playerAdDisplayResponse: { preRoll: 1, midRoll: 'Y', postRoll: false } };
  assert.equal(A.patchAdPayload(numeric), true);
  assert.equal(numeric.playerAdDisplayResponse.preRoll, false);
  assert.equal(numeric.playerAdDisplayResponse.midRoll, false);
  assert.equal(numeric.playerAdDisplayResponse.postRoll, false);
});

test('채널 정보의 playerAdFlag 광고 표시도 끈다', () => {
  const response = {
    content: {
      channelId: 'channel-1',
      playerAdFlag: { preRoll: true, midRoll: true, postRoll: true }
    }
  };
  assert.equal(A.patchAdResponse(response), true);
  assert.deepEqual(response.content.playerAdFlag, { preRoll: false, midRoll: false, postRoll: false });
  assert.equal('playerAdDisplayResponse' in response.content, false);
  assert.equal(A.patchAdResponse(response), false);
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
  assert.equal(A.patchAdPayload(media), true);
  assert.equal(media.event, 'START');
  assert.equal(media.playerAdDisplayResponse.preRoll, false);
  assert.equal(media.livePlaybackJson, playback);
});

test('광고 일정 주소는 가로채지 않고 미드롤 신호만 끊는다', () => {
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/vas?x=1'), false);
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/gfp/v1'), false);
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/call'), false);
  assert.equal(A.isAdEndpoint('https://gfp.veta.naver.com/adcall?y=1'), false);
  assert.equal(A.isAdEndpoint('https://siape.veta.naver.com/openrtb/nback'), false);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/ad-polling/v1/lives/123/ad'), true);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/service/v3/lives/abc/ads/current?z=1'), true);
  assert.equal(A.isAdEndpoint('https://nam.veta.naver.com/vas', 'OPTIONS'), false);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/service/v1/seoraksan'), false);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/service/v2/channels/abc/live-detail'), false);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/polling/v3.1/channels/abc/live-status'), false);
  assert.equal(A.emptyBodyFor('https://api.chzzk.naver.com/service/v1/seoraksan'), null);
  assert.equal(A.emptyBodyFor('https://nam.veta.naver.com/vas'), null);
  assert.equal(JSON.parse(A.emptyBodyFor('https://api.chzzk.naver.com/service/v1/lives/abc/ads/current')).content.event, 'ABORT');
});

test('동적 규칙은 광고 스크립트와 빈 일정을 넣지 않는다', () => {
  const rules = A.chzzkAdRules();
  assert.equal(rules.length, 0);
  assert.ok(A.CHZZK_AD_RULE_IDS.length > 0);
  assert.equal(existsSync(new URL('../empty-ad-poll.json', import.meta.url)), true);
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

test('fetch 는 광고 일정을 막지 않고 재생 JSON 의 광고 표시만 끈다', async () => {
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
  const schedule = await win.fetch('https://nam.veta.naver.com/vas?x=1');
  assert.equal(calls, 1);
  const scheduleData = await schedule.json();
  assert.equal(scheduleData.content.livePlaybackJson, playback);
  assert.equal(scheduleData.content.playerAdDisplayResponse.preRoll, false);
  const live = await win.fetch('https://api.chzzk.naver.com/service/v1/seoraksan');
  assert.equal(calls, 2);
  const data = await live.json();
  assert.equal(data.content.playerAdDisplayResponse.preRoll, false);
  assert.equal(data.content.livePlaybackJson, playback);
  assert.equal(data.content.skipPreRollAd, true);
  const statusRaw = JSON.stringify({ code: 200, content: { status: 'OPEN', concurrentUserCount: 4, liveId: 1 } });
  win.fetch = async () => new FakeResponse(statusRaw, { headers: { 'content-type': 'application/json' } });
  // 이미 설치된 훅이 원본 fetch 를 가리키므로, 시청자 조회는 JSON.parse 경로로 확인한다.
  const status = win.JSON.parse(statusRaw);
  assert.equal(status.content.concurrentUserCount, 4);
  const channelRaw = JSON.stringify({ content: { playerAdFlag: { preRoll: true, midRoll: true, postRoll: true } } });
  const channel = win.JSON.parse(channelRaw);
  assert.deepEqual(channel.content.playerAdFlag, { preRoll: false, midRoll: false, postRoll: false });
  const chat = win.JSON.parse('{"content":{"message":"안녕"}}');
  assert.equal(chat.content.message, '안녕');
});

test('광고 차단이 꺼지면 응답을 바꾸지 않는다', () => {
  const win = makeWin(async () => new FakeResponse('{}'));
  A.installAdHooks(win, () => false);
  const schedule = { head: { description: 'GFP Video Ad Schedule' }, videoAdScheduleId: 'LIVE_CHZZK_NDP_SCH', adBreaks: [{ id: 'a' }] };
  assert.equal(win.JSON.parse(JSON.stringify(schedule)).adBreaks.length, 1);
});

test('새 광고 결정 응답의 이름이 바뀐 플래그도 JSON.parse 단계에서 차단한다', () => {
  const win = makeWin(async () => new FakeResponse('{}'));
  let enabled = true;
  A.installAdHooks(win, () => enabled);
  const raw = '{"livePlaybackJson":{"liveId":true,"chatChannelId":true}}';
  const result = win.JSON.parse(raw);
  assert.equal(result.playerAdDisplayResponse.preRoll, false);
  assert.equal(result.playerAdDisplayResponse.midRoll, false);
  assert.equal(result.livePlaybackJson.liveId, true, '원본 데이터는 보존한다');
  enabled = false;
  assert.equal('playerAdDisplayResponse' in win.JSON.parse(raw), false);
});

test('중첩된 광고 신호를 중단하고 채팅과 재생 주소는 보존한다', () => {
  const response = {data:{items:[{body:{adControlType:'INTEGRATION_CONTROL',event:'START',adCount:2}}]},chat:{message:'광고 START'}, livePlaybackJson:playback};
  assert.equal(A.patchAdResponse(response),true);
  assert.equal(response.data.items[0].body.event,'ABORT');
  assert.equal(response.data.items[0].body.adCount,0);
  assert.equal(response.chat.message,'광고 START');
  assert.equal(response.livePlaybackJson,playback);
  assert.equal(A.isAdEndpoint('https://api.chzzk.naver.com/service/v1.1/lives/a/ads/current'),true);
});

test('터널 복호화 뒤 자체 JSON 파서가 읽기 전에 광고 결정만 바꾼다', async () => {
  const win = makeWin(async () => new FakeResponse('{}'));
  let enabled = true, result = new TextEncoder().encode('{"livePlaybackJson":{"liveId":true,"chatChannelId":true}}').buffer;
  win.TextDecoder = TextDecoder; win.TextEncoder = TextEncoder;
  win.crypto = {subtle:{async decrypt() {assert.equal(this,win.crypto.subtle); return result;}}};
  A.installAdHooks(win, () => enabled);
  const patched = JSON.parse(new TextDecoder().decode(await win.crypto.subtle.decrypt({name:'AES-GCM'})));
  assert.equal(patched.playerAdDisplayResponse.preRoll,false);
  assert.equal(patched.playerAdDisplayResponse.midRoll,false);
  result = new Uint8Array([0,1,2,3]).buffer;
  assert.equal(await win.crypto.subtle.decrypt({name:'AES-GCM'}),result, '미디어 바이트는 보존한다');
  result = new TextEncoder().encode('{"content":{"message":"채팅"}}').buffer;
  assert.equal(await win.crypto.subtle.decrypt({name:'AES-GCM'}),result);
  enabled=false;
  result = new TextEncoder().encode('{"livePlaybackJson":{"liveId":true}}').buffer;
  assert.equal(await win.crypto.subtle.decrypt({name:'AES-GCM'}),result);
});

test('XHR 재생 응답은 광고 표시만 끄고 미드롤 신호만 요청하지 않는다', async () => {
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
  assert.equal(ad._sent, true);
  const poll = new win.XMLHttpRequest();
  poll.open('GET', 'https://api.chzzk.naver.com/service/v1/lives/abc/ads/current');
  poll.send();
  assert.equal(poll._sent, false);
  assert.equal(JSON.parse(poll.responseText).content.event, 'ABORT');
});
