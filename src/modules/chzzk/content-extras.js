// 치지직 부가 기능: 선명한 화면, 주간 랭킹 가리기, 채팅 글씨 크기, 시청자 수, 방향키 이동
(() => {
  'use strict';
  if (window.top !== window) return;
  const X = globalThis.BongExtras;
  const DEF = { vivid: true, hideRanking: true, chatFontSize: 0, viewerChat: true, viewerOverlay: true, arrowSeek: true, seekSeconds: 5, blurRankNames: false, hideTimeGuide: true, adBlock: true, adSkip: true };
  let cfg = { ...DEF };
  const log = (...a) => console.log('[BongExtend]', ...a);
  const ROOT = 'div.pzp.pzp-pc';
  const markAdBlock = () => {
    const root = document.documentElement;
    if (root) root.setAttribute('data-bong-adblock', cfg.adBlock === false ? '0' : '1');
  };
  BCStore.sync.get(DEF, v => { cfg = { ...DEF, ...v }; applyStyles(); markAdBlock(); });
  BCStore.onChanged.addListener((c, area) => {
    if (area !== 'sync') return;
    let hit = false;
    for (const k in DEF) if (c[k]) { cfg[k] = c[k].newValue; hit = true; }
    if (hit) { applyStyles(); markAdBlock(); vividState.nextAt = 0; refreshViewerUi(); if (cfg.adBlock === false) releaseConceal(); }
  });

  // ── 스타일 주입: 랭킹 가리기 + 채팅 글씨 크기 + 시청자 배지 ──
  function applyStyles() {
    let st = document.getElementById('bex-xstyle');
    if (!st) { st = document.createElement('style'); st.id = 'bex-xstyle'; (document.head || document.documentElement).appendChild(st); }
    let css = '#bex-vov{position:absolute;top:12px;left:12px;z-index:2147483000;pointer-events:none;background:rgba(0,0,0,.55);color:#fff;font:600 13px/1 sans-serif;padding:5px 9px;border-radius:999px;white-space:nowrap}'
      + '#bex-quality{position:absolute;top:12px;right:12px;z-index:2147483000;pointer-events:none;background:rgba(0,0,0,.55);color:#fff;font:600 13px/1 sans-serif;padding:5px 9px;border-radius:999px;white-space:nowrap}.bc-runtime{margin-left:10px;padding-left:10px;border-left:1px solid #ffffff55;color:#ddd;font-variant-numeric:tabular-nums}'
      + '#bex-vchat{display:inline-block;margin-left:8px;font-size:12px;font-weight:400;color:#9aa0a6;white-space:nowrap;vertical-align:middle;max-width:calc(100% - 60px);overflow:hidden;text-overflow:ellipsis}'
      + '.bex-seektoast{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483000;pointer-events:none;background:rgba(0,0,0,.6);color:#fff;font:700 18px sans-serif;padding:8px 14px;border-radius:10px;transition:opacity .3s}';
    const RANK = ['#aside-chatting > div:has(> strong[class*="_ranking_"])', '#aside-chatting > div:has(> strong[class*="_title_"][class*="_ranking"])', '#aside-chatting > div:has([class*="_qxsox_"])', '#aside-chatting > div:has(i[class*="icon_cheese"]):not(:has([role="log"]))', '.bex-rank'];
    // 줄 숨기기와 닉네임 흐림은 각자 스위치대로. 줄이 숨겨지면 흐림은 보이지 않을 뿐.
    if (cfg.hideRanking) css += RANK.join(', ') + '{display:none !important}';
    if (cfg.blurRankNames) {
      const names = ['[class*="_nickname_"]', '[class*="_ellipsis_"]', '[class*="_text_"]', '.bex-blurname'];
      css += RANK.flatMap(r => names.map(n => `${r} ${n}`)).join(', ') + '{filter:blur(6px) !important;user-select:none !important}';
      css += RANK.map(r => `${r} [class*="_money_"], ${r} [class*="_money_"] *`).join(', ') + '{filter:none !important}';
    }
    if (cfg.hideTimeGuide) css += '.restart_guide, .bex-guidehide{display:none !important}';
    // display:none 은 광고 차단 탐지에 걸린다. 광고 칸만 투명하게 가린다.
    if (cfg.adBlock && P.AD_CONCEAL_CSS) css += P.AD_CONCEAL_CSS;
    const fs = X.normalizeFontSize(cfg.chatFontSize);
    if (fs) css += `#aside-chatting [class*="_chatting_message_"], #aside-chatting [class*="_chatting_message_"] > span[class*="_text_"], #aside-chatting [class*="_chatting_message_"] [class*="_nickname_"] *{font-size:${fs}px !important;line-height:1.5 !important}`;
    st.textContent = css;
    
  }
  // 위치/내용 기반 JS 보조: 헤더(0번)와 채팅 목록([role=log]) 사이의 div = 랭킹 줄
  function hideRankingFallback() {
    const aside = document.getElementById('aside-chatting');
    if (!aside) return;
    const kids = [...aside.children];
    const rows = X.rankRowIndices(kids.map(d => ({
      isDiv: d.tagName === 'DIV',
      hasLog: !!(d.matches('[role="log"]') || d.querySelector('[role="log"]')),
      hasInput: !!d.querySelector('textarea, [contenteditable="true"], [contenteditable=""]'),
      signal: !!d.querySelector('[class*="_qxsox_"], i[class*="icon_cheese"], strong[class*="_ranking"]') || /랭킹/.test(d.querySelector('strong')?.textContent || '')
    })));
    kids.forEach((d, i) => d.classList.toggle('bex-rank', rows.includes(i)));
    // 닉네임 텍스트 표시(금액/제목/숫자는 제외)
    for (const i of rows) {
      for (const el of kids[i].querySelectorAll('*')) {
        if (el.childElementCount || el.closest('[class*="_money_"], strong, button, [class*="blind"]')) continue;
        el.classList.toggle('bex-blurname', X.isNameText(el.textContent));
      }
    }
  }
  // ── 선명한 화면 항상 켜기 ──
  const vividState = { nextAt: 0, lastPath: location.pathname };
  async function ensureVivid() {
    if (!cfg.vivid || !/^\/(live|video)\//.test(location.pathname) || Date.now() < vividState.nextAt) return;
    const root = document.querySelector(ROOT);
    if (!root || !root.querySelector('video')) return;
    const sw = () => document.querySelector('.pzp-pc-setting-intro-filter .pzp-ui-toggle');
    const isOn = () => root.classList.contains('pzp-pc--filter') || sw()?.getAttribute('aria-checked') === 'true';
    if (isOn()) return;
    vividState.nextAt = Date.now() + 10000; // 10초에 한 번까지만 시도
    let row = document.querySelector('.pzp-pc-setting-intro-filter');
    let opened = false;
    const gear = document.querySelector('.pzp-pc-setting-button');
    if (!row && gear && gear.getAttribute('aria-expanded') !== 'true') {
      gear.click(); opened = true;
      await new Promise(r => setTimeout(r, 250));
      row = document.querySelector('.pzp-pc-setting-intro-filter');
    }
    if (row) { row.click(); log('선명한 화면 켜기 시도'); }
    await new Promise(r => setTimeout(r, 300));
    if (opened && gear.getAttribute('aria-expanded') === 'true') gear.click();
    if (!isOn()) log('선명한 화면 켜기 실패(확인 안 됨)');
  }

  // ── 시청자 수 (채팅 헤더 + 플레이어 오버레이), 단일 폴링 루프 ──
  let liveStartedAt=NaN, detailAt=0, detailBusy=false, liveId=null;
  let viewerNum = NaN, viewerChannel = null, vFails = 0, vTimer = 0, vBusy = false;
  const wantViewers = () => (cfg.viewerChat || cfg.viewerOverlay) && document.visibilityState === 'visible' && X.channelIdFromPath(location.pathname);
  const EYE = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:-2px;margin-right:4px"><path fill="currentColor" d="M12 5C6.5 5 2.3 8.6 1 12c1.3 3.4 5.5 7 11 7s9.7-3.6 11-7c-1.3-3.4-5.5-7-11-7zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>';
  // 아이콘 + 숫자 구조로 만들고, 숫자가 바뀌면 증가=초록/감소=빨강으로 잠깐 깜빡임
  function paintViewer(el) {
    if (!el.querySelector('.bc-num')) { el.innerHTML = '<span class="bc-eye"></span><span class="bc-num"></span>'; el.querySelector('.bc-eye').innerHTML = EYE; }
    const eye = el.querySelector('.bc-eye'), num = el.querySelector('.bc-num');
    eye.style.color = X.eyeColor(location.pathname);
    const text = X.formatCount(viewerNum);
    if (num.textContent === text) return;
    const prev = el._bcPrev;
    el._bcPrev = viewerNum;
    num.textContent = text;
    const dir = X.changeDirection(prev, viewerNum);
    if (dir && num.animate) {
      const before=getComputedStyle(num).color;
      num.getAnimations?.().forEach(an => an.cancel());
      const tint=dir === 'up' ? '#8ad9b6' : '#eea3a3';
      num.animate([{color:before,offset:0},{color:tint,offset:.08},{color:tint,offset:.55},{color:'inherit',offset:1}], {duration:5000,easing:'ease-out'});
    }
  }
  function refreshViewerUi() {
    const onLive = !!X.channelIdFromPath(location.pathname);
    // 채팅 헤더: h2("채팅") 안쪽에 붙임(형제로 두면 보이지 않음, 실사이트 확인)
    let chatEl = document.getElementById('bex-vchat');
    const h2 = document.querySelector('#aside-chatting > div:first-child h2');
    if (cfg.viewerChat && onLive && h2) {
      if (!chatEl || chatEl.parentElement !== h2) {
        chatEl?.remove();
        chatEl = document.createElement('span'); chatEl.id = 'bex-vchat';
        h2.appendChild(chatEl);
      }
      paintViewer(chatEl);
    } else chatEl?.remove();
    // 플레이어 오버레이 (fullscreen에서도 보이도록 .pzp 안에)
    let ov = document.getElementById('bex-vov');
    const host = document.querySelector(ROOT) || document.getElementById('live_player_layout');
    if (cfg.viewerOverlay && onLive && host) {
      if (!ov || ov.parentElement !== host) {
        ov?.remove();
        ov = document.createElement('div'); ov.id = 'bex-vov';
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        host.appendChild(ov);
      }
      paintViewer(ov);
      let elapsed=ov.querySelector('.bc-runtime');
      if(!elapsed){elapsed=document.createElement('span');elapsed.className='bc-runtime';ov.append(elapsed);}
      elapsed.textContent=X.broadcastElapsed(liveStartedAt);elapsed.title='방송 시작 후 경과 시간';
    } else ov?.remove();
    let quality=document.getElementById('bex-quality');
    if(onLive && host){
      if(!quality || quality.parentElement!==host){quality?.remove();quality=document.createElement('div');quality.id='bex-quality';host.append(quality);}
      if(getComputedStyle(host).position==='static')host.style.position='relative';
      const height=(host.querySelector('video.webplayer-internal-video') || host.querySelector('video'))?.videoHeight;
      quality.textContent=height>0?`${height}p`:'화질 확인 중';quality.title='현재 영상의 실제 해상도';
    }else quality?.remove();
  }
  async function refreshBroadcastStart(id){
    if(detailBusy || Date.now()<detailAt)return;
    detailBusy=true;detailAt=Date.now()+60000;
    try{
      const response=await fetch(`https://api.chzzk.naver.com/service/v2/channels/${id}/live-detail`,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error();
      const content=(await response.json())?.content;
      if(id===X.channelIdFromPath(location.pathname))liveStartedAt=X.broadcastStart(content?.openDate);
    }catch{detailAt=Date.now()+30000;}finally{detailBusy=false;}
  }
  async function pollViewers() {
    clearTimeout(vTimer);
    if(vBusy)return;
    const began=Date.now();
    const id = wantViewers();
    if (!id) { viewerChannel = null; viewerNum = NaN; refreshViewerUi(); vTimer = setTimeout(pollViewers, 1000); return; }
    if (id !== viewerChannel) { viewerChannel = id; viewerNum = NaN; vFails = 0; liveStartedAt=NaN;detailAt=0;liveId=null; }
    if (!vBusy) {
      vBusy = true;
      try {
        const r = await fetch(`https://api.chzzk.naver.com/polling/v3.1/channels/${id}/live-status?includePlayerRecommendContent=true`, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const c = (await r.json())?.content;
        if (id === viewerChannel) viewerNum = c && c.status === 'OPEN' && typeof c.concurrentUserCount === 'number' ? c.concurrentUserCount : NaN;
        if(id===X.channelIdFromPath(location.pathname) && c?.status==='OPEN'){
          if(c.liveId!=null && c.liveId!==liveId){liveId=c.liveId;liveStartedAt=NaN;detailAt=0;}
          if(c.openDate)liveStartedAt=X.broadcastStart(c.openDate);
          if(!Number.isFinite(liveStartedAt) || Date.now()>=detailAt)void refreshBroadcastStart(id);
        }else if(c?.status!=='OPEN')liveStartedAt=NaN;
        vFails = 0;
      } catch (e) {
        vFails++; viewerNum = NaN;
        if (vFails <= 3) log('시청자 수 조회 실패:', e.message);
      } finally { vBusy = false; }
    }
    refreshViewerUi();
    clearTimeout(vTimer);
    vTimer = setTimeout(pollViewers, Math.max(0, Math.min(30000, 1000 * Math.pow(2, Math.min(vFails, 5)))-(Date.now()-began)));
  }
  pollViewers();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollViewers(); });
  window.addEventListener('popstate', () => setTimeout(pollViewers, 300));

  // ── 방향키 이동 ──
  function mainVideo() {
    const vs = [...document.querySelectorAll(ROOT + ' video, video.webplayer-internal-video, video')].filter(v => v.isConnected && v.readyState > 0);
    return vs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] || null;
  }
  function seekToast(text) {
    const host = document.querySelector(ROOT) || document.getElementById('live_player_layout');
    if (!host) return;
    let t = host.querySelector('.bex-seektoast');
    if (!t) { t = document.createElement('div'); t.className = 'bex-seektoast'; host.appendChild(t); }
    t.textContent = text; t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, 600);
  }
  document.addEventListener('keydown', e => {
    if (!cfg.arrowSeek || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!/^\/(live|video)\//.test(location.pathname)) return;
    const v = mainVideo();
    if (!v) return;
    const sec = X.normalizeSeekSec(cfg.seekSeconds);
    const live = !Number.isFinite(v.duration) || location.pathname.startsWith('/live/');
    const ranges = [];
    for (let i = 0; i < v.seekable.length; i++) ranges.push([v.seekable.start(i), v.seekable.end(i)]);
    const rg = X.seekRange(live, v.duration, ranges);
    if (!rg) return;
    const delta = e.key === 'ArrowLeft' ? -sec : sec;
    const to = X.clampSeek(v.currentTime, delta, rg[0], rg[1]);
    if (to == null) return;
    e.preventDefault(); e.stopImmediatePropagation();
    v.currentTime = to;
    seekToast((delta < 0 ? '-' : '+') + sec + '초');
  }, true);

  // ── 타임머신/치트키 안내창 숨김 (클릭은 하지 않고 숨기기만) ──
  const P = globalThis.BongPlayer;
  function checkGuide(el) {
    if (!cfg.hideTimeGuide || el.nodeType !== 1 || el.id?.startsWith('bex') || el.classList.contains('bex-guidehide')) return;
    if (el.closest('.pzp-pc-settings, #aside-chatting, [class*="pzp-pc__bottom"], [class*="pzp-pc-ui-controls"]')) return;
    if (el.tagName === 'VIDEO' || el.querySelector('video')) return;
    if (!P.isGuideText(el.textContent)) return;
    el.classList.add('bex-guidehide');
    console.debug('[BongExtend] 안내창 숨김', el.outerHTML.slice(0, 300));
  }
  let guideObs = null, guideRoot = null;
  setInterval(() => {
    const root = document.querySelector(ROOT);
    if (root === guideRoot) return;
    guideObs?.disconnect(); guideRoot = root;
    if (!root) return;
    guideObs = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) checkGuide(n); });
    guideObs.observe(root, { childList: true, subtree: true });
  }, 1000);

  // ── body 바로 아래에 붙는 치트키·타임머신 구매 안내 팝업 ('실시간' 버튼) ──
  function checkBodyGuide(node) {
    if (!cfg.hideTimeGuide || !node || node.nodeType !== 1 || node.parentNode !== document.body) return;
    if (node.id === 'root' || node.id?.startsWith('bex') || node.classList.contains('bex-guidehide')) return;
    const dlg = node.matches('[role="alertdialog"]') ? node : node.querySelector('[role="alertdialog"]');
    if (!dlg || !P.isPurchaseGuideDialogText(dlg.textContent)) return;
    node.classList.add('bex-guidehide');
    node.style.setProperty('display', 'none', 'important');
    setTimeout(() => {
      const close = node.querySelector('button[aria-label="팝업 닫기"]');
      if (close) close.click();
      setTimeout(() => { if (document.body.style.overflow === 'hidden' && !document.querySelector('body > :not(.bex-guidehide) [role="alertdialog"], body > [role="alertdialog"]:not(.bex-guidehide)')) document.body.style.overflow = ''; }, 300);
    }, 0);
  }
  function startBodyGuide() {
    if (!document.body) return setTimeout(startBodyGuide, 100);
    for (const n of document.body.children) checkBodyGuide(n);
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) checkBodyGuide(n); }).observe(document.body, { childList: true });
  }
  if (window === window.top) startBodyGuide();

  // ── 광고 방지 (best effort): 클래스 + 화면 텍스트(AD 1/1, N 초 후 SKIP, SKIP, 광고 페이지 보기)로 감지 ──
  let adWasActive = false, adTimer = 0;
  const boosted = new Set();
  // 재생 중 사이트가 자동으로 건 음소거를 되돌리고, 사용자가 직접 정한 음량은 저장한다.
  const DEFAULT_AUDIO = { muted: false, volume: 1 };
  let audioHold = { ...DEFAULT_AUDIO }, audioReady = false, audioPointerActive = false, audioUserChangePendingUntil = 0, restoreToken = 0, audioSaveTimer = 0;
  BCStore.local.get({ audioPreference: DEFAULT_AUDIO }, value => {
    audioHold = P.captureAudioState(value.audioPreference) || { ...DEFAULT_AUDIO };
    audioReady = true;
  });
  // 저장소 응답이 늦어져도 첫 재생을 음소거로 방치하지 않는다.
  setTimeout(() => { audioReady = true; }, 1200);
  function contentVideo() {
    const list = [...document.querySelectorAll('video')].filter(v => v.isConnected && !v.closest(P.AD_CONTAINER_SEL));
    return list.find(v => v.classList.contains('webplayer-internal-video'))
      || list.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0]
      || null;
  }
  function enforceAudioPreference(v) {
    if (!audioReady || audioPointerActive || audioUserChangePendingUntil > Date.now() || !v || !v.isConnected) return;
    if (adWasActive || globalThis.__bongAdActive || (v.closest && v.closest(P.AD_CONTAINER_SEL))) return;
    if (!v.classList.contains('webplayer-internal-video')) return;
    if (!P.audioStateMatches(v, audioHold)) P.restoreAudioState(v, audioHold);
  }
  function scheduleAudioEnforcement(v, delays) {
    for (const delay of delays) setTimeout(() => enforceAudioPreference(v), delay);
  }
  function watchContentAudio(v) {
    if (!v || v._bongAudioWatch || (v.closest && v.closest(P.AD_CONTAINER_SEL))) return;
    v._bongAudioWatch = 1;
    v.addEventListener('volumechange', () => scheduleAudioEnforcement(v, [0, 80, 250]));
    v.addEventListener('playing', () => scheduleAudioEnforcement(v, [0, 120, 400, 1000, 2200]));
  }
  function userAudioTarget(e) {
    if (!e || !e.isTrusted) return false;
    const target = e.target;
    if (!target || !target.closest) return false;
    if (e.type === 'keydown') {
      if (target.closest('input, textarea, [contenteditable="true"]') || !/^[mM]$/.test(e.key)) return false;
      return !!(target.closest('div.pzp, #live_player_layout') || document.activeElement?.closest?.('div.pzp, #live_player_layout'));
    }
    if (target.closest('input[type="range"]') && target.closest('div.pzp, #live_player_layout')) return true;
    const el = target.closest('button, [role="button"], input, a');
    if (!el) return false;
    const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.className || ''} ${(el.textContent || '').slice(0, 80)}`;
    return P.isAudioControlLabel(label);
  }
  function queueUserAudioSave() {
    clearTimeout(audioSaveTimer);
    audioSaveTimer = setTimeout(() => {
      const state = P.captureAudioState(contentVideo());
      if (state) {
        audioHold = state;
        audioReady = true;
        BCStore.local.set({ audioPreference: state });
      }
      audioUserChangePendingUntil = 0;
      const video = contentVideo();
      if (video) scheduleAudioEnforcement(video, [0, 120]);
    }, 160);
  }
  function noteUserAudio(e) {
    if (e && e.type === 'pointerdown') audioPointerActive = true;
    if (e && (e.type === 'pointerup' || e.type === 'pointercancel')) audioPointerActive = false;
    audioUserChangePendingUntil = Date.now() + 1500;
    queueUserAudioSave();
  }
  document.addEventListener('pointerdown', e => { if (userAudioTarget(e)) noteUserAudio(e); }, true);
  document.addEventListener('pointerup', e => {
    if (audioPointerActive) noteUserAudio(e);
    else if (audioUserChangePendingUntil > Date.now() && userAudioTarget(e)) noteUserAudio(e);
  }, true);
  document.addEventListener('pointercancel', e => { if (audioPointerActive) noteUserAudio(e); }, true);
  document.addEventListener('keydown', e => { if (userAudioTarget(e)) noteUserAudio(e); }, true);
  function scheduleLiveAudioRestore() {
    const token = ++restoreToken;
    const apply = () => {
      if (token !== restoreToken) return;
      const video = contentVideo();
      if (video) enforceAudioPreference(video);
    };
    for (const delay of [0, 80, 250, 700, 1500, 3000, 5000]) setTimeout(apply, delay);
  }
  function displayAdInfo(el) {
    return {
      tag: el.tagName,
      src: el.getAttribute('src') || '',
      title: el.getAttribute('title') || '',
      id: el.id || '',
      cls: `${el.className || ''} ${el.closest('a')?.className || ''}`
    };
  }
  function stripDisplayAds(node) {
    if (!cfg.adBlock || !node || node.nodeType !== 1 || !node.querySelectorAll) return;
    const list = node.matches && node.matches('img, iframe') ? [node] : [];
    list.push(...node.querySelectorAll('img, iframe'));
    for (const el of list) {
      if (!P.isDisplayAdElement(displayAdInfo(el))) continue;
      if (el.closest('#aside-chatting, div.pzp')) continue;
      const victim = (el.tagName === 'IMG' && el.closest('a')) || el;
      if (!victim.isConnected || victim.closest('#aside-chatting, div.pzp')) continue;
      victim.remove();
    }
  }
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  };
  const ownText = el => { let t = ''; for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue; return t.trim(); };
  function shadowOf(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.shadowRoot) return el.shadowRoot;
    try {
      const opener = globalThis.chrome && chrome.dom && chrome.dom.openOrClosedShadowRoot;
      if (typeof opener === 'function') return opener.call(chrome.dom, el) || null;
    } catch (e) {}
    return null;
  }
  function scanTexts(root) {
    const hits = [];
    const visit = (scope) => {
      if (!scope || !scope.querySelectorAll) return;
      for (const el of scope.querySelectorAll('*')) {
        if (el.id?.startsWith('bex') || el.tagName === 'VIDEO' || el.tagName === 'svg') continue;
        const full = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const t = full && full.length < 40 && el.childElementCount <= 6 ? full : ownText(el).trim();
        const kind = t && t.length < 40 ? P.adTextKind(t) : null;
        if (kind && visible(el)) hits.push({ el, t, kind });
        const shadow = shadowOf(el);
        if (shadow) visit(shadow);
      }
    };
    visit(root);
    const top = shadowOf(root);
    if (top) visit(top);
    return hits;
  }
  const SKIP_QUERY = 'button, [role="button"], a, [tabindex], [data-role*="skip" i], [class*="skip" i], [class*="Skip"]';
  function skipInfo(el) {
    const aria = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
    return {
      text: `${aria} ${el.textContent || ''}`.replace(/\s+/g, ' ').trim(),
      ariaLabel: aria,
      disabled: !!(el.disabled || (el.hasAttribute && el.hasAttribute('disabled'))),
      ariaDisabled: el.getAttribute ? el.getAttribute('aria-disabled') : null,
      className: String(el.className || ''),
      clickThrough: !!(el.matches && el.matches('a[href], .pzp-ad-click-through-button, [data-role="adLink"]')),
      el
    };
  }
  function collectSkipControls(scope, out) {
    if (!scope || !scope.querySelectorAll) return;
    let nodes = [];
    try { nodes = [...scope.querySelectorAll(SKIP_QUERY)]; } catch (e) { nodes = [...scope.querySelectorAll('button, [role="button"], a')]; }
    for (const el of nodes) {
      if (!visible(el)) continue;
      const info = skipInfo(el);
      if (info.text.length > 80) continue;
      out.push(info);
    }
    const own = shadowOf(scope);
    if (own) collectSkipControls(own, out);
    for (const el of scope.querySelectorAll('*')) {
      const shadow = shadowOf(el);
      if (shadow) collectSkipControls(shadow, out);
    }
  }
  function clickReadySkip(scope) {
    if (Date.now() - lastSkipClick < 400) return false;
    const controls = [];
    collectSkipControls(scope, controls);
    const picked = P.pickSkipElement(controls);
    if (!picked) return false;
    lastSkipClick = Date.now();
    fireClick(picked.el);
    console.info('[BongExtend] 광고 SKIP 클릭', picked.text.slice(0, 40));
    return true;
  }
  const AD_LAYER_SEL = '[data-role="adVideoContainerEl"], [data-role="imaAdContainerEl"], [data-role="gvAdContainerEl"], .webplayer-internal-core-ad-ui';
  function playerElements(root, selector) {
    const found = [], seen = new Set();
    const visit = scope => {
      if (!scope || seen.has(scope)) return;
      seen.add(scope);
      try { if (scope.matches && scope.matches(selector)) found.push(scope); } catch (e) {}
      if (!scope.querySelectorAll) return;
      for (const el of scope.querySelectorAll('*')) {
        try { if (el.matches(selector)) found.push(el); } catch (e) {}
        const shadow = shadowOf(el);
        if (shadow) visit(shadow);
      }
      const own = shadowOf(scope);
      if (own) visit(own);
    };
    visit(root);
    return [...new Set(found)];
  }
  function hasAdLayerAncestor(el) {
    let node = el;
    while (node) {
      try { if (node.matches && node.matches(AD_LAYER_SEL)) return true; } catch (e) {}
      const tree = node.getRootNode && node.getRootNode();
      node = node.parentElement || (tree && tree.host) || null;
    }
    return false;
  }
  function adVideos(root) {
    const vs = playerElements(root, 'video').filter(visible).map(v => { const r = v.getBoundingClientRect(); return { v, area: r.width * r.height, w: r.width, h: r.height, inAdLayer: hasAdLayerAncestor(v) }; });
    const layered = vs.filter(x => x.inAdLayer);
    if (layered.length) return layered.map(x => x.v);
    const shortOnes = vs.filter(x => P.isAdDuration(x.v.duration) && !x.v.classList.contains('webplayer-internal-video'));
    if (shortOnes.length) return shortOnes.map(x => x.v);
    if (vs.length >= 2) { // 라이브가 작은 PIP로 줄어든 경우: 가장 큰 영상을 광고로 봄
      vs.sort((x, y) => y.area - x.area);
      if (vs[vs.length - 1].area < vs[0].area * 0.25) return [vs[0].v];
    }
    return [];
  }
  // 네이버 광고 플레이어(data-role) 전용: 광고 컨테이너/영상/SKIP 버튼
  const commonAncestor = (x, y) => { if (!x) return null; if (!y) return x; let n = x; while (n && !n.contains(y)) n = n.parentElement; return n; };
  function naverAdRoot(container) {
    const ctl = document.querySelector('[data-role="adControlEl"]');
    let r = commonAncestor(container, ctl) || container;
    // SKIP 버튼이 컨테이너 형제일 수 있으니 플레이어 범위까지 한두 단계 올림
    for (let i = 0; i < 3 && r.parentElement && r.parentElement !== document.body; i++) { r = r.parentElement; if (r.querySelector('video:not([data-role="videoEl"])')) break; }
    return r;
  }
  function fireClick(el) {
    const o = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 };
    try { el.dispatchEvent(new PointerEvent('pointerdown', o)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', o)); } catch (e) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', o)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', o)); } catch (e) {}
    try { el.click(); } catch (e) {}
  }
  let lastSkipClick = 0;
  function boostAdVideo(v) {
    if (!v) return;
    const inAdLayer = hasAdLayerAncestor(v);
    if (!P.isBoostTarget({
      isContent: v.classList.contains('webplayer-internal-video') && !inAdLayer,
      isMain: v.classList.contains('webplayer-internal-video'),
      id: v.id,
      inAdLayer,
      live: location.pathname.startsWith('/live/'),
      duration: v.duration,
      inChat: !!(v.closest && v.closest('#aside-chatting'))
    })) return;
    v._bongAdBoost = 1;
    // 본영상 video 는 음소거하지 않는다. 광고 칸 안의 영상만, 되돌릴 소리를 알고 있을 때만 끈다.
    if (audioHold && inAdLayer) {
      try { v.muted = true; } catch (e) {}
    }
    try { if (v.playbackRate !== 16) v.playbackRate = 16; } catch (e) {}
    const t = P.seekEndTime(v.duration);
    if (t != null && v.currentTime < t) { try { v.currentTime = t; } catch (e) {} }
    boosted.add(v);
  }
  function adScope() {
    const RT = globalThis.BongRetryTimer;
    if (!RT) return false;
    const host = document.querySelector(ROOT) || document.getElementById('live_player_layout');
    const text = host ? (host.textContent || '').slice(0, 2000) : '';
    const main = [...document.querySelectorAll('video.webplayer-internal-video')].find(v => v.isConnected && !v.closest(P.AD_CONTAINER_SEL));
    return RT.shouldRecover({ path: location.pathname, offlineText: text, ended: !!(main && main.ended) });
  }
  function playerBox() {
    return document.querySelector(ROOT) || document.querySelector('div.pzp') || document.getElementById('live_player_layout');
  }
  const CONCEAL_PROPS = ['opacity', 'visibility', 'pointer-events', 'background', 'background-color'];
  function classNameOf(el) {
    if (!el) return '';
    if (typeof el.className === 'string') return el.className;
    return (el.getAttribute && el.getAttribute('class')) || '';
  }
  function walkPlayer(player, visit) {
    const seen = new Set();
    const walk = (el, parent, shadowHost) => {
      if (!el || el.nodeType !== 1 || seen.has(el)) return;
      seen.add(el);
      visit(el, parent, shadowHost);
      const shadow = shadowOf(el);
      if (shadow) {
        const kids = shadow.children ? [...shadow.children] : [];
        for (const child of kids) walk(child, null, el);
      }
      for (const child of el.children || []) walk(child, el, shadowHost);
    };
    walk(player, null, null);
  }
  const RECOVER_PROPS = ['width', 'height', 'overflow', 'pointer-events'];
  function collapseSheet(el) {
    if (!el || !el.style || !el.style.setProperty) return;
    if (el.dataset) el.dataset.bexRecover = '1';
    el.style.setProperty('width', '0', 'important');
    el.style.setProperty('height', '0', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  }
  function clearConceal(el) {
    if (!el || !el.classList) return;
    el.classList.remove('bex-adhide', 'bex-advideo');
    if (el.dataset && el.dataset.bexConceal) delete el.dataset.bexConceal;
    if (el.dataset && el.dataset.bexRecover) delete el.dataset.bexRecover;
    if (!el.style || !el.style.removeProperty) return;
    for (const prop of CONCEAL_PROPS) el.style.removeProperty(prop);
    for (const prop of RECOVER_PROPS) el.style.removeProperty(prop);
  }
  const SHADOW_STYLE_ID = 'bex-adconceal-shadow';
  function injectShadowStyles(player) {
    const css = P.AD_CONCEAL_SHADOW_CSS;
    if (!css || !player) return;
    walkPlayer(player, el => {
      const shadow = shadowOf(el);
      if (!shadow || !shadow.appendChild) return;
      let style = shadow.querySelector && shadow.querySelector('#' + SHADOW_STYLE_ID);
      if (!style) {
        style = document.createElement('style');
        style.id = SHADOW_STYLE_ID;
        shadow.appendChild(style);
      }
      if (style.textContent !== css) style.textContent = css;
    });
  }
  let wrapperStuckSince = 0;
  function hasFrames(video) {
    return !!(video && video.isConnected !== false && video.videoWidth > 0 && video.readyState >= 2);
  }
  function concealAds(player) {
    if (!player || cfg.adBlock === false) return;
    injectShadowStyles(player);
    // 예전 버전 이 투명 가리기를 붙였으면 걷어 낸다. opacity 0 은 까만 화면을 만든다.
    walkPlayer(player, el => {
      if (el.classList && (el.classList.contains('bex-adhide') || el.classList.contains('bex-advideo') || (el.dataset && el.dataset.bexConceal))) clearConceal(el);
    });
    const wrapper = document.getElementById('preAdPlayerWrapper');
    const slot = document.getElementById('preAdVideoContainer');
    const pre = document.getElementById('preAdContentPlayer');
    const main = [...document.querySelectorAll('video.webplayer-internal-video')].find(video => !wrapper || !wrapper.contains(video));
    const wrapperUp = !!(wrapper && wrapper.isConnected && wrapper.offsetParent !== null);
    if (!wrapperUp) wrapperStuckSince = 0;
    else if (!wrapperStuckSince) wrapperStuckSince = Date.now();
    const plan = P.planBlackRecovery({
      mainHasFrames: hasFrames(main),
      preContentHasFrames: hasFrames(pre),
      wrapperPresent: wrapperUp,
      adSlotPresent: !!(slot && slot.isConnected),
      stuck: !!(wrapperStuckSince && Date.now() - wrapperStuckSince > 8000)
    });
    if (plan.collapseWrapper && wrapper) collapseSheet(wrapper);
    else if (wrapper && wrapper.dataset && wrapper.dataset.bexRecover && !plan.collapseWrapper) clearConceal(wrapper);
    if (plan.collapseAdSlot && slot) collapseSheet(slot);
    else if (slot && slot.dataset && slot.dataset.bexRecover && !plan.collapseAdSlot) clearConceal(slot);
    const adRoot = slot || document.querySelector(P.AD_CONTAINER_SEL);
    if (adRoot && adRoot.querySelectorAll) {
      for (const video of adRoot.querySelectorAll('video')) {
        if (P.isContentVideo({ id: video.id, className: classNameOf(video), isMain: video.classList.contains('webplayer-internal-video') })) continue;
        try { video.muted = true; } catch (e) {}
        boostAdVideo(video);
      }
    }
  }
  function releaseConceal() {
    const roots = [document.documentElement, document.body].filter(Boolean);
    const player = playerBox();
    if (player) roots.push(player);
    const seen = new Set();
    for (const root of roots) {
      walkPlayer(root, el => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.classList && (el.classList.contains('bex-adhide') || el.classList.contains('bex-advideo') || (el.dataset && el.dataset.bexConceal))) clearConceal(el);
        const shadow = shadowOf(el);
        const style = shadow && shadow.querySelector && shadow.querySelector('#' + SHADOW_STYLE_ID);
        if (style) style.remove();
      });
    }
  }
  function endAd(resumePlayback) {
    // 검은 광고 막은 광고가 끝난 뒤에도 투명하게 둔다. 걷어 내면 본영상 위에 다시 깔린다.
    console.info('[BongExtend] 광고 종료');
    for (const v of boosted) {
      if (!v.isConnected) continue;
      try { v.playbackRate = 1; } catch (e) {}
      v._bongAdBoost = 0;
    }
    boosted.clear();
    scheduleLiveAudioRestore();
    try { globalThis.__bongRetryAudioRestore?.(); } catch (e) {}
    if (!resumePlayback) return;
    const resume = () => {
      if (!adScope()) return;
      const main = document.querySelector('video.webplayer-internal-video');
      if (main && main.paused && !globalThis.__bongAdActive) main.play().catch(() => {});
    };
    resume(); setTimeout(resume, 800); setTimeout(resume, 2500);
    try { globalThis.__bongAutoplayRetrigger?.(); } catch (e) {}
  }
  function adTick() {
    clearTimeout(adTimer);
    if (!chrome.runtime?.id) return;
    // 라이브 시청 중이 아니거나 방송이 꺼져 있으면 건너뛰기 루프를 돌리지 않는다.
    if (!adScope()) {
      if (adWasActive) endAd(false);
      globalThis.__bongAdActive = false;
      adWasActive = false;
      adTimer = setTimeout(adTick, 1000);
      return;
    }
    // 새 플레이어의 전/중간 광고는 본영상 .pzp의 형제 칸에 붙어요.
    const wrapper = [...document.querySelectorAll('#preAdPlayerWrapper, #midAdPlayerWrapper')].find(visible);
    const container = cfg.adSkip ? playerElements(wrapper || playerBox(), P.AD_CONTAINER_SEL).find(visible) || null : null;
    const root = cfg.adSkip ? (document.querySelector(ROOT) || document.querySelector('div.pzp') || document.getElementById('live_player_layout')) : null;
    let active = !!container, hits = [];
    if (root) {
      const ui = playerElements(root, '.webplayer-internal-core-ad-ui').find(visible);
      hits = scanTexts(root);
      active = active || P.isAdActive({ adUiExists: !!ui, adUiHidden: !!ui && ui.classList.contains('wpc-dis-hid'), indicatorVisible: visible(root.querySelector('.pzp-ad-break-indicator')), textHits: hits.length });
    }
    if (!active) for (const v of document.querySelectorAll('video')) watchContentAudio(v);
    globalThis.__bongAdActive = active; // 버퍼링 복구·자동 재생이 광고 중엔 개입하지 않도록
    if (cfg.adBlock !== false) concealAds(root || playerBox());
    if (active) {
      if (!adWasActive) {
        console.info('[BongExtend] 광고 감지', { naver: !!container, texts: hits.map(h => h.t) });
      }
      if (container) {
        for (const v of container.querySelectorAll('video')) boostAdVideo(v);
      }
      const skipScope = container ? naverAdRoot(container) : root;
      if (skipScope) clickReadySkip(skipScope);
      if (root) {
        for (const v of adVideos(root)) {
          const inAdLayer = hasAdLayerAncestor(v);
          if ((inAdLayer || !container) && !(location.pathname.startsWith('/live/') && !inAdLayer && !P.isAdDuration(v.duration))) boostAdVideo(v);
        }
      }
    } else if (adWasActive) endAd(true);
    adWasActive = active;
    adTimer = setTimeout(adTick, active ? 150 : 200);
  }
  new MutationObserver(ms => {
    if (cfg.adBlock) for (const m of ms) for (const n of m.addedNodes) stripDisplayAds(n);
    if (cfg.adBlock !== false && adScope() && ms.some(m => m.target && m.target.closest && (m.target.closest(ROOT) || m.target.closest('div.pzp') || m.target.id === 'live_player_layout'))) concealAds(playerBox());
    if (!adWasActive && cfg.adSkip && adScope() && document.querySelector(P.AD_CONTAINER_SEL)) adTick();
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('bong-route', () => adTick());
  adTick();

  // ── 주기 점검 (URL 변경, 재렌더 대비) ──
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; vividState.nextAt = 0; pollViewers(); }
    ensureVivid();
    if (!document.getElementById('bex-xstyle')) applyStyles();
  }, 3000);
  setInterval(() => { if (!vBusy) refreshViewerUi(); hideRankingFallback(); if (cfg.adBlock && document.body) stripDisplayAds(document.body); }, 1000); // 플레이어/채팅 재렌더 시 재부착
  setInterval(() => { // 새 비디오(광고 후 재초기화 포함)마다 선명한 화면 재적용
    const v = mainVideo();
    if (v && !v._bongVivid) { v._bongVivid = 1; ['loadedmetadata', 'playing'].forEach(ev => v.addEventListener(ev, () => { vividState.nextAt = 0; setTimeout(ensureVivid, 1500); })); }
  }, 1000);
})();
