// 화면에 배달된 시청 보상만 사이트의 받기 버튼으로 수령해요.
// DOM 확인 참고: https://github.com/PCBiS/chzzk-log-power-helper/blob/main/content.js
(() => {
  'use strict';
  if (window.top !== window || globalThis.__bongLogPower) return;
  globalThis.__bongLogPower = true;

  const CHAT = '#aside-chatting, [class*="live_chatting_container"]';
  const MESSAGES = '[role="log"], [class*="live_chatting_list"], [class*="live_chatting_message"], [contenteditable="true"]';
  const POWER = '[class*="power_button"]';
  const RETRY_MS = 15000, MAX_ATTEMPTS = 3;
  let enabled = false, moduleEnabled = false, observer = null, timer = 0, poll = 0;
  let reward = null, lastClick = -Infinity, paused = false;

  function isReward(button) {
    if (button.closest(MESSAGES)) return false;
    const text = [button.textContent, button.getAttribute('aria-label')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!/받기/.test(text) || /받기\s*완료|수령\s*완료/.test(text)) return false;
    return button.matches(POWER) || /통나무\s*파워|1\s*시간\s*시청/.test(text);
  }

  function isRendered(button) {
    if (button.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    if (!button.getClientRects().length) return false;
    // 탭이 백그라운드에 있어도 렌더된 보상은 받아요. 접힌 채팅/숨겨진 버튼은 제외해요.
    for (let el = button; el; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.visibility === 'collapse' || style.display === 'none' || style.opacity === '0') return false;
    }
    return true;
  }

  function scan() {
    timer = 0;
    if (globalThis.BongAlive && !BongAlive()) { stop(); return; }
    if (!enabled || !moduleEnabled || paused) return;
    const channel = /^\/live\/([a-f\d]{32})(?:\/|$)/i.exec(location.pathname)?.[1]?.toLowerCase();
    if (!channel) { reward = null; return; }
    const buttons = [...document.querySelectorAll(CHAT)].flatMap(chat => [...chat.querySelectorAll('button')]);
    const candidates = [...new Set(buttons)].filter(button => isReward(button) && isRendered(button));
    if (!candidates.length) { reward = null; return; }
    if (!reward || reward.channel !== channel) reward = { channel, attempts: 0, nextAt: 0 };
    const now = Date.now();
    if (reward.attempts >= MAX_ATTEMPTS || now < reward.nextAt || now - lastClick < RETRY_MS) return;
    const button = candidates.find(button => !button.matches(':disabled') && !button.closest('fieldset[disabled], [aria-disabled="true"]'));
    if (!button) return;
    reward.attempts++;
    reward.nextAt = now + RETRY_MS;
    lastClick = now;
    button.click();
    // 클릭은 요청일 뿐, 실제 수령 성공 여부는 사이트가 처리해요.
  }

  function schedule() {
    if (!timer) timer = setTimeout(scan, 250);
  }

  function stop() {
    observer?.disconnect(); observer = null;
    clearTimeout(timer); timer = 0;
    clearInterval(poll); poll = 0;
    reward = null;
  }

  function sync() {
    stop();
    if (!enabled || !moduleEnabled || paused) return;
    observer = new MutationObserver(records => {
      // 채팅이 빠르게 올라와도 메시지 본문 변화는 검사하지 않아요.
      if (records.some(record => !(record.target.nodeType === 1 ? record.target : record.target.parentElement)?.closest(MESSAGES))) schedule();
    });
    observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'aria-hidden', 'aria-label', 'hidden', 'inert', 'class', 'style']
    });
    poll = setInterval(schedule, 5000); // SPA 이동·CSS 변경·실패한 수령 요청도 제한된 간격으로 확인해요.
    schedule();
  }

  Promise.all([
    BCStore.sync.get({ autoLogPower: true }),
    chrome.storage.local.get({ 'core.modules': {} })
  ]).then(([settings, local]) => {
    enabled = settings.autoLogPower !== false;
    moduleEnabled = local['core.modules']?.chzzk !== false;
    sync();
    BCStore.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes.autoLogPower) return;
      enabled = changes.autoLogPower.newValue !== false;
      sync();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes['core.modules']) return;
      moduleEnabled = changes['core.modules'].newValue?.chzzk !== false;
      sync();
    });
  }).catch(() => stop());
  window.addEventListener('pagehide', () => { paused = true; stop(); });
  window.addEventListener('pageshow', () => { paused = false; sync(); });
})();
