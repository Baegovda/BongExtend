// Preserve pre-theme canvas transparency only for negative-stacking frames.
// This never raises frames, unhides content, or changes their documents.
export function createPaintGuard(doc = document) {
  const win = doc.defaultView;
  let baseline = null, active = false, pending = 0;
  const owned = new Map();
  const frames = new Set();
  const rememberFrames = node => {
    if (node.nodeType !== 1) return false;
    let added = false;
    const remember = frame => {if (!frames.has(frame) && frames.size < 64) {frames.add(frame); added = true;}};
    if (node.tagName === 'IFRAME') remember(node);
    else for (const frame of node.querySelectorAll('iframe')) {remember(frame); if (frames.size >= 64) break;}
    return added;
  };
  const alpha = color => {
    const match = color.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    const parts = match[1].split(/[\s,/]+/).map(Number);
    return parts.length === 3 ? 1 : parts[3];
  };
  const plainTransparent = el => {
    if (!el) return false;
    const s = win.getComputedStyle(el);
    return alpha(s.backgroundColor) === 0 && s.backgroundImage === 'none' && s.opacity === '1' && s.filter === 'none' && s.transform === 'none' && s.mixBlendMode === 'normal';
  };
  const restore = () => {
    for (const [el, state] of owned) {
      if (el.style.getPropertyValue('background-color') === 'transparent' && el.style.getPropertyPriority('background-color') === 'important') {
        if (state.value) el.style.setProperty('background-color', state.value, state.priority); else el.style.removeProperty('background-color');
      } else baseline = null; // Site replaced our value: never take ownership again.
    }
    owned.clear();
  };
  const obscuredNegativeFrame = () => {
    // A bounded diagnostic pass on frame elements, not a whole-DOM style scan.
    for (const frame of frames) {
      if (!frame.isConnected) {frames.delete(frame); continue;}
      if (frame.closest('[hidden],[inert],[aria-hidden="true"],[disabled],[aria-disabled="true"]')) continue;
      const s = win.getComputedStyle(frame), z = Number(s.zIndex), rect = frame.getBoundingClientRect();
      if (!Number.isFinite(z) || z >= 0 || s.zIndex === 'auto' || s.position === 'static' || s.visibility !== 'visible' || s.display === 'none' || s.opacity !== '1' || rect.width < 20 || rect.height < 20 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= win.innerWidth || rect.top >= win.innerHeight) continue;
      let nestedContext = false;
      let depth = 0;
      for (let parent = frame.parentElement; parent && parent !== doc.body && parent !== doc.documentElement; parent = parent.parentElement) {
        if (++depth > 24) {nestedContext = true; break;}
        const p = win.getComputedStyle(parent);
        if (p.opacity !== '1' || p.visibility !== 'visible' || p.display === 'none' || p.transform !== 'none' || p.filter !== 'none' || p.isolation === 'isolate' || p.mixBlendMode !== 'normal' || /paint|layout|strict|content/.test(p.contain) || (p.position !== 'static' && p.zIndex !== 'auto')) {nestedContext = true; break;}
      }
      if (nestedContext) continue;
      const x = (Math.max(0, rect.left) + Math.min(win.innerWidth, rect.right)) / 2;
      const y = (Math.max(0, rect.top) + Math.min(win.innerHeight, rect.bottom)) / 2;
      const stack = doc.elementsFromPoint(x, y);
      // Do not make a modal/cover transparent. Only root/body may cover this frame.
      if (stack.some(el => el !== frame && el !== doc.body && el !== doc.documentElement && !el.contains(frame))) continue;
      return true;
    }
    return false;
  };
  const check = () => {
    pending = 0;
    if (!active || !baseline || baseline.html !== doc.documentElement || baseline.body !== doc.body) return;
    if (doc.documentElement.getAttribute('data-darkreader-scheme') !== 'dark') {restore(); return;}
    if ([doc.documentElement, doc.body].some(el => {const s = win.getComputedStyle(el); return s.opacity !== '1' || s.visibility !== 'visible' || s.display === 'none' || s.backgroundImage !== 'none' || s.transform !== 'none' || s.filter !== 'none' || s.mixBlendMode !== 'normal';})) {restore(); return;}
    for (const [el, state] of owned) {
      if (el.style.getPropertyValue('background-color') !== 'transparent' || el.style.getPropertyPriority('background-color') !== 'important') {
        owned.delete(el); baseline = null; restore(); return;
      }
      // Unrelated style changes are fine; only the owned property is guarded.
      state.style = el.getAttribute('style');
    }
    if (!obscuredNegativeFrame()) {restore(); return;}
    // Engine-injected opaque canvas is the only condition this guard repairs.
    if (!owned.size && ![doc.documentElement, doc.body].some(el => alpha(win.getComputedStyle(el).backgroundColor) > 0)) return;
    for (const el of [doc.documentElement, doc.body]) if (!owned.has(el)) {
      owned.set(el, {value: el.style.getPropertyValue('background-color'), priority: el.style.getPropertyPriority('background-color')});
      el.style.setProperty('background-color', 'transparent', 'important');
      owned.get(el).style = el.getAttribute('style');
    }
  };
  const schedule = () => {if (active && (frames.size || owned.size) && !pending) pending = win.setTimeout(check, 40);};
  const observer = new win.MutationObserver(mutations => {
    let relevant = false;
    for (const m of mutations) {
      if (m.type === 'attributes') {
        if (m.attributeName === 'style' && owned.get(m.target)?.style === m.target.getAttribute('style')) continue;
        // A sprite/gradient animation elsewhere cannot change the root/frame
        // paint relationship. Avoid style reads and frame queries for it.
        if ((frames.size || owned.size) && (m.target === doc.documentElement || m.target === doc.body || [...frames].some(frame => m.target === frame || m.target.contains(frame)))) relevant = true;
      } else {
        for (const frame of frames) if (!frame.isConnected) {frames.delete(frame); relevant = true;}
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1 || node.matches('style,script,link')) continue;
          if (rememberFrames(node)) relevant = true;
        }
      }
    }
    // Removal of the last frame must restore previously owned root styles.
    if (relevant) schedule();
  });
  const stop = () => {
    active = false; observer.disconnect();
    win.removeEventListener('resize', schedule); win.removeEventListener('scroll', schedule, true);
    if (pending) win.clearTimeout(pending); pending = 0; restore();
    frames.clear();
  };
  return {
    // Call only after disabling/restoring the previous theme, before enabling it.
    // If body is not available yet, prepare again once DOM is ready (theme off).
    prepare() {
      stop(); baseline = plainTransparent(doc.documentElement) && plainTransparent(doc.body) ? {html: doc.documentElement, body: doc.body} : null;
      return Boolean(baseline);
    },
    start() {
      if (active || !baseline) return;
      active = true;
      rememberFrames(doc.documentElement);
      observer.observe(doc, {subtree: true, childList: true, attributes: true, attributeFilter: ['style','class','hidden','inert','aria-hidden','disabled','aria-disabled','data-darkreader-scheme']});
      win.addEventListener('resize', schedule); win.addEventListener('scroll', schedule, {passive: true, capture: true}); schedule();
    },
    stop
  };
}

// Product photographs using multiply were authored against a pale backdrop.
// A darkened backdrop multiplies every photo pixel toward black. Keep the image
// paint independent only for opaque JPEG photos on a neutral dark surface.
// Call inspect from the bounded contrast walker, using its composed background.
export function createImageBlendGuard(doc = document) {
  const owned = new Map();
  const release = (el, state) => {
    if (el.style.getPropertyValue('mix-blend-mode') === 'normal' && el.style.getPropertyPriority('mix-blend-mode') === 'important') {
      if (state.value) el.style.setProperty('mix-blend-mode', state.value, state.priority);
      else el.style.removeProperty('mix-blend-mode');
    }
    owned.delete(el);
  };
  return {
    inspect(el, bg) {
      if (el.tagName !== 'IMG') return;
      const previous = owned.get(el);
      // Yield to a site's new inline paint instead of overwriting it.
      if (previous && (el.style.getPropertyValue('mix-blend-mode') !== 'normal' || el.style.getPropertyPriority('mix-blend-mode') !== 'important')) { owned.delete(el); return; }
      const source = el.currentSrc || el.src;
      const s = doc.defaultView.getComputedStyle(el);
      const eligible = doc.documentElement.getAttribute('data-darkreader-scheme') === 'dark' &&
        /\.jpe?g(?:[?#]|$)/i.test(source) && el.complete && el.naturalWidth >= 128 && el.naturalHeight >= 128 &&
        el.width >= 40 && el.height >= 40 && !el.closest('[hidden],[inert],[aria-hidden="true"],[disabled],[aria-disabled="true"]') &&
        s.visibility === 'visible' && s.display !== 'none' && s.opacity === '1' && s.filter === 'none' &&
        (previous ? previous.source === source : s.mixBlendMode === 'multiply') &&
        bg && bg[3] === 1 && Math.max(...bg.slice(0, 3)) <= 96 && Math.max(...bg.slice(0, 3)) - Math.min(...bg.slice(0, 3)) <= 20;
      if (!eligible) { if (previous) release(el, previous); return; }
      if (previous || owned.size >= 96) return;
      owned.set(el, {source, value: el.style.getPropertyValue('mix-blend-mode'), priority: el.style.getPropertyPriority('mix-blend-mode')});
      el.style.setProperty('mix-blend-mode', 'normal', 'important');
    },
    stop() { for (const [el, state] of owned) release(el, state); }
  };
}
