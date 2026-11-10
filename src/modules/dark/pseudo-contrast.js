import {parseColor, composite, readableColor} from './contrast.js';

// Paint-only repairs for small CSS control glyphs. Never rewrite geometry,
// content, masks, images, HTML inline styles, or the upstream theme's sheet.
export function createPseudoContrastController(doc = document) {
  const win = doc.defaultView, records = new Map(), relinquished = new WeakSet();
  const marker = 'data-bong-pseudo-owned', limit = 96;
  const prefix = `b${win.crypto.getRandomValues(new Uint32Array(2)).join('')}-`;
  const excluded = '[hidden],[inert],[aria-hidden="true"],[disabled],[aria-disabled="true"],[contenteditable]:not([contenteditable="false"]),[data-bong-contrast-ignore],.pt-page-translator-sweep';
  let active = false, sheetNode = null, serial = 0, scheduled = 0, frameStart = 0, measured = 0, publishPending = false;
  const pending = new Set(), ownMarkers = new WeakMap();
  const stats = {inspected: 0, pseudoReads: 0, changed: 0, owned: 0, maxOwned: 0, capped: 0, sheetWrites: 0};
  const restore = el => {
    const r = records.get(el); if (!r) return;
    if (el.getAttribute(marker) === r.token) {
      if (r.original === null) el.removeAttribute(marker); else el.setAttribute(marker, r.original);
      ownMarkers.set(el, el.getAttribute(marker));
    } else relinquished.add(el); // A page-authored replacement belongs to the page.
    records.delete(el); stats.owned = records.size;
  };
  const publish = () => {
    if (publishPending) return;
    publishPending = true;
    // One stylesheet write per synchronous inspection batch, before paint.
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
      const w = parseFloat(s.width), h = parseFloat(s.height);
      if (!stable(s) || s.content === 'none' || s.content === 'normal' || s.boxShadow !== 'none' || s.textShadow !== 'none') continue;
      const empty = /^(["'])\1$/.test(s.content), text = s.content.replace(/^(["'])(.*)\1$/, '$2');
      const solid = parseColor(s.backgroundColor), localBg = solid ? composite(solid, bg) : bg;
      const props = [];
      const repair = (name, color, background) => {
        if (!color || Math.max(...color.slice(0, 3)) - Math.min(...color.slice(0, 3)) > 25) return;
        const next = readableColor(color, background, 3);
        if (next) props.push(`${name}:${next}!important`);
      };
      // Only slender empty rectangles qualify as background-painted +/- bars.
      if (empty && w > 0 && h > 0 && w <= 32 && h <= 32 && Math.min(w, h) <= 4 && solid?.[3] > 0) repair('background-color', solid, bg);
      // Restrict text to known short symbols; prose and custom-font PUA stay intact.
      if (!empty && /^[+−–\-±‹›<>⌃⌄^×✕↑↓←→]{1,3}$/.test(text) && parseFloat(s.fontSize) <= 32 && (!Number.isFinite(w) || w <= 40) && (!Number.isFinite(h) || h <= 40)) repair('color', parseColor(s.color), localBg);
      const sides = ['top', 'right', 'bottom', 'left'];
      const edges = sides.filter(side => parseFloat(s.getPropertyValue(`border-${side}-width`)) > 0 && s.getPropertyValue(`border-${side}-style`) === 'solid');
      if (empty && w > 0 && h > 0 && w <= 24 && h <= 24 && edges.length > 0 && edges.length <= 2 && (!solid || solid[3] === 0)) {
        for (const side of edges) if (parseFloat(s.getPropertyValue(`border-${side}-width`)) <= 4) repair(`border-${side}-color`, parseColor(s.getPropertyValue(`border-${side}-color`)), bg);
      }
      if (props.length) result.push([pseudo, props.join(';')]);
    }
    return result;
  };
  const eligible = el => {
    if (!(el instanceof win.HTMLElement) || !el.isConnected || !el.matches('button,a,span,i,[role="button"]') || el.closest(excluded)) return false;
    const control = el.closest('button,a[href],[role="button"]');
    if (!control || control.closest(excluded) || el.isContentEditable || control.querySelector('img,picture,video,canvas,svg')) return false;
    const rect = el.getBoundingClientRect(), cr = control.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.width > 64 || rect.height > 64 || cr.width > 64 || cr.height > 64 || rect.bottom < 0 || rect.top > win.innerHeight || rect.right < 0 || rect.left > win.innerWidth) return false;
    let n = el, depth = 0;
    for (; n && depth++ < 24; n = n.parentElement) {
      if (!stable(win.getComputedStyle(n))) return false;
    }
    return !n; // Do not assume an uninspected ancestor has ordinary compositing.
  };
  const inspect = (el, background) => {
    if (!active) return;
    const old = records.get(el);
    if (old && el.getAttribute(marker) !== old.token) {restore(el); publish(); return;}
    if (relinquished.has(el)) return;
    // The contrast walker visits all HTML: cheap reject before the measurement cap.
    if (!old && (!el?.matches?.('button,a,span,i,[role="button"]') || !el.closest('button,a[href],[role="button"]'))) return;
    if (doc.documentElement.getAttribute('data-darkreader-scheme') !== 'dark') {if (old) {restore(el); publish();} return;}
    const now = win.performance.now();
    if (now - frameStart >= 16) {frameStart = now; measured = 0;}
    if (++measured > limit && !old) {stats.capped++; return;}
    stats.inspected++;
    if (!Array.isArray(background) || background.length < 4 || background[3] !== 1 || !background.every(Number.isFinite) || !eligible(el)) {
      if (old) {restore(el); publish();} return;
    }
    if (!old && records.size >= limit) {stats.capped++; return;}
    // Temporarily remove just our selector during this synchronous measurement.
    // The browser never paints an intermediate frame, and upstream ignores our sheet.
    if (old) el.removeAttribute(marker);
    const paint = paints(el, background);
    if (old) el.setAttribute(marker, old.token);
    if (!paint.length) {if (old) {restore(el); publish();} return;}
    if (old && JSON.stringify(old.paint) === JSON.stringify(paint)) {old.bg = [...background]; return;}
    const r = old || {token: `${prefix}${++serial}`, original: el.getAttribute(marker)};
    r.paint = paint; r.bg = [...background]; records.set(el, r);
    el.setAttribute(marker, r.token); stats.changed++; stats.owned = records.size; stats.maxOwned = Math.max(stats.maxOwned, records.size);
    ownMarkers.set(el, r.token);
    publish();
  };
  const backdrop = el => {
    const layers = [];
    for (let n = el, depth = 0; n && depth++ < 24; n = n.parentElement) {
      const s = win.getComputedStyle(n); if (!stable(s)) return null;
      const color = parseColor(s.backgroundColor); if (!color) return null;
      layers.push(color);
      if (color[3] === 1) return layers.reverse().reduce((bg, c) => composite(c, bg), color);
    }
    return null;
  };
  const flush = () => {
    scheduled = 0;
    for (const el of pending) if (records.has(el)) inspect(el, backdrop(el));
    pending.clear();
  };
  const queue = () => {
    if (!active || !records.size || scheduled) return;
    for (const el of records.keys()) pending.add(el);
    scheduled = win.requestAnimationFrame(flush);
  };
  const observer = new win.MutationObserver(mutations => {
    if (mutations.some(m => m.attributeName !== marker || !ownMarkers.has(m.target) || m.target.getAttribute(marker) !== ownMarkers.get(m.target))) queue();
  });
  return {
    start() {
      if (active) return; active = true;
      sheetNode = doc.createElement('style'); sheetNode.className = 'darkreader bong-pseudo-contrast';
      (doc.head || doc.documentElement).append(sheetNode);
      observer.observe(doc, {subtree: true, childList: true, attributes: true, attributeFilter: ['class','style','hidden','disabled','inert','aria-hidden','aria-disabled','contenteditable','data-darkreader-scheme',marker]});
      for (const name of ['pointerover','pointerout','focusin','focusout']) doc.addEventListener(name, queue, true);
    },
    inspect,
    stop() {
      active = false; observer.disconnect(); if (scheduled) win.cancelAnimationFrame(scheduled); scheduled = 0; pending.clear();
      for (const name of ['pointerover','pointerout','focusin','focusout']) doc.removeEventListener(name, queue, true);
      for (const el of records.keys()) restore(el);
      sheetNode?.remove(); sheetNode = null;
    },
    stats
  };
}
