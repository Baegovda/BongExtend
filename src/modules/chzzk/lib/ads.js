// 치지직 광고 응답을 비우는 순수 로직 (전역 BongAds).
// 재생 주소(livePlaybackJson 등)는 바꾸지 않는다. 광고 일정·표시 플래그만 끈다.
(function (root) {
  'use strict';
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const PLAYBACK_KEYS = ['livePlaybackJson', 'liveRewindPlaybackJson', 'radioModePlaybackJson', 'previewPlaybackJson', 'playbackJson'];

  function isMediaPayload(payload) {
    if (typeof payload.liveId === 'number' || typeof payload.liveId === 'string') return true;
    if (typeof payload.videoNo === 'number' || typeof payload.videoNo === 'string') return true;
    return PLAYBACK_KEYS.some(key => key in payload);
  }

  function patchAdPayload(payload) {
    if (!isObj(payload)) return false;
    let changed = false;
    const head = isObj(payload.head) ? payload.head : null;
    const description = head ? head.description : '';

    if (Array.isArray(payload.adBreaks) && payload.adBreaks.length &&
        (description === 'GFP Video Ad Schedule' || typeof payload.videoAdScheduleId === 'string')) {
      payload.adBreaks = [];
      changed = true;
    }

    if (Array.isArray(payload.ads) && payload.ads.length &&
        (description === 'Naver SSP Waterfall List' ||
          (typeof payload.adUnit === 'string' && payload.adUnit && typeof payload.adDivId === 'string' && payload.adDivId))) {
      payload.ads = [];
      changed = true;
    }

    const display = payload.playerAdDisplayResponse;
    if (isObj(display)) {
      for (const key of ['preRoll', 'midRoll', 'postRoll']) {
        if (display[key] === true) {
          display[key] = false;
          changed = true;
        }
      }
    }

    // 재생 정보와 한 객체에 섞여 있으면 끄지 않는다. 광고 시작 신호만 중단으로 바꾼다.
    if (!isMediaPayload(payload) && typeof payload.adControlType === 'string' && payload.adControlType &&
        (typeof payload.event === 'string' || typeof payload.adCount === 'number') && payload.event !== 'ABORT') {
      payload.event = 'ABORT';
      if (typeof payload.adCount === 'number') payload.adCount = 0;
      changed = true;
    }

    if (isMediaPayload(payload) && payload.skipPreRollAd === false) {
      payload.skipPreRollAd = true;
      changed = true;
    }
    return changed;
  }

  function patchAdResponse(value) {
    if (Array.isArray(value)) {
      let changed = false;
      for (const item of value) if (patchAdPayload(item)) changed = true;
      return changed;
    }
    if (!isObj(value)) return false;
    let changed = patchAdPayload(value);
    const nests = [];
    if (isObj(value.content)) nests.push(value.content);
    if (isObj(value.live)) nests.push(value.live);
    if (isObj(value.video)) nests.push(value.video);
    if (isObj(value.content)) {
      if (isObj(value.content.live)) nests.push(value.content.live);
      if (isObj(value.content.video)) nests.push(value.content.video);
    }
    for (const nest of nests) if (patchAdPayload(nest)) changed = true;
    return changed;
  }

  function looksLikeAdJson(text) {
    return text.indexOf('playerAdDisplayResponse') !== -1
      || text.indexOf('adBreaks') !== -1
      || text.indexOf('videoAdScheduleId') !== -1
      || text.indexOf('skipPreRollAd') !== -1
      || text.indexOf('adControlType') !== -1
      || text.indexOf('Naver SSP') !== -1
      || text.indexOf('GFP Video Ad Schedule') !== -1
      || (text.indexOf('"ads"') !== -1 && text.indexOf('adDivId') !== -1);
  }

  // 광고 전용 주소. 재생(seoraksan, live-detail)과 채팅·시청자 조회는 여기 넣지 않는다.
  // OPTIONS 는 광고 차단 탐지에 쓰이므로 그대로 둔다.
  function isAdEndpoint(url, method) {
    if (String(method || 'GET').toUpperCase() === 'OPTIONS') return false;
    const u = String(url || '');
    if (/^https:\/\/nam\.veta\.naver\.com\/(vas|gfp|call)(?:\/|\?|$)/.test(u)) return true;
    if (/^https:\/\/gfp\.veta\.naver\.com\/adcall(?:\/|\?|$)/.test(u)) return true;
    if (/^https:\/\/siape\.veta\.naver\.com\/openrtb\//.test(u)) return true;
    if (/^https:\/\/api\.chzzk\.naver\.com\/ad-polling\/v\d+\/lives\/[^/?#]+\/ad(?:\/|\?|$)/.test(u)) return true;
    if (/^https:\/\/api\.chzzk\.naver\.com\/service\/v\d+\/lives\/[^/?#]+\/ads\/current(?:\/|\?|$)/.test(u)) return true;
    return false;
  }

  function emptySchedule() {
    return JSON.stringify({
      head: {version: '0.0.1', description: 'GFP Video Ad Schedule'},
      requestId: 'bongextend-no-ads',
      videoAdScheduleId: 'LIVE_CHZZK_NDP_SCH',
      adBreaks: []
    });
  }
  function emptyWaterfall() {
    return JSON.stringify({
      head: {version: '0.0.1', description: 'Naver SSP Waterfall List'},
      requestId: 'bongextend-no-ads',
      adUnit: '',
      adDivId: '',
      ads: []
    });
  }
  function emptyAdPoll() {
    return JSON.stringify({code: 200, content: {adControlType: 'NONE', event: 'ABORT', adCount: 0}});
  }
  function emptyBodyFor(url) {
    const u = String(url || '');
    if (!isAdEndpoint(u)) return null;
    if (/\/(gfp|call)(?:\/|\?|$)/.test(u) || /\/openrtb\//.test(u)) return emptyWaterfall();
    if (/ad-polling\/|\/ads\/current(?:\/|\?|$)/.test(u)) return emptyAdPoll();
    return emptySchedule();
  }

  function shouldInspectUrl(url) {
    const u = String(url || '');
    return /^https:\/\/api\.chzzk\.naver\.com\//.test(u) || /^https:\/\/(?:[a-z0-9-]+\.)?veta\.naver\.com\//.test(u);
  }

  const NOOP = '/chzzk/noop.js';
  const IMA = '/chzzk/ima-stub.js';
  const SCHEDULE = '/chzzk/empty-ad-schedule.json';
  const WATERFALL = '/chzzk/empty-ad-waterfall.json';
  const POLL = '/chzzk/empty-ad-poll.json';

  function redirectRule(id, filter, extensionPath, resourceTypes, options) {
    const condition = {
      resourceTypes,
      initiatorDomains: ['chzzk.naver.com']
    };
    if (options && options.regex) condition.regexFilter = filter;
    else condition.urlFilter = filter;
    if (!resourceTypes.includes('script')) condition.excludedRequestMethods = ['options'];
    return {
      id,
      priority: 1,
      action: {type: 'redirect', redirect: {extensionPath}},
      condition
    };
  }

  // 동적 규칙 id. 켜고 끌 때 이 목록만 지우고 다시 넣는다.
  const CHZZK_AD_RULE_IDS = [4101, 4102, 4103, 4104, 4105, 4106, 4107, 4108, 4109, 4110, 4111, 4112, 4113, 4114];

  function chzzkAdRules() {
    return [
      redirectRule(4101, '||ssl.pstatic.net/tveta/libs/gfp-instream/', NOOP, ['script']),
      redirectRule(4102, '||ssl.pstatic.net/tveta/libs/glad/prod/*gfp-display-sdk.js', NOOP, ['script']),
      redirectRule(4103, '||ssl.pstatic.net/tveta/libs/glad/prod/*gfp-display-nda.js', NOOP, ['script']),
      redirectRule(4104, '||ssl.pstatic.net/melona/libs/glad_admute/', NOOP, ['script']),
      redirectRule(4105, '||ssl.pstatic.net/melona/libs/gfp-nac-module/synchronizer.js', NOOP, ['script']),
      redirectRule(4106, '||s0.2mdn.net/instream/video/client.js', NOOP, ['script']),
      redirectRule(4107, '||imasdk.googleapis.com/js/sdkloader/ima3.js', IMA, ['script']),
      redirectRule(4108, '||nam.veta.naver.com/vas', SCHEDULE, ['xmlhttprequest', 'other']),
      redirectRule(4109, '||nam.veta.naver.com/gfp', WATERFALL, ['xmlhttprequest', 'other']),
      redirectRule(4110, '||nam.veta.naver.com/call', WATERFALL, ['xmlhttprequest', 'other']),
      redirectRule(4111, '||gfp.veta.naver.com/adcall', SCHEDULE, ['xmlhttprequest', 'other']),
      redirectRule(4112, '||siape.veta.naver.com/openrtb/', WATERFALL, ['xmlhttprequest', 'other']),
      redirectRule(4113, '^https://api\\.chzzk\\.naver\\.com/ad-polling/v\\d+/lives/[^/]+/ad', POLL, ['xmlhttprequest', 'other'], {regex: true}),
      redirectRule(4114, '^https://api\\.chzzk\\.naver\\.com/service/v\\d+/lives/[^/]+/ads/current', POLL, ['xmlhttprequest', 'other'], {regex: true})
    ];
  }

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }
  function requestMethod(input, init) {
    if (init && init.method) return init.method;
    if (input && typeof input.method === 'string') return input.method;
    return 'GET';
  }

  function installAdHooks(win, isEnabled) {
    if (!win || win.__bongAdHook || !win.JSON || typeof win.JSON.parse !== 'function') return false;
    win.__bongAdHook = true;
    const on = () => !isEnabled || isEnabled() !== false;
    const nativeParse = win.JSON.parse;

    function rewriteText(text) {
      if (typeof text !== 'string' || text.length < 2 || text.length > 2000000) return null;
      if (!looksLikeAdJson(text)) return null;
      try {
        const value = nativeParse(text);
        if (!patchAdResponse(value)) return null;
        return win.JSON.stringify(value);
      } catch (e) { return null; }
    }

    win.JSON.parse = function (text, reviver) {
      const value = nativeParse.call(win.JSON, text, reviver);
      try {
        if (on() && typeof text === 'string' && looksLikeAdJson(text)) patchAdResponse(value);
      } catch (e) { /* 광고가 아닌 응답은 그대로 둔다 */ }
      return value;
    };

    const origFetch = typeof win.fetch === 'function' ? win.fetch : null;
    if (origFetch) {
      win.fetch = function (input, init) {
        const url = requestUrl(input);
        const method = requestMethod(input, init);
        if (on() && isAdEndpoint(url, method)) {
          const body = emptyBodyFor(url) || '{}';
          return Promise.resolve(new win.Response(body, {status: 200, headers: {'Content-Type': 'application/json'}}));
        }
        return Promise.resolve(origFetch.apply(win, arguments)).then(res => {
          if (!on() || !res || typeof res.clone !== 'function' || !shouldInspectUrl(url)) return res;
          const type = (res.headers && res.headers.get && res.headers.get('content-type') || '').toLowerCase();
          if (type && type.indexOf('json') === -1 && type.indexOf('text') === -1 && type.indexOf('javascript') === -1) return res;
          const length = Number(res.headers && res.headers.get && res.headers.get('content-length') || 0);
          if (length > 2000000) return res;
          let copy;
          try { copy = res.clone(); } catch (e) { return res; }
          return copy.text().then(text => {
            const next = rewriteText(text);
            if (next == null) return res;
            return new win.Response(next, {status: res.status, statusText: res.statusText, headers: {'Content-Type': 'application/json'}});
          }).catch(() => res);
        });
      };
    }

    const ResponseProto = win.Response && win.Response.prototype;
    const origJson = ResponseProto && ResponseProto.json;
    if (typeof origJson === 'function') {
      ResponseProto.json = function () {
        return origJson.call(this).then(value => {
          if (on()) patchAdResponse(value);
          return value;
        });
      };
    }

    const XHR = win.XMLHttpRequest;
    const proto = XHR && XHR.prototype;
    if (proto && typeof proto.open === 'function' && typeof proto.send === 'function') {
      const open = proto.open;
      const send = proto.send;
      const textDesc = Object.getOwnPropertyDescriptor(proto, 'responseText');
      const respDesc = Object.getOwnPropertyDescriptor(proto, 'response');
      proto.open = function (method, url) {
        try {
          this.__bongMethod = method;
          this.__bongUrl = url;
        } catch (e) { /* 읽기 전용이면 원본 요청만 보낸다 */ }
        return open.apply(this, arguments);
      };
      if (textDesc && typeof textDesc.get === 'function' && textDesc.configurable !== false) {
        Object.defineProperty(proto, 'responseText', {
          configurable: true,
          enumerable: textDesc.enumerable,
          get() {
            const raw = textDesc.get.call(this);
            if (!on() || typeof raw !== 'string') return raw;
            const next = rewriteText(raw);
            return next == null ? raw : next;
          }
        });
      }
      if (respDesc && typeof respDesc.get === 'function' && respDesc.configurable !== false) {
        Object.defineProperty(proto, 'response', {
          configurable: true,
          enumerable: respDesc.enumerable,
          get() {
            const raw = respDesc.get.call(this);
            if (!on() || raw == null) return raw;
            if (typeof raw === 'string') {
              const next = rewriteText(raw);
              return next == null ? raw : next;
            }
            if (typeof raw === 'object' && raw.nodeType == null) {
              try { patchAdResponse(raw); } catch (e) { /* 재생 응답은 그대로 둔다 */ }
            }
            return raw;
          }
        });
      }
      proto.send = function () {
        const url = this.__bongUrl || '';
        const method = this.__bongMethod || 'GET';
        if (on() && isAdEndpoint(url, method)) {
          const body = emptyBodyFor(url) || '{}';
          try {
            const define = (key, get) => Object.defineProperty(this, key, {configurable: true, enumerable: true, get});
            define('readyState', () => 4);
            define('status', () => 200);
            define('statusText', () => 'OK');
            define('responseText', () => body);
            define('response', () => {
              try { return nativeParse(body); } catch (e) { return body; }
            });
            const fire = () => {
              try { if (typeof this.onreadystatechange === 'function') this.onreadystatechange(); } catch (e) {}
              try { this.dispatchEvent(new win.Event('readystatechange')); } catch (e) {}
              try { this.dispatchEvent(new win.Event('load')); } catch (e) {}
              try { if (typeof this.onload === 'function') this.onload(); } catch (e) {}
              try { this.dispatchEvent(new win.Event('loadend')); } catch (e) {}
            };
            if (typeof win.queueMicrotask === 'function') win.queueMicrotask(fire);
            else setTimeout(fire, 0);
            return;
          } catch (e) { /* 가로채기에 실패하면 원래 요청을 보낸다 */ }
        }
        return send.apply(this, arguments);
      };
    }
    return true;
  }

  root.BongAds = {
    patchAdPayload, patchAdResponse, looksLikeAdJson, isAdEndpoint, emptyBodyFor, shouldInspectUrl,
    CHZZK_AD_RULE_IDS, chzzkAdRules, installAdHooks
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
