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
  root.BongPlayer = { isSkipButtonLabel, isSkipCandidate, hasAdContainer, seekEndTime, AD_CONTAINER_SEL, isAdActive, isGuideText, isPurchaseGuideDialogText, isSkipText, adTextKind, isSafeSkipLabel, isAdDuration, captureAudioState, restoreAudioState, isAudioControlLabel, audioRestoreAction, noteLiveAudio, audioAfterAd, isDisplayAdElement, countdownSeconds, skipAction, pickSkipElement };
})(typeof globalThis !== 'undefined' ? globalThis : this);
