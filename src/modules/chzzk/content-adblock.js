// 페이지가 광고 응답을 읽기 전에 비운다. 메인 세상, document_start.
(() => {
  'use strict';
  const A = globalThis.BongAds;
  if (!A || globalThis.__bongAdHook) return;
  const enabled = () => {
    const root = document.documentElement;
    const flag = root && root.getAttribute('data-bong-adblock');
    return flag !== '0';
  };
  A.installAdHooks(globalThis, enabled);
})();
