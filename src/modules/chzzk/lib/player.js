// 치지직 플레이어 보조(안내창/광고) 순수 로직 (전역 BongPlayer)
(function (root) {
  'use strict';
  // 광고 진행 중 판단: 광고 UI가 있고 숨김(wpc-dis-hid)이 아니거나, 광고 안내 표시가 보이면
  function isAdActive(s) {
    return !!(s && ((s.adUiExists && !s.adUiHidden) || s.indicatorVisible || s.textHits > 0));
  }
  // 플레이어 안 짧은 텍스트 분류: 'counter'(AD 1/1) | 'countdown'(1 초 후 SKIP) | 'skip'(SKIP/건너뛰기) | 'clickthrough'(광고 페이지 보기) | null
  const normLabel = t => String(t || '').replace(/\s+/g, ' ').trim();
  // '9초 후 SKIP', '9초 뒤 건너뛰기'처럼 숫자가 남아 있으면 그 초. 없으면 null.
  function countdownSeconds(text) {
    const matched = normLabel(text).match(/(\d+)\s*초\s*(?:후|뒤)\s*(?:SKIP|건너뛰기)/i);
    return matched ? Number(matched[1]) : null;
  }
  function adTextKind(t) {
    const s = normLabel(t);
    if (/^AD\s*\d+\s*\/\s*\d+$/i.test(s)) return 'counter';
    if (countdownSeconds(s) != null) return 'countdown';
    if (/^(SKIP|건너뛰기|광고\s*건너뛰기)$/i.test(s)) return 'skip';
    if (/광고\s*페이지\s*보기/.test(s)) return 'clickthrough';
    return null;
  }
  // 누를 수 있는 SKIP 라벨인지(정확히 SKIP/건너뛰기/광고 건너뛰기만)
  const isSafeSkipLabel = t => /^(SKIP|건너뛰기|광고\s*건너뛰기)$/i.test(String(t || '').replace(/\s+/g, ' ').trim());
  // 광고 영상 길이로 보이는지 (유한, 0초 초과 180초 이하)
  const isAdDuration = d => Number.isFinite(d) && d > 0 && d <= 180;
  const isPurchaseGuideDialogText = t => { const s = String(t || '').replace(/\s+/g, ''); return /치트키/.test(s) && /타임머신/.test(s); };
  const isGuideText = t => /치트키|타임\s?머신|되감기|다시보기\s*안내/.test(String(t || ''));
  const isSkipText = t => /건너뛰기|skip|광고\s*닫기/i.test(String(t || ''));
  // 네이버 광고 플레이어의 SKIP 버튼 라벨 (뒤에 ▶| 같은 아이콘 문자 허용). 카운트다운('1초 후 SKIP')은 제외
  function isSkipButtonLabel(t) {
    const s = String(t || '').replace(/\s+/g, ' ').trim();
    if (/\d\s*초/.test(s)) return false;
    return /^SKIP\b[\s\u25B6\u25BA\u23ED\u23E9|>▶►⏭⏩]*$/i.test(s) || /^(광고\s*)?건너뛰기[\s▶►⏭|>]*$/.test(s);
  }
  // 요소 자체 정보로 SKIP 클릭 후보 판정. info {text, inCountdown, inLink, dataRole, cls}
  function isSkipCandidate(info) {
    if (!info || info.inLink) return false;
    if (/adLink/i.test(info.dataRole || '')) return false;
    const seconds = countdownSeconds(info.text);
    if (info.inCountdown && !(seconds === 0 || (seconds == null && isSkipButtonLabel(info.text) && info.disabled !== true))) return false;
    if (/countDown|skipInfo/i.test(info.dataRole || '') && seconds != null && seconds > 0) return false;
    return skipAction(info) === 'ready';
  }
  function controlEnabled(info) {
    if (!info) return false;
    if (info.disabled === true || info.disabled === '') return false;
    const aria = info.ariaDisabled;
    if (aria === true || aria === 'true') return false;
    if (/(?:^|\s)(?:disabled|is-disabled|btn_disabled)(?:\s|$)/i.test(info.className || info.cls || '')) return false;
    return true;
  }
  function labelOf(info) {
    const aria = normLabel(info && info.ariaLabel);
    const text = normLabel(info && info.text);
    if (!aria) return text;
    if (!text || aria.indexOf(text) !== -1) return aria;
    if (text.indexOf(aria) !== -1) return text;
    return normLabel(`${aria} ${text}`);
  }
  // 'wait' 초가 남았거나 버튼이 꺼짐 | 'ready' 지금 누름 | 'ignore' 광고 링크 등
  function skipAction(info) {
    const text = labelOf(info);
    if (!text || adTextKind(text) === 'clickthrough') return 'ignore';
    const seconds = countdownSeconds(text);
    if (seconds != null && seconds > 0) return 'wait';
    if (!controlEnabled(info || {})) return 'wait';
    if (seconds === 0) return 'ready';
    if (isSafeSkipLabel(text) || isSkipButtonLabel(text)) return 'ready';
    return 'ignore';
  }
  // 가짜 버튼 목록에서, 켜진 SKIP만 고른다. 카운트다운과 광고 페이지 보기는 누르지 않는다.
  function pickSkipElement(elements) {
    for (const el of elements || []) {
      if (!el || el.clickThrough) continue;
      if (skipAction(el) === 'ready') return el;
    }
    return null;
  }
  const AD_CONTAINER_SEL = '[data-role="adVideoContainerEl"]';
  const hasAdContainer = doc => { const el = doc && doc.querySelector && doc.querySelector(AD_CONTAINER_SEL); return !!(el && el.isConnected !== false); };
  // 끝으로 이동할 시각 (유한한 길이일 때만)
  const seekEndTime = d => (Number.isFinite(d) && d > 0 ? Math.max(0, d - 0.05) : null);
  // 복구 과정에서 플레이어가 새 video를 만들더라도 사용자의 음소거·볼륨 상태를 유지한다.
  function captureAudioState(video) {
    if (!video) return null;
    const volume = Number(video.volume);
    return { muted: !!video.muted, volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1 };
  }
  function restoreAudioState(video, state) {
    if (!video || !state) return false;
    try { video.volume = Math.max(0, Math.min(1, Number(state.volume))); } catch (e) {}
    try { video.muted = !!state.muted; } catch (e) {}
    return video.muted === !!state.muted;
  }
  // 음소거·볼륨 버튼인지. 복구 중 사용자가 직접 누른 소리는 되돌리지 않기 위해 쓴다.
  function isAudioControlLabel(text) {
    return /음소거|볼륨|mute|volume/i.test(String(text || ''));
  }
  // 'stop' 사용자가 소리를 바꿈 | 'wait' 광고가 끝날 때까지 대기 | 'restore' 지금 복원
  function audioRestoreAction(state) {
    if (!state || state.userTouched) return 'stop';
    if (state.adActive) return 'wait';
    return 'restore';
  }
  // 광고가 없을 때만 본영상 소리를 기억한다. 광고 중 들어온 음소거는 사용자 상태로 보지 않는다.
  function noteLiveAudio(snapshot, captured, adActive) {
    if (adActive || !captured) return snapshot || null;
    return captured;
  }
  // 사용자가 그 사이에 소리를 바꾸면 null (덮어쓰지 않음). 아니면 광고 전 상태.
  function audioAfterAd(snapshot, userTouched) {
    if (userTouched || !snapshot) return null;
    return snapshot;
  }
  // 광고 화면(건너뛰기, 광고 페이지 보기, 광고 칸). 채팅은 아니다.
  function isAdChrome(info) {
    if (!info || info.inChat) return false;
    const kind = adTextKind(info.text || '');
    if (kind === 'clickthrough' || kind === 'countdown' || kind === 'counter' || kind === 'skip') return true;
    if (/adVideo|adControl|adLink|skipBtn|countDown/i.test(String(info.dataRole || ''))) return true;
    if (/pzp-ad-|webplayer-internal-core-ad|ad-click-through|ad-skip|btn_skip|skip_btn/i.test(String(info.className || ''))) return true;
    return false;
  }
  // 버튼에서 플레이어까지 올라갈 때, 본영상과 채팅이 없는 가장 바깥 칸을 고른다.
  // hasContentVideo 는 길이와 상관없이 본영상(video.webplayer-internal-video)이 들어 있는 칸이다.
  // 그림자 DOM 때문에 hasLiveVideo 가 비어도, 이 칸은 가리면 안 된다.
  function pickAdConcealNode(chain) {
    if (!Array.isArray(chain) || chain.length < 2) return null;
    let chosen = null;
    for (let i = 0; i < chain.length - 1; i += 1) {
      const node = chain[i];
      if (!node || node.hasChat || node.hasLiveVideo || node.hasContentVideo || node.isPlayer) break;
      chosen = node;
    }
    return chosen;
  }
  const classTokens = cls => String(cls || '').split(/\s+/).filter(Boolean);
  const hasClass = (cls, name) => classTokens(cls).indexOf(name) !== -1;
  // 치지직 본영상. 타임머신 때문에 길이가 30~90초여도 광고가 아니다.
  function isContentVideo(info) {
    if (!info || info.inChat) return false;
    if (info.isMain || hasClass(info.className, 'webplayer-internal-video')) return true;
    return false;
  }
  // 광고 영상만. 본방송 영상은 길이가 짧아도 숨기지 않는다.
  function isAdVideo(info) {
    if (!info || info.inChat || isContentVideo(info)) return false;
    if (info.inAdLayer || info.inAdBox) return true;
    if (info.isMain) return false;
    return isAdDuration(info.duration);
  }
  // 본영상을 16배속·끝으로 보내면 화면만 검게 남고 소리는 계속 난다.
  function isBoostTarget(info) {
    if (!info || info.inChat || isContentVideo(info)) return false;
    if (info.inAdLayer || info.inAdBox) return true;
    if (info.live) return false;
    return isAdDuration(info.duration);
  }
  const AD_LAYER_ROLES = { adVideoContainerEl: 1, imaAdContainerEl: 1, gvAdContainerEl: 1 };
  function parentNode(node, byId) {
    if (!node) return null;
    if (node.parent && byId[node.parent]) return byId[node.parent];
    if (node.shadowHost && byId[node.shadowHost]) return byId[node.shadowHost];
    return null;
  }
  function walkUp(node, byId, hit) {
    const seen = new Set();
    let cur = node;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (hit(cur)) return true;
      cur = parentNode(cur, byId);
    }
    return false;
  }
  function indexConcealNodes(nodes) {
    const byId = {};
    const light = {};
    const shadow = {};
    for (const node of nodes || []) {
      if (!node || node.id == null) continue;
      byId[node.id] = node;
    }
    for (const node of nodes || []) {
      if (!node || node.id == null || !byId[node.id]) continue;
      if (node.parent && byId[node.parent]) (light[node.parent] = light[node.parent] || []).push(node);
      else if (node.shadowHost && byId[node.shadowHost]) (shadow[node.shadowHost] = shadow[node.shadowHost] || []).push(node);
    }
    return { byId, light, shadow };
  }
  function childNodes(id, idx) {
    return (idx.light[id] || []).concat(idx.shadow[id] || []);
  }
  function subtreeHas(id, idx, hit) {
    const stack = childNodes(id, idx).map(node => node.id);
    const seen = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (hit[cur]) return true;
      for (const child of childNodes(cur, idx)) stack.push(child.id);
    }
    return false;
  }
  // 가짜 플레이어 나무에서, 가릴 칸과 광고 영상을 고른다.
  // 본영상이 들어 있는 칸(그림자 루트 포함)은 절대 가리지 않는다. 가리면 소리는 나고 화면만 검다.
  function resolveAdConceal(nodes) {
    const idx = indexConcealNodes(nodes);
    const content = {};
    const adVideos = [];
    for (const node of Object.keys(idx.byId).map(id => idx.byId[id])) {
      if (String(node.tag || '').toUpperCase() !== 'VIDEO') continue;
      const inChat = walkUp(node, idx.byId, item => item.elementId === 'aside-chatting');
      const inAdLayer = walkUp(node, idx.byId, item => hasClass(item.className, 'webplayer-internal-core-ad-ui') || !!AD_LAYER_ROLES[item.dataRole]);
      const info = {
        inChat, inAdLayer,
        isMain: hasClass(node.className, 'webplayer-internal-video'),
        className: node.className,
        duration: node.duration
      };
      if (isContentVideo(info)) content[node.id] = true;
      else if (isAdVideo(info)) adVideos.push(node.id);
    }
    const hide = [];
    for (const node of Object.keys(idx.byId).map(id => idx.byId[id])) {
      if (node.isPlayer || content[node.id] || subtreeHas(node.id, idx, content)) continue;
      if (walkUp(node, idx.byId, item => item.elementId === 'aside-chatting')) continue;
      const sheet = hasClass(node.className, 'webplayer-internal-core-ad-ui');
      const dimmed = hasClass(node.className, 'webplayer-internal-core-dimmed') && !hasClass(node.className, 'wpc-dis-hid');
      const roleSheet = !!AD_LAYER_ROLES[node.dataRole] || node.dataRole === 'adControlEl' || node.dataRole === 'skipBtn';
      const chrome = isAdChrome({ text: node.text || '', dataRole: node.dataRole || '', className: node.className || '', inChat: false });
      if (sheet || dimmed || roleSheet || chrome) hide.push(node.id);
    }
    const sort = list => list.sort((a, b) => String(a).localeCompare(String(b)));
    return { hideIds: sort(hide), adVideoIds: sort(adVideos), contentVideoIds: sort(Object.keys(content)) };
  }
  // display:none 은 광고 차단 탐지에 걸린다.
  // 광고 칸 자체에 opacity 를 주면, 그 안에 본영상이 있을 때 화면까지 사라진다.
  // 검은 막은 배경만 걷고, 광고 영상·버튼만 투명하게 가린다.
  const AD_CONCEAL_MEDIA = [
    '.webplayer-internal-core-ad-ui > *:not(:has(video.webplayer-internal-video)):not(video.webplayer-internal-video)',
    '.webplayer-internal-core-ad-ui video:not(.webplayer-internal-video)',
    '[data-role="imaAdContainerEl"] video:not(.webplayer-internal-video)',
    '[data-role="gvAdContainerEl"] video:not(.webplayer-internal-video)',
    '[data-role="adVideoContainerEl"] video:not(.webplayer-internal-video)',
    '.webplayer-internal-core-ad-ui iframe',
    '[data-role="adVideoContainerEl"]',
    '[data-role="adControlEl"]',
    '[data-role="skipBtn"]',
    '.pzp-ad-break-indicator',
    '.pzp-ad-click-through-button',
    '.btn_skip',
    '.bex-adhide',
    'video.bex-advideo'
  ];
  const AD_CONCEAL_SHEETS = [
    '.webplayer-internal-core-ad-ui',
    '.webplayer-internal-core-dimmed:not(.wpc-dis-hid)'
  ];
  const AD_CONCEAL_MEDIA_RULE = '{opacity:0 !important;visibility:hidden !important;pointer-events:none !important}';
  const AD_CONCEAL_SHEET_RULE = '{background:transparent !important;background-color:transparent !important;pointer-events:none !important}';
  const AD_CONCEAL_PROTECT = 'video.webplayer-internal-video{opacity:1 !important;visibility:visible !important;pointer-events:auto !important}';
  const AD_CONCEAL_CSS = 'html[data-bong-adblock="1"] ' + AD_CONCEAL_MEDIA.join(',html[data-bong-adblock="1"] ') + AD_CONCEAL_MEDIA_RULE
    + 'html[data-bong-adblock="1"] ' + AD_CONCEAL_SHEETS.join(',html[data-bong-adblock="1"] ') + AD_CONCEAL_SHEET_RULE
    + 'html[data-bong-adblock="1"] ' + AD_CONCEAL_PROTECT;
  // 광고 막은 플레이어 그림자 루트 안에 있다. 문서 CSS 는 거기까지 닿지 않는다.
  const AD_CONCEAL_SHADOW_CSS = AD_CONCEAL_MEDIA.join(',') + AD_CONCEAL_MEDIA_RULE
    + AD_CONCEAL_SHEETS.join(',') + AD_CONCEAL_SHEET_RULE
    + AD_CONCEAL_PROTECT;
  // 배너로 볼 요소. 광고 차단 탐지가 보는 display:none bait(.banner_ad_wrapper)는 여기 넣지 않는다.
  function isDisplayAdElement(info) {
    if (!info) return false;
    const tag = String(info.tag || '').toUpperCase();
    if (tag === 'IFRAME') {
      if (String(info.title || '').trim().toUpperCase() === 'AD') return true;
      if (/_tgtLREC$/i.test(String(info.id || ''))) return true;
      return false;
    }
    if (tag === 'IMG') return /\/Banner_/i.test(String(info.src || '')) && /banner_(image|link)_/i.test(String(info.cls || ''));
    return false;
  }
  root.BongPlayer = { isSkipButtonLabel, isSkipCandidate, hasAdContainer, seekEndTime, AD_CONTAINER_SEL, isAdActive, isGuideText, isPurchaseGuideDialogText, isSkipText, adTextKind, isSafeSkipLabel, isAdDuration, captureAudioState, restoreAudioState, isAudioControlLabel, audioRestoreAction, noteLiveAudio, audioAfterAd, isDisplayAdElement, countdownSeconds, skipAction, pickSkipElement, isAdChrome, pickAdConcealNode, isContentVideo, isAdVideo, isBoostTarget, resolveAdConceal, AD_CONCEAL_CSS, AD_CONCEAL_SHADOW_CSS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
