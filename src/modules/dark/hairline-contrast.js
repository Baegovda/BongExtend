import {parseColor, composite, hairlineColor} from './contrast.js';

// Generic faint-hairline repair for pseudo elements (::before/::after) that draw
// 1-3px separators, scale ticks and dots with a very low-alpha neutral colour.
// Paint-only (background-color / border-color via one owned stylesheet). Never
// changes geometry, content, images or hides anything; restored on stop().
export function createHairlineController(doc = document) {
  const win = doc.defaultView, records = new Map(), relinquished = new WeakSet();
  const marker = 'data-bong-hairline-owned', limit = 160;
  const prefix = `h${win.crypto.getRandomValues(new Uint32Array(2)).join('')}-`;
  const excluded = '[hidden],[inert],[aria-hidden="true"],[disabled],[aria-disabled="true"],[contenteditable]:not([contenteditable="false"]),[data-bong-contrast-ignore],.pt-page-translator-sweep,img,picture,video,canvas,svg';
  let active = false, sheetNode = null, serial = 0, frameStart = 0, measured = 0, publishPending = false;
  const stats = {inspected: 0, pseudoReads: 0, changed: 0, owned: 0, maxOwned: 0, capped: 0, sheetWrites: 0};
  const restore = el => {
    const r = records.get(el); if (!r) return;
    if (el.getAttribute(marker) === r.token) {
      if (r.original === null) el.removeAttribute(marker); else el.setAttribute(marker, r.original);
    } else relinquished.add(el); // A page-authored replacement belongs to the page.
    records.delete(el); stats.owned = records.size;
  };
  const publish = () => {
    if (publishPending) return;
    publishPending = true;
    win.queueMicrotask(() => {
      publishPending = false;
      if (!active || !sheetNode?.sheet) return;
      const sheet = sheetNode.sheet;
      while (sheet.cssRules.length) sheet.deleteRule(sheet.cssRules.length - 1);
      for (const r of records.values()) for (const [pseudo, paint] of r.paint) {
        sheet.insertRule(`[${marker}="${r.token}"]::${pseudo}{${paint}}`, sheet.cssRules.length);
      }
      stats.sheetWrites++;
    });
  };
  const stable = s => s.display !== 'none' && s.visibility === 'visible' && Number(s.opacity) === 1 &&
    s.filter === 'none' && s.backdropFilter === 'none' && s.mixBlendMode === 'normal' &&
    s.animationName === 'none' && !s.transitionDuration.split(',').some(v => parseFloat(v) > 0) &&
    s.backgroundImage === 'none' && s.maskImage === 'none' && s.webkitMaskImage === 'none';
  const paints = (el, bg) => {
    const result = [];
    for (const pseudo of ['before', 'after']) {
      const s = win.getComputedStyle(el, `::${pseudo}`); stats.pseudoReads++;
      if (!stable(s) || !/^(["'])\1$/.test(s.content) || s.boxShadow !== 'none') continue;
      const w = parseFloat(s.width), h = parseFloat(s.height);
      if (!(w > 0 && h > 0)) continue;
      const props = [];
      const solid = parseColor(s.backgroundColor);
      if (solid && solid[3] > 0 && Math.min(w, h) <= 3 && Math.max(w, h) <= 800) {
        const next = hairlineColor(solid, bg); if (next) props.push(`background-color:${next}!important`);
      }
      // Hairlines drawn with a pseudo element's own 1-3px border (no fill).
      if (!solid || solid[3] === 0) {
        for (const side of ['top', 'right', 'bottom', 'left']) {
          const bw = parseFloat(s.getPropertyValue(`border-${side}-width`));
          if (!(bw > 0 && bw <= 3) || s.getPropertyValue(`border-${side}-style`) !== 'solid') continue;
          const color = parseColor(s.getPropertyValue(`border-${side}-color`));
          const next = color && hairlineColor(color, bg);
          if (next) props.push(`border-${side}-color:${next}!important`);
        }
        // A bordered box bigger than a hairline strip is a shape, not a divider.
        if (props.length && Math.max(w, h) > 800) props.length = 0;
      }
      if (props.length) result.push([pseudo, props.join(';')]);
    }
    return result;
  };
  const inspect = (el, bg) => {
    if (!active) return;
    const old = records.get(el);
    if (old && el.getAttribute(marker) !== old.token) {restore(el); publish(); return;}
    if (relinquished.has(el)) return;
    if (doc.documentElement.getAttribute('data-darkreader-scheme') !== 'dark') {if (old) {restore(el); publish();} return;}
    if (!(el instanceof win.HTMLElement) || el.closest(excluded) || !Array.isArray(bg) || bg.length < 4 || bg[3] !== 1 || !bg.every(Number.isFinite)) {
      if (old) {restore(el); publish();} return;
    }
    const now = win.performance.now();
    if (now - frameStart >= 16) {frameStart = now; measured = 0;}
    if (++measured > limit && !old) {stats.capped++; return;}
    if (!old && records.size >= limit * 2) {stats.capped++; return;}
    stats.inspected++;
    // Remove only our own selector during the synchronous measurement.
    if (old) el.removeAttribute(marker);
    const paint = paints(el, bg);
    if (old) el.setAttribute(marker, old.token);
    if (!paint.length) {if (old) {restore(el); publish();} return;}
    if (old && JSON.stringify(old.paint) === JSON.stringify(paint)) return;
    const r = old || {token: `${prefix}${++serial}`, original: el.getAttribute(marker)};
    r.paint = paint; records.set(el, r);
    el.setAttribute(marker, r.token); stats.changed++; stats.owned = records.size; stats.maxOwned = Math.max(stats.maxOwned, records.size);
    publish();
  };
  return {
    start() {
      if (active) return; active = true;
      sheetNode = doc.createElement('style'); sheetNode.className = 'darkreader bong-hairline-contrast';
      (doc.head || doc.documentElement).append(sheetNode);
    },
    inspect,
    stop() {
      active = false;
      for (const el of [...records.keys()]) restore(el);
      sheetNode?.remove(); sheetNode = null;
    },
    stats
  };
}
