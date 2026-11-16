// BongHub 디자인 시스템의 작은 화면 도우미예요. 기능·설정 값은 건드리지 않고 보이는 것만 바꿔요.
// 1) 카드 제목(h4) 옆에 "2/3 켜짐" 표시  2) 슬라이더의 채워진 부분 색칠.
// 이벤트로만 갱신해요(타이머 없음).
(() => {
  'use strict';
  if (globalThis.__beThemeUi) return;
  globalThis.__beThemeUi = true;

  const switches = (card) => [...card.querySelectorAll('input[type=checkbox]')].filter((box) => !box.closest('[hidden]'));

  function updateCount(card) {
    const title = card.querySelector(':scope > h4');
    if (!title) return;
    const list = switches(card);
    let chip = title.querySelector(':scope > .be-count');
    if (list.length < 2) { chip?.remove(); return; }
    if (!chip) { chip = document.createElement('span'); chip.className = 'be-count'; title.append(chip); }
    const on = list.filter((box) => box.checked).length;
    chip.textContent = `${on}/${list.length} 켜짐`;
  }

  function fill(range) {
    const min = Number(range.min || 0), max = Number(range.max || 100), value = Number(range.value);
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    range.style.setProperty('--be-fill', `${Math.max(0, Math.min(100, pct))}%`);
  }

  const cards = () => document.querySelectorAll('.be-card, .be-group');
  function refreshAll() {
    cards().forEach(updateCount);
    document.querySelectorAll('input[type=range]').forEach(fill);
  }

  document.addEventListener('input', (event) => { if (event.target?.matches?.('input[type=range]')) fill(event.target); }, true);
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target?.matches?.('input[type=range]')) fill(target);
    if (target?.matches?.('input[type=checkbox]')) { const card = target.closest('.be-card, .be-group'); if (card) updateCount(card); }
  }, true);

  // 설정을 저장소에서 불러와 체크 상태가 코드로 바뀌는 경우(이벤트 없음)도 잡아요. 체크 속성 변화만 보고 아주 가볍게 해요.
  let queued = false;
  const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; refreshAll(); }); };
  const proto = HTMLInputElement.prototype;
  for (const prop of ['checked', 'value']) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc?.set) continue;
    Object.defineProperty(proto, prop, { ...desc, set(v) { desc.set.call(this, v); if (this.type === 'checkbox' || this.type === 'range') later(); } });
  }
  new MutationObserver(later).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshAll, { once: true });
  else refreshAll();
})();
