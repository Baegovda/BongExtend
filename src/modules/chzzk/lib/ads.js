// 치지직 광고 표시를 끄는 순수 로직 (전역 BongAds).
// 재생 주소는 바꾸지 않는다. 광고 일정(adBreaks)은 비우지 않는다.
// 빈 일정은 플레이어가 오류로 보고, 까만 전광고 막을 걷지 않는다.
(function (root) {
  'use strict';
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const HOOK_VERSION = 2;
  const PLAYBACK_KEYS = ['livePlaybackJson', 'liveRewindPlaybackJson', 'radioModePlaybackJson', 'previewPlaybackJson', 'playbackJson'];

  function isMediaPayload(payload) {
    if (typeof payload.liveId === 'number' || typeof payload.liveId === 'string') return true;
    if (typeof payload.videoNo === 'number' || typeof payload.videoNo === 'string') return true;
    return PLAYBACK_KEYS.some(key => key in payload);
  }

  const ROLL_KEYS = ['preRoll', 'midRoll', 'postRoll'];
  // 새 플레이어는 이 키가 없으면 liveId 를 광고 켜짐으로 본다. 키는 남기고 값만 끈다.
  function isAdDecision(payload) {
    if ('playerAdDisplayResponse' in payload || 'skipPreRollAd' in payload) return true;
    return PLAYBACK_KEYS.some(key => key in payload);
  }
  function rollOff(value) {
    return value === false || value === 0 || value === '0' || value === 'N' || value === 'n' || value == null;
  }
  function turnOffRolls(display) {
    let changed = false;
    for (const key of ROLL_KEYS) {
      if (!rollOff(display[key])) {
        display[key] = false;
        changed = true;
      }
    }
    for (const key of Object.keys(display)) {
      if (ROLL_KEYS.indexOf(key) === -1 && /^(pre|mid|post)roll$/i.test(key) && !rollOff(display[key])) {
        display[key] = false;
        changed = true;
      }
    }
    return changed;
  }

  function patchAdPayload(payload) {
    if (!isObj(payload)) return false;
    let changed = false;

    if (isAdDecision(payload)) {
      if (!isObj(payload.playerAdDisplayResponse)) {
        payload.playerAdDisplayResponse = { preRoll: false, midRoll: false, postRoll: false };
        changed = true;
      } else if (turnOffRolls(payload.playerAdDisplayResponse)) changed = true;
    }
    // 채널 my-info 응답은 playerAdDisplayResponse 대신 playerAdFlag 로 광고 여부를 준다.
    if (isObj(payload.playerAdFlag) && turnOffRolls(payload.playerAdFlag)) changed = true;
    for (const key of ['showPreroll', 'showMidroll', 'prerollEnabled', 'midrollEnabled']) {
      if (payload[key] === true || payload[key] === 1 || payload[key] === 'Y') {
        payload[key] = false;
        changed = true;
      }
    }
    for (const key of ROLL_KEYS) {
      if (payload[key] === true || payload[key] === 1 || payload[key] === 'Y') {
        payload[key] = false;
        changed = true;
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
    let changed = false;
    const stack = [{value, depth: 0}], seen = new Set();
    while (stack.length && seen.size < 2000) {
      const item = stack.pop(), current = item.value;
      if ((!isObj(current) && !Array.isArray(current)) || seen.has(current)) continue;
      seen.add(current);
      if (isObj(current) && patchAdPayload(current)) changed = true;
      if (item.depth >= 8) continue;
      for (const child of Object.values(current)) {
        if (child && typeof child === 'object') stack.push({value: child, depth: item.depth + 1});
      }
    }
    return changed;
  }

  function looksLikeAdJson(text) {
    return text.indexOf('playerAdDisplayResponse') !== -1
      || text.indexOf('playerAdFlag') !== -1
      || text.indexOf('midRoll') !== -1
      || text.indexOf('midroll') !== -1
      || text.indexOf('adBreaks') !== -1
      || text.indexOf('videoAdScheduleId') !== -1
      || text.indexOf('skipPreRollAd') !== -1
      // 새 seoraksan 응답은 이 객체 안의 liveId/chatChannelId를 광고 플래그로 사용해요.
      // 실제 재생 주소는 건드리지 않고 명시적인 광고 꺼짐 항목을 추가해요.
      || text.indexOf('livePlaybackJson') !== -1
      || text.indexOf('adControlType') !== -1
      || text.indexOf('Naver SSP') !== -1
      || text.indexOf('GFP Video Ad Schedule') !== -1
      || (text.indexOf('"ads"') !== -1 && text.indexOf('adDivId') !== -1);
  }

  // 미드롤 신호만 끊는다. 광고 일정·SDK 주소를 빈 응답으로 바꾸면
  // 플레이어가 '광고가 막혔다'고 보고 까만 막을 유지한다.
  // 재생(seoraksan, live-detail)과 채팅·시청자 조회는 여기 넣지 않는다.
  function isAdEndpoint(url, method) {
    if (String(method || 'GET').toUpperCase() === 'OPTIONS') return false;
    const u = String(url || '');
    if (/^https:\/\/api\.chzzk\.naver\.com\/ad-polling\/v\d+(?:\.\d+)*\/lives\/[^/?#]+\/ads?(?:\/|\?|$)/.test(u)) return true;
    if (/^https:\/\/api\.chzzk\.naver\.com\/service\/v\d+(?:\.\d+)*\/lives\/[^/?#]+\/ads\/current(?:\/|\?|$)/.test(u)) return true;
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
    return emptyAdPoll();
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

  // 예전 리다이렉트 규칙 id. 지금은 규칙을 넣지 않고, 켜고 끌 때 이 id 만 지운다.
  // 광고 스크립트·일정을 확장 파일로 바꾸면 플레이어가 본영상을 시작하지 않는다.
  function chzzkAdRules() {
    return [];
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
    if (!win || (win.__bongAdHook && win.__bongAdHookVersion === HOOK_VERSION)
      || !win.JSON || typeof win.JSON.parse !== 'function') return false;
    win.__bongAdHook = true;
    win.__bongAdHookVersion = HOOK_VERSION;
    const on = () => !isEnabled || isEnabled() !== false;
    const nativeParse = win.JSON.parse;

    function rewriteText(text) {
      if (typeof text !== 'string' || text.length < 2 || text.length > 2000000) return null;
      if (!looksLikeAdJson(text)) return null;
      try {
        const value = nativeParse(text);
        const changed = patchAdResponse(value);
        const next = win.JSON.stringify(value);
        // An older installed parser may already have patched the object in memory.
        // Preserve that change when returning decrypted bytes to the custom parser.
        return changed || next !== text ? next : null;
      } catch (e) { return null; }
    }

    // 새 터널 응답은 복호화한 바이트를 자체 JSON 파서로 읽어서 fetch/json 훅을 지나치지 않아요.
    // 브라우저가 정상 복호화한 뒤 광고 결정 JSON만 바꾸고, 키와 미디어 바이트는 그대로 둬요.
    const subtle = win.crypto && win.crypto.subtle;
    const decrypt = subtle && subtle.decrypt;
    if (typeof decrypt === 'function' && win.TextDecoder && win.TextEncoder) {
      try {
        subtle.decrypt = function (algorithm) {
          return decrypt.apply(this, arguments).then(raw => {
            const name = typeof algorithm === 'string' ? algorithm : algorithm && algorithm.name;
            if (!on() || String(name).toUpperCase() !== 'AES-GCM' || !raw || raw.byteLength > 2000000) return raw;
            try {
              const bytes = new Uint8Array(raw);
              let first = bytes[0];
              for (let i = 0; i < Math.min(bytes.length, 16); i++) {
                first = bytes[i];
                if (first !== 32 && first !== 10 && first !== 13 && first !== 9) break;
              }
              if (first !== 123 && first !== 91 && first !== 239) return raw;
              const next = rewriteText(new win.TextDecoder('utf-8', {fatal: true}).decode(raw));
              return next == null ? raw : new win.TextEncoder().encode(next).buffer;
            } catch (e) { return raw; }
          });
        };
      } catch (e) { /* 읽기 전용 구현이면 다른 응답 훅을 유지해요. */ }
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
    HOOK_VERSION,
    patchAdPayload, patchAdResponse, looksLikeAdJson, isAdEndpoint, emptyBodyFor, shouldInspectUrl,
    CHZZK_AD_RULE_IDS, chzzkAdRules, installAdHooks
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
