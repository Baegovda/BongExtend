// Conservative post-theme repair. No content/events/layout changes; owned inline
// properties are restored only while the page has not replaced their values.
export const parseColor = value => {
  const m = String(value).match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const n = m[1].split(/[\s,/]+/).map(Number);
  return n.length >= 3 && n.every(Number.isFinite) ? [...n.slice(0, 3), n[3] ?? 1] : null;
};
export const composite = (front, back) => [...front.slice(0, 3).map((v, i) => v * front[3] + back[i] * (1 - front[3])), 1];
const luminance = c => c.slice(0, 3).map(v => {v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;}).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
export const contrastRatio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
export const readableColor = (foreground, background, target = 4.5) => {
  return repairColor(foreground, color => contrastRatio(composite(color, background), background), target);
};
const repairColor = (foreground, ratio, target) => {
  if (ratio(foreground) >= target) return null;
  // Preserve hue by moving toward white; never recolor saturated semantic colors.
  if (Math.max(...foreground.slice(0, 3)) - Math.min(...foreground.slice(0, 3)) > 70) return null;
  for (let amount = .05; amount <= 1.01; amount += .05) {
    const next = foreground.slice(0, 3).map(v => Math.round(v + (255 - v) * Math.min(1, amount)));
    if (ratio([...next, foreground[3]]) >= target) return foreground[3] < 1 ? `rgba(${next.join(', ')}, ${foreground[3]})` : `rgb(${next.join(', ')})`;
  }
  return null;
};

export function createContrastController(doc = document, {inspectImage} = {}) {
  const win = doc.defaultView;
  const excluded = 'img,picture,video,canvas,iframe,script,style,noscript,[hidden],[inert],[aria-hidden="true"],[disabled],[aria-disabled="true"],[contenteditable="true"],[data-bong-contrast-ignore],.pt-page-translator-sweep,[role="img"],.gmail_quote,.a3s,.ii,[data-message-id]';
  const records = new WeakMap(), refs = new Set(), elementRefs = new WeakMap(), ownStyles = new WeakMap(), markers = new WeakMap();
  let active = false, scheduled = 0, iterator = null, iteratorCount = 0;
  const roots = new Set();
  const swatches = new Map();
  let semanticColors = new WeakMap();
  const stats = {visited: 0, measured: 0, changed: 0, passes: 0, maxBatch: 0, styleReads: 0, animationReads: 0};
  let styleCache = new WeakMap(), animationCache = new WeakMap();
  // Upstream annotates our inline repair with its own derived custom properties.
  // Those annotations are not a new author style and must not start another
  // restore/repair pass (especially on pages with background transitions).
  const styleSignature = el => Array.from(el.style || [])
    .filter(name => !name.startsWith('--darkreader-'))
    .map(name => `${name}:${el.style.getPropertyValue(name)}!${el.style.getPropertyPriority(name)}`).join(';');
  const styleOf = el => {
    if (!styleCache.has(el)) {styleCache.set(el, win.getComputedStyle(el)); stats.styleReads++;}
    return styleCache.get(el);
  };
  const changingPaint = (el, style) => {
    if (style.animationName === 'none' && !style.transitionDuration.split(',').some(value => parseFloat(value) > 0)) return false;
    if (!animationCache.has(el)) {
      stats.animationReads++;
      animationCache.set(el, Boolean(el.getAnimations?.().some(a => (a.playState === 'running' || a.pending) && a.effect?.getKeyframes().some(k => 'opacity' in k || 'color' in k || 'backgroundColor' in k))));
    }
    return animationCache.get(el);
  };
  const restore = el => {
    const props = records.get(el);
    if (!props) return;
    for (const [name, p] of props) if (el.style.getPropertyValue(name) === p.written && el.style.getPropertyPriority(name) === 'important') {
      if (p.value) el.style.setProperty(name, p.value, p.priority); else el.style.removeProperty(name);
    }
    records.delete(el);
    if (el.getAttribute('data-bong-contrast-owned') === '1') {
      const old = markers.get(el); if (old == null) el.removeAttribute('data-bong-contrast-owned'); else el.setAttribute('data-bong-contrast-owned', old);
    }
    markers.delete(el);
    ownStyles.set(el, styleSignature(el));
  };
  const write = (el, name, value) => {
    let props = records.get(el);
    if (!props) {props = new Map(); records.set(el, props); let ref = elementRefs.get(el); if (!ref) {ref = new WeakRef(el); elementRefs.set(el, ref);} refs.add(ref);}
    if (!markers.has(el)) {markers.set(el, el.getAttribute('data-bong-contrast-owned')); el.setAttribute('data-bong-contrast-owned', '1');}
    if (!props.has(name)) props.set(name, {value: el.style.getPropertyValue(name), priority: el.style.getPropertyPriority(name), written: value});
    el.style.setProperty(name, value, 'important');
    // CSSOM canonicalizes color strings.
    props.get(name).written = el.style.getPropertyValue(name);
    ownStyles.set(el, styleSignature(el));
    stats.changed++;
  };
  const background = el => {
    const layers = [];
    for (let node = el, depth = 0; node && depth++ < 24; node = node.parentElement) {
      const s = styleOf(node);
      // Unknown compositing is deliberately left alone (images, opacity, blend).
      if (s.backgroundImage !== 'none' || Number(s.opacity) < .99 || s.mixBlendMode !== 'normal' || s.filter !== 'none') return null;
      const c = parseColor(s.backgroundColor); if (!c) return null;
      layers.push(c); if (c[3] >= 1) break;
    }
    return layers.reverse().reduce((back, front) => composite(front, back), [255, 255, 255, 1]);
  };
  const textContext = el => {
    const layers = [];
    for (let node = el, depth = 0; node; node = node.parentElement) {
      if (++depth > 24) return null;
      const s = styleOf(node), opacity = Number(s.opacity);
      // Never undo intentional fading, animations, disabled ancestors or
      // image/gradient/blend effects whose sampled background is unknown.
      const changing = changingPaint(node, s);
      if (opacity < .5 || s.visibility !== 'visible' || s.backgroundImage !== 'none' || s.filter !== 'none' || s.mixBlendMode !== 'normal' || changing) return null;
      const color = parseColor(s.backgroundColor); if (!color) return null;
      layers.push({color, opacity});
    }
    const over = (front, back) => {
      const a = front[3] + back[3] * (1 - front[3]);
      return [...front.slice(0,3).map((v,i) => a ? (v * front[3] + back[i] * back[3] * (1-front[3])) / a : 0), a];
    };
    const render = foreground => {
      let color = foreground;
      for (const layer of layers) {color = over(color, layer.color); color[3] *= layer.opacity;}
      return over(color, [255,255,255,1]);
    };
    const paper = render([0,0,0,0]);
    return {paper, ratio: fg => contrastRatio(render(fg), paper)};
  };
  const inspect = el => {
    restore(el);
    if (!el.isConnected || el.closest(excluded)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || rect.bottom < -100 || rect.top > win.innerHeight + 100 || rect.right < 0 || rect.left > win.innerWidth) return;
    const s = styleOf(el); stats.measured++;
    if (s.visibility !== 'visible' || s.display === 'none') return;
    if (Number(s.opacity) >= .99) inspectImage?.(el);
    const text = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const foreground = parseColor(s.color);
    if (text && foreground) {
      const context = textContext(el);
      if (context && luminance(context.paper) <= .25) {
        const color = repairColor(foreground, context.ratio, 4.5);
        if (color) write(el, 'color', color);
      }
    }
    if (Number(s.opacity) < .99) return;
    const bg = background(el);
    if (!bg) return;
    // Associate only explicit legend modifiers with matching data category values.
    // No domain names, dates, counts, text rewriting or chart-wide recoloring.
    if (rect.width >= 4 && rect.width <= 40 && rect.height >= 4 && rect.height <= 40 && !el.textContent.trim()) {
      const scope = el.closest('section,article,figure,[role="figure"]');
      const fill = parseColor(s.backgroundColor);
      const legend = [...el.classList].map(c => c.match(/legend[\w-]*--([\w-]+)$/i)?.[1]).find(Boolean);
      const categories = legend ? [legend] : Object.values(el.dataset).filter(v => /^[a-z][a-z-]{1,20}$/.test(v));
      if (scope && fill && fill[3] > .95) for (const category of categories) {
        const palette = semanticColors.get(scope);
        if (palette?.has(category)) write(el, 'background-color', palette.get(category));
        if (!swatches.has(scope) && swatches.size < 20) swatches.set(scope, new Map());
        const scoped = swatches.get(scope); if (!scoped) continue;
        if (!scoped.has(category) && scoped.size < 20) scoped.set(category, []);
        const list = scoped.get(category);
        if (list && list.length < 600 && !list.some(item => item.ref.deref() === el)) list.push({ref: new WeakRef(el), color: fill, legend: Boolean(legend)});
      }
    }
    if (luminance(bg) > .25) return;
    const iconSvg = el.namespaceURI === 'http://www.w3.org/2000/svg' && el.closest('svg');
    const iconRect = iconSvg && (iconSvg === el ? rect : iconSvg.getBoundingClientRect());
    const smallIcon = iconSvg && iconRect.width <= 40 && iconRect.height <= 40 && el.closest('button,a,[role="button"]') && !iconSvg.querySelector('mask,filter,use,style,pattern,animate,animateTransform,animateMotion,set') && iconSvg.querySelectorAll('*').length <= 24;
    const fg = parseColor(s.color);
    if (smallIcon && fg) {
      const color = readableColor(fg, bg, 3);
      if (color) write(el, 'color', color);
      if (!el.closest('defs,clipPath,pattern,linearGradient,radialGradient')) {
        const paint = styleOf(el);
        for (const property of ['fill','stroke']) {
          const value = parseColor(paint[property]);
          if (value && value[3] > 0) {const next = readableColor(value, bg, 3); if (next) write(el, property, next);}
        }
      }
    }
    const selected = el.matches('[role="tab"][aria-selected="true"],a[aria-current]:not([aria-current="false"]),[role="menuitem"][aria-current]:not([aria-current="false"])');
    const selectionParent = selected && el.parentElement && background(el.parentElement);
    const selectionEdge = selected && ['Top','Right','Bottom','Left'].some(side => {const color = parseColor(s[`border${side}Color`]); return parseFloat(s[`border${side}Width`]) > 0 && color && contrastRatio(composite(color, bg), bg) >= 2;});
    if (selected && selectionParent && contrastRatio(bg, selectionParent) < 1.3 && !selectionEdge && s.boxShadow === 'none' && s.outlineStyle === 'none') {write(el, 'outline', '1px solid rgba(190, 202, 218, 0.65)'); write(el, 'outline-offset', '-1px');}
    if (el === doc.body || el === doc.documentElement || el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || rect.width < 80 || rect.height < 32 || s.outlineStyle !== 'none' || selected || el.matches(':focus-visible')) return;
    const hasEdge = s.boxShadow !== 'none' || ['Top','Right','Bottom','Left'].some(side => parseFloat(s[`border${side}Width`]) > 0 && s[`border${side}Style`] !== 'none');
    const surface = parseColor(s.backgroundColor), parent = el.parentElement && background(el.parentElement);
    // A compact semantic control strip may have a real opaque surface but no
    // border/shadow. Distinguish that group without recoloring its controls.
    if (el.matches('[role="tablist"],nav,[role="navigation"]') && rect.height <= 100 && surface?.[3] > .9 && parent && contrastRatio(bg, parent) < 1.3 && Math.max(...bg.slice(0,3)) - Math.min(...bg.slice(0,3)) < 35 && !changingPaint(el, s) && !el.querySelector('img,picture,video,canvas,svg,[disabled],[aria-disabled="true"]')) {
      const controls = Array.from(el.querySelectorAll('a,button,[role="tab"],[role="menuitem"]')).slice(0,13);
      if (controls.length >= 2 && controls.length <= 12 && controls.every(control => {const r = control.getBoundingClientRect(); return r.width > 0 && r.width <= 240 && r.height > 0 && r.height <= 60;})) {
        write(el, 'background-color', `rgb(${bg.slice(0,3).map(v => Math.round(Math.min(255,v+10))).join(', ')})`);
        return;
      }
    }
    if (hasEdge && surface && surface[3] > .9 && parent && contrastRatio(bg, parent) < 1.3) {
      write(el, 'outline', '1px solid rgba(190, 202, 218, 0.35)');
      write(el, 'outline-offset', '-1px');
      if (Math.max(...bg.slice(0,3)) - Math.min(...bg.slice(0,3)) < 35) write(el, 'background-color', `rgb(${bg.slice(0,3).map(v => Math.round(Math.min(255,v+7))).join(', ')})`);
    }
  };
  const enqueue = root => {
    if (!active || !root) return;
    if (roots.size < 32) roots.add(root);
    schedule();
  };
  function schedule() {
    if (scheduled || !active) return;
    scheduled = win.requestIdleCallback ? win.requestIdleCallback(run, {timeout: 150}) : win.setTimeout(run, 30);
  }
  function run() {
    scheduled = 0;
    if (!active) return;
    // Wait for Dark Reader instead of interpreting a partially themed page.
    if (doc.documentElement?.getAttribute('data-darkreader-scheme') !== 'dark') return;
    stats.passes++;
    styleCache = new WeakMap(); animationCache = new WeakMap();
    let count = 0;
    const started = win.performance.now();
    while (count < 180 && win.performance.now() - started < 8) {
      if (!iterator) {
        const root = roots.values().next().value;
        if (!root) break;
        roots.delete(root);
        iterator = doc.createTreeWalker(root, 1);
        iteratorCount = 0;
        inspect(root); count++;
      }
      const el = iterator.nextNode();
      if (!el) {iterator = null; continue;}
      if (++iteratorCount > 6000) {iterator = null; continue;}
      inspect(el); count++;
    }
    stats.visited += count; stats.maxBatch = Math.max(stats.maxBatch, count);
    // Prune dead/disconnected references, never retain detached DOM trees.
    for (const ref of refs) {const el = ref.deref(); if (!el || !el.isConnected || !records.has(el)) refs.delete(ref);}
    if (iterator || roots.size) schedule();
    else {
      for (const [scope, scoped] of swatches) {
      const groups = [...scoped.entries()].map(([key, items]) => [key, items.filter(item => item.ref.deref()?.isConnected)]).filter(([, items]) => items.some(i => i.legend) && items.some(i => !i.legend));
      if (groups.length >= 2 && groups.length <= 4) {
        const colors = groups.map(([, items]) => items.find(i => i.legend).color);
        const close = colors.some((a, i) => colors.slice(i + 1).some(b => Math.hypot(...a.slice(0,3).map((v,j) => v-b[j])) < 110));
        if (close && !semanticColors.has(scope)) {
          const mapping = new Map(); semanticColors.set(scope, mapping);
          const palette = ['rgb(239, 136, 80)', 'rgb(85, 189, 214)', 'rgb(192, 150, 225)', 'rgb(173, 202, 104)'];
          groups.forEach(([key, items], i) => {mapping.set(key, palette[i]); items.forEach(item => {const el = item.ref.deref(); if (el) write(el, 'background-color', palette[i]);});});
          // Reconcile earlier batches with the same mapping, once only.
          enqueue(doc.documentElement);
        }
      }
      }
      swatches.clear();
    }
  }
  const observer = new win.MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'style' && ownStyles.has(m.target) && ownStyles.get(m.target) === styleSignature(m.target)) continue;
      if (m.target.closest?.('style,script')) continue;
      if (m.type === 'childList') for (const node of m.addedNodes) {if (node.nodeType === 1) enqueue(node); else enqueue(m.target);}
      else enqueue(m.target.nodeType === 1 ? m.target : m.target.parentElement);
    }
  });
  const update = () => enqueue(doc.documentElement);
  const focusChanged = event => enqueue(event.target);
  const settledEffect = event => {
    if (event.type === 'transitionend' && records.get(event.target)?.has(event.propertyName)) return;
    enqueue(event.target);
  };
  return {
    start() {
      if (active) return;
      active = true;
      observer.observe(doc, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style','class','fill','stroke','hidden','disabled','aria-disabled','aria-hidden','aria-selected','aria-current','role','data-darkreader-scheme']});
      win.addEventListener('scroll', update, {passive: true, capture: true}); win.addEventListener('resize', update); update();
      doc.addEventListener('transitionend', settledEffect); doc.addEventListener('animationend', settledEffect);
      doc.addEventListener('focusin', focusChanged); doc.addEventListener('focusout', focusChanged);
    },
    update,
    stop() {
      active = false; observer.disconnect();
      if (scheduled) {if (win.cancelIdleCallback) win.cancelIdleCallback(scheduled); else win.clearTimeout(scheduled);} scheduled = 0;
      win.removeEventListener('scroll', update, true); win.removeEventListener('resize', update);
      doc.removeEventListener('transitionend', settledEffect); doc.removeEventListener('animationend', settledEffect);
      doc.removeEventListener('focusin', focusChanged); doc.removeEventListener('focusout', focusChanged);
      roots.clear(); swatches.clear(); semanticColors = new WeakMap(); iterator = null;
      for (const ref of refs) {const el = ref.deref(); if (el) restore(el);} refs.clear();
    },
    stats
  };
}
