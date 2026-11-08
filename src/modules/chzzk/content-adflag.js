// 광고 차단 설정을 페이지 속성으로 넘긴다. 메인 세상 스크립트는 저장소를 읽지 못한다.
// 알려진 광고 칸은 첫 화면부터 가린다. display:none 은 쓰지 않는다.
// 광고 막은 플레이어 그림자 루트 안에 있어서, 문서 CSS 만으로는 검게 덮인 채 남는다.
(() => {
  'use strict';
  // This upgrade also runs on already-open tabs, independently of the old style guard.
  if (!globalThis.__bongAdNoticeCleanup) {
    globalThis.__bongAdNoticeCleanup = true;
    const hiddenNotices = new Map();
    const restoreNotices = () => {
      for (const [layer, original] of hiddenNotices) {
        if (original.display) layer.style.setProperty('display', original.display, original.priority);
        else layer.style.removeProperty('display');
        if (original.ariaHidden == null) layer.removeAttribute('aria-hidden');
        else layer.setAttribute('aria-hidden', original.ariaHidden);
        layer.inert = original.inert;
      }
      hiddenNotices.clear();
    };
    const dismissNotices = node => {
      if (document.documentElement?.getAttribute('data-bong-adblock') === '0') { restoreNotices(); return; }
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      if (!element) return;
      const dialog = element.closest('[role="alertdialog"]');
      const dialogs = dialog ? [dialog] : [...element.querySelectorAll('[role="alertdialog"]')];
      for (const candidate of dialogs) {
        if (!globalThis.BongPlayer?.isAdBlockNoticeText(candidate.textContent)) continue;
        // The real confirmation handler rejects synthetic clicks (event.isTrusted).
        // Hide only this notice and its dedicated body-level backdrop, never the player.
        const parent = candidate.parentElement;
        const layer = parent?.parentElement === document.body && parent.childElementCount === 1
          && !parent.querySelector('video, main, #root, #aside-chatting') ? parent : candidate;
        if (hiddenNotices.has(layer)) continue;
        hiddenNotices.set(layer, {display: layer.style.getPropertyValue('display'), priority: layer.style.getPropertyPriority('display'), ariaHidden: layer.getAttribute('aria-hidden'), inert: layer.inert});
        layer.style.setProperty('display', 'none', 'important');
        layer.setAttribute('aria-hidden', 'true');
        layer.inert = true;
      }
    };
    const noticeObserver = new MutationObserver(records => {
      try { if (!chrome.runtime?.id) { noticeObserver.disconnect(); return; } }
      catch { noticeObserver.disconnect(); return; }
      for (const layer of hiddenNotices.keys()) if (!layer.isConnected) hiddenNotices.delete(layer);
      for (const record of records) {
        dismissNotices(record.target);
        for (const node of record.addedNodes || []) dismissNotices(node);
      }
    });
    noticeObserver.observe(document, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['role', 'data-bong-adblock']});
    dismissNotices(document.documentElement);
  }
  if (globalThis.__bongAdFlagHook) return;
  globalThis.__bongAdFlagHook = true;
  const STYLE_ID = 'bex-adconceal';
  const SHADOW_STYLE_ID = 'bex-adconceal-shadow';
  const openShadow = (el) => {
    if (!el || el.nodeType !== 1) return null;
    if (el.shadowRoot) return el.shadowRoot;
    try {
      const opener = globalThis.chrome && chrome.dom && chrome.dom.openOrClosedShadowRoot;
      if (typeof opener === 'function') return opener.call(chrome.dom, el) || null;
    } catch (e) {}
    return null;
  };
  const paintShadow = (on, root) => {
    const css = globalThis.BongPlayer && globalThis.BongPlayer.AD_CONCEAL_SHADOW_CSS;
    const seen = new Set();
    const walk = (node) => {
      if (!node || node.nodeType !== 1 || seen.has(node)) return;
      seen.add(node);
      const shadow = openShadow(node);
      if (shadow) {
        let style = shadow.querySelector && shadow.querySelector('#' + SHADOW_STYLE_ID);
        if (!on) { if (style) style.remove(); }
        else if (css) {
          if (!style) {
            style = document.createElement('style');
            style.id = SHADOW_STYLE_ID;
            shadow.appendChild(style);
          }
          if (style.textContent !== css) style.textContent = css;
        }
        const inner = shadow.children ? [...shadow.children] : [];
        for (const child of inner) walk(child);
      }
      const kids = node.children ? [...node.children] : [];
      for (const child of kids) walk(child);
    };
    const start = root || document.documentElement;
    if (start) walk(start);
  };
  const apply = (on) => {
    const root = document.documentElement;
    if (root) root.setAttribute('data-bong-adblock', on ? '1' : '0');
    let style = document.getElementById(STYLE_ID);
    if (!on) {
      if (style) style.remove();
      paintShadow(false);
      return;
    }
    const css = globalThis.BongPlayer && globalThis.BongPlayer.AD_CONCEAL_CSS;
    if (!css) return;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || root || document.documentElement).appendChild(style);
    }
    style.textContent = css;
    paintShadow(true);
  };
  let concealOn = true;
  const applyKnown = (on) => { concealOn = on !== false; apply(concealOn); };
  applyKnown(true);
  // 채팅이 들어올 때마다 문서 전체를 다시 걷지 않는다. 새로 붙은 칸과 플레이어만 본다.
  if (document.documentElement) {
    new MutationObserver(records => {
      if (!concealOn) return;
      for (const record of records) for (const node of record.addedNodes) paintShadow(true, node);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  setInterval(() => {
    try { if (!concealOn || !chrome.runtime || !chrome.runtime.id) return; } catch (e) { return; }
    for (const el of document.querySelectorAll('.pzp, .webplayer-internal-core-shadow, #live_player_layout')) paintShadow(true, el);
  }, 1000);
  const store = globalThis.BCStore;
  if (!store) return;
  try {
    store.sync.get({adBlock: true}, v => applyKnown(v.adBlock !== false));
    store.onChanged.addListener((changes, area) => {
      if (area === 'sync' && Object.prototype.hasOwnProperty.call(changes, 'adBlock')) applyKnown(changes.adBlock.newValue !== false);
    });
  } catch (e) { /* 저장소를 못 읽으면 기본값(켜짐)을 유지한다 */ }
})();
