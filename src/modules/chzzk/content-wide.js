// 치지직 라이브·다시보기 자동 넓은 화면
(() => {
  'use strict';
  if (window.top !== window) return;
  const D = globalThis.BongWide;
  const RETRY_MS = 1200;
  const MAX_CLICKS = 5;
  let enabled = true, wideFullscreen = true, route = '', clicks = 0, timer = 0, lastClickAt = 0, settledRoute = '';

  BCStore.sync.get({ autoWide: true, wideFullscreen: true }, value => {
    enabled = value.autoWide !== false; wideFullscreen = value.wideFullscreen !== false;
    start(true); checkWide();
  });
  BCStore.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.autoWide) { enabled = changes.autoWide.newValue !== false; start(true); }
    if (changes.wideFullscreen) { wideFullscreen = changes.wideFullscreen.newValue !== false; checkWide(); }
  });

  const pageKey = () => /^\/(live|video)\/[^/]+/.test(location.pathname) ? location.pathname : '';
  const layout = () => document.getElementById('live_player_layout') || document.getElementById('player_layout');
  const playerRoot = () => layout() || document.querySelector('div.pzp.pzp-pc');
  function info(el) {
    const box = layout();
    const cls = el && el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el && el.className || '');
    return {
      cls,
      label: el && (el.getAttribute('aria-label') || el.getAttribute('title')) || '',
      text: (el && el.textContent || '').trim().slice(0, 40),
      ariaPressed: el && el.getAttribute('aria-pressed'),
      ariaChecked: el && el.getAttribute('aria-checked'),
      layoutKnown: !!box,
      layoutWide: !!box && (box.classList.contains('is_large') || box.classList.contains('is-wide') || box.classList.contains('wide'))
    };
  }
  function findButton(root) {
    if (!root) return null;
    const exact = root.querySelector('.pzp-viewmode-button, .pzp-pc-viewmode-button');
    if (exact) return exact;
    let best = null, bestScore = 0;
    for (const el of root.querySelectorAll('button, [role="button"], [class*="viewmode"], [class*="wide"], [class*="screen-mode"]')) {
      const score = D.scoreCandidate(info(el));
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }
  function schedule(delay = RETRY_MS) {
    clearTimeout(timer);
    timer = setTimeout(attempt, delay);
  }
  function attempt() {
    clearTimeout(timer);
    const key = pageKey();
    if (!enabled || !key) { route = ''; settledRoute = ''; return; }
    if (route !== key) { route = key; clicks = 0; lastClickAt = 0; settledRoute = ''; }
    if (settledRoute === key) return;

    const root = playerRoot();
    const video = root && root.querySelector('video');
    const button = video && findButton(root);
    if (!video || !button) { schedule(); return; }

    const state = D.wideState(info(button));
    if (state === true || info(root).layoutWide) {
      settledRoute = key;
      console.debug('[BongExtend] 넓은 화면 적용 확인');
      return;
    }

    if (clicks < MAX_CLICKS && Date.now() - lastClickAt >= RETRY_MS) {
      // 첫 화면 렌더 직후에는 치지직이 버튼 이벤트를 아직 붙이지 않은 경우가 있어 성공 여부를 확인하며 다시 시도한다.
      lastClickAt = Date.now();
      clicks++;
      button.click();
      console.debug('[BongExtend] 넓은 화면 전환 시도', clicks);
    }
    schedule();
  }
  function start(reset) {
    clearTimeout(timer);
    const key = pageKey();
    if (reset || key !== route) {
      route = key;
      clicks = 0;
      lastClickAt = 0;
      settledRoute = '';
    }
    if (enabled && key) schedule(700);
  }


  // Only an actual wide-layout transition controls browser fullscreen, never a predicted button click.
  let lastWide = null, observedLayout = null, observedButton = null, frame = 0;
  const MAX_REPORTS = 12;
  // 창 상태가 일시적으로 '사용 불가'라고 응답한 경우(Chrome이 직전 전환 중이거나 창 애니메이션 중)는 포기하지 않고 천천히 계속 시도해요(약 10분).
  const MAX_UNAVAILABLE = 120;
  let unavailableCount = 0;
  let reportGeneration = 0, reportAttempts = 0, reportPending = false, reportSettled = false, retryAt = 0;
  const FALSE_SETTLE_MS = 500;
  let falseSince = 0, falseTimer = 0;
  // 기록용 판단 근거: 플레이어 틀의 상태 표시(class)와 버튼 글자만 보내요(주소·제목·채팅은 담지 않아요).
  const detail = button => {
    const box = layout();
    const cls = box ? String(box.className || '').split(/\s+/).filter(c => /^(is_|type_|has_|wide|large)/i.test(c)).join(' ') : 'none';
    return `${cls} | ${button ? (button.getAttribute('aria-label') || button.getAttribute('title') || '').slice(0, 20) : 'no-button'}`.slice(0, 120);
  };
  const wideObserver = new MutationObserver(() => {
    if (!frame) frame = requestAnimationFrame(() => {frame = 0; checkWide();});
  });
  function checkWide(force = false) {
    const root = playerRoot(), button = findButton(root);
    if (root !== observedLayout || button !== observedButton) {
      wideObserver.disconnect(); observedLayout = root; observedButton = button;
      if (root) wideObserver.observe(root, {attributes:true, attributeFilter:['class']});
      if (button && button !== root) wideObserver.observe(button, {attributes:true, attributeFilter:['class','aria-pressed','aria-checked','aria-label','title']});
    }
    const detected = wideFullscreen && !!pageKey() && D.wideState(info(button)) === true;
    // 넓은 화면이 풀렸다는 판단은 잠깐 더 지켜봐요. 전체화면으로 바뀌는 순간 치지직이 화면을 다시 그리면서
    // 잠깐 넓은 화면 표시가 빠질 수 있는데, 그걸 믿으면 막 켠 전체화면을 곧바로 다시 풀어 버려요.
    if (!detected && lastWide === true && wideFullscreen && pageKey()) {
      if (!falseSince) falseSince = Date.now();
      if (Date.now() - falseSince < FALSE_SETTLE_MS) { clearTimeout(falseTimer); falseTimer = setTimeout(() => checkWide(), FALSE_SETTLE_MS + 50); return; }
    } else falseSince = 0;
    const wide = detected;
    if (force || wide !== lastWide) {
      lastWide = wide;
      reportGeneration++;
      reportAttempts = 0; reportPending = false; reportSettled = false; retryAt = 0; unavailableCount = 0;
    }
    // 탭이 화면에 안 보이면(최소화 등) 기다렸다가, 다시 보일 때(visibilitychange) 바로 보내요.
    if (wide && document.visibilityState === 'hidden') return;
    if (reportSettled || reportPending || reportAttempts >= MAX_REPORTS || Date.now() < retryAt) return;
    const generation = reportGeneration;
    reportPending = true;
    reportAttempts++;
    // A detected layout is not an acknowledgement: focus/API failures can be temporary.
    // Retry only a few times; an acknowledged manual F11 exit must remain untouched.
    const complete = response => {
      if (generation !== reportGeneration) return;
      reportPending = false;
      reportSettled = response?.ok === true || response?.status === 'disabled';
      // 창이 포커스를 잃은 상태('inactive')는 시도 횟수를 쓰지 않고 천천히 계속 확인해요. 포커스가 돌아오면 바로 다시 보내요.
      if (response?.status === 'inactive') { reportAttempts = Math.max(0, reportAttempts - 1); retryAt = Date.now() + 3000; }
      else if (response?.status === 'unavailable' && !response.error && unavailableCount++ < MAX_UNAVAILABLE) { reportAttempts = Math.max(0, reportAttempts - 1); retryAt = Date.now() + 5000; }
      else retryAt = Date.now() + Math.min(RETRY_MS * reportAttempts, 5000);
    };
    void chrome.runtime.sendMessage({type:'BONG_CHZZK_WIDE_FULLSCREEN', wide, detail:detail(button)}).then(complete, () => complete(null));
  }
  // 사용자가 넓은 화면 버튼을 직접 누르거나 단축키(t)를 눌렀을 때: 화면이 바뀌는 걸 기다리지 않고 곧바로 다시 확인해요.
  const userToggled = () => { setTimeout(() => checkWide(), 150); setTimeout(() => checkWide(), 700); };
  document.addEventListener('click', event => { if (event.target instanceof Element && event.target.closest('.pzp-viewmode-button, .pzp-pc-viewmode-button')) userToggled(); }, true);
  document.addEventListener('keyup', event => { if ((event.key === 't' || event.key === 'T') && !/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName || '') && !(document.activeElement && document.activeElement.isContentEditable)) userToggled(); }, true);
  window.addEventListener('focus', () => checkWide(true));
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === 'BONG_CHZZK_WIDE_REFRESH' && sender.id === chrome.runtime.id) checkWide(true);
  });
  document.addEventListener('visibilitychange', () => {if (!document.hidden) checkWide(true);});
  window.addEventListener('pageshow', () => checkWide(true));
  window.addEventListener('pagehide', () => {
    void chrome.runtime.sendMessage({type:'BONG_CHZZK_WIDE_FULLSCREEN', wide:false}).catch(() => {});
  });

  let lastPath = location.pathname;
  setInterval(() => {
    checkWide();
    if (location.pathname !== lastPath) { lastPath = location.pathname; start(true); checkWide(true); }
    else if (enabled && pageKey() && settledRoute !== pageKey() && !timer) schedule(0);
  }, 1000);
  document.addEventListener('playing', () => { if (enabled && pageKey() && settledRoute !== pageKey()) schedule(0); }, true);
  window.addEventListener('popstate', () => setTimeout(() => { lastPath = location.pathname; start(true); checkWide(true); }, 200));
})();
