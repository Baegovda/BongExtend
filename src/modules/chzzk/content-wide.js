// 치지직 라이브·다시보기 자동 넓은 화면
(() => {
  'use strict';
  if (window.top !== window) return;
  const D = globalThis.BongWide;
  const RETRY_MS = 1200;
  const MAX_CLICKS = 5;
  let enabled = true, route = '', clicks = 0, timer = 0, lastClickAt = 0, settledRoute = '';

  BCStore.sync.get({ autoWide: true }, value => { enabled = value.autoWide !== false; start(true); });
  BCStore.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.autoWide) return;
    enabled = changes.autoWide.newValue !== false;
    start(true);
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


  // 브라우저 자체 단축키는 페이지의 합성 keydown으로 실행되지 않으므로 PC 보조 프로그램에 전달해요.
  let immersiveSeen=false,lastCollapse=0;
  function collapseTabs(){
    if(!pageKey()||Date.now()-lastCollapse<1500)return;
    lastCollapse=Date.now();
    void chrome.runtime.sendMessage({type:'BONG_COLLAPSE_VERTICAL_TABS',expandedHint:window.outerWidth-window.innerWidth>=100}).catch(()=>{});
  }
  function checkImmersive(){
    const active=!!document.fullscreenElement || info(findButton(playerRoot())).layoutWide;
    if(active&&!immersiveSeen)collapseTabs();immersiveSeen=active;
  }
  document.addEventListener('fullscreenchange',checkImmersive);
  window.addEventListener('focus',()=>{if(document.fullscreenElement || info(findButton(playerRoot())).layoutWide)collapseTabs();});
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.pzp-viewmode-button,.pzp-pc-viewmode-button,.pzp-pc-fullscreen-button,.pzp-fullscreen-button');
    if(button&&!document.fullscreenElement&&!info(button).layoutWide)collapseTabs();
  },true);

  let lastPath = location.pathname;
  setInterval(() => {
    checkImmersive();
    if (location.pathname !== lastPath) { lastPath = location.pathname; start(true); }
    else if (enabled && pageKey() && settledRoute !== pageKey() && !timer) schedule(0);
  }, 1000);
  document.addEventListener('playing', () => { if (enabled && pageKey() && settledRoute !== pageKey()) schedule(0); }, true);
  window.addEventListener('popstate', () => setTimeout(() => { lastPath = location.pathname; start(true); }, 200));
})();
