// 광고 차단 설정을 페이지 속성으로 넘긴다. 메인 세상 스크립트는 저장소를 읽지 못한다.
// 알려진 광고 칸은 첫 화면부터 가린다. display:none 은 쓰지 않는다.
(() => {
  'use strict';
  const STYLE_ID = 'bex-adconceal';
  const apply = (on) => {
    const root = document.documentElement;
    if (root) root.setAttribute('data-bong-adblock', on ? '1' : '0');
    let style = document.getElementById(STYLE_ID);
    if (!on) {
      if (style) style.remove();
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
  };
  apply(true);
  const store = globalThis.BCStore;
  if (!store) return;
  try {
    store.sync.get({adBlock: true}, v => apply(v.adBlock !== false));
    store.onChanged.addListener((changes, area) => {
      if (area === 'sync' && Object.prototype.hasOwnProperty.call(changes, 'adBlock')) apply(changes.adBlock.newValue !== false);
    });
  } catch (e) { /* 저장소를 못 읽으면 기본값(켜짐)을 유지한다 */ }
})();
