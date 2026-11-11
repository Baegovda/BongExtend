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
  let reportGeneration = 0, reportAttempts = 0, reportPending = false, reportSettled = false, retryAt = 0;
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
    const wide = wideFullscreen && !!pageKey() && D.wideState(info(button)) === true;
    if (force || wide !== lastWide) {
      lastWide = wide;
      reportGeneration++;
      reportAttempts = 0; reportPending = false; reportSettled = false; retryAt = 0;
    }
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
      else retryAt = Date.now() + Math.min(RETRY_MS * reportAttempts, 5000);
    };
    void chrome.runtime.sendMessage({type:'BONG_CHZZK_WIDE_FULLSCREEN', wide}).then(complete, () => complete(null));
  }
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
