import {parseColor} from './contrast.js';

export function mapMailGradient(value, background, theme) {
  if (!/^(?:(?:repeating-)?(?:linear|radial|conic)-gradient\()/i.test(value) || /url\s*\(|image-set\s*\(|paint\s*\(/i.test(value)) return null;
  return value.replace(/rgba?\([^)]*\)/gi, token => {const color = parseColor(token); return color ? background(color, theme) : token;});
}

export function createMailThemeController(root, mappers) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const exclude = 'img,picture,video,audio,canvas,svg,iframe,object,embed,script,style,link,noscript,[hidden],[inert],[aria-hidden="true"],[disabled],[aria-disabled="true"],[contenteditable]:not([contenteditable="false"])';
  const records = new WeakMap(), sources = new WeakMap(), refs = new Set(), elementRefs = new WeakMap(), own = new WeakMap();
  let active = false, theme, themeKey = '', pending = 0, iterator = null, roots = new Set(), seen = new WeakSet(), count = 0;
  let preflight = null, preflightCount = 0;
  const stats = {visited: 0, writes: 0, passes: 0, maxBatch: 0, limitHit: false};
  const restore = el => {
    const record = records.get(el); if (!record) return;
    for (const [name, state] of record) if (el.style.getPropertyValue(name) === state.written && el.style.getPropertyPriority(name) === 'important') {
      if (state.value) el.style.setProperty(name, state.value, state.priority); else el.style.removeProperty(name);
    }
    records.delete(el); sources.delete(el); own.set(el, el.getAttribute('style'));
  };
  const write = (el, name, value, source) => {
    if (!value || value === source) return;
    let record = records.get(el);
    if (!record) {
      record = new Map(); records.set(el, record);
      let ref = elementRefs.get(el); if (!ref) {ref = new WeakRef(el); elementRefs.set(el, ref);} refs.add(ref);
    }
    if (!record.has(name)) record.set(name, {value: el.style.getPropertyValue(name), priority: el.style.getPropertyPriority(name), source});
    el.style.setProperty(name, value, 'important'); record.get(name).written = el.style.getPropertyValue(name);
    own.set(el, el.getAttribute('style')); stats.writes++;
  };
  const inheritedSource = (el, value) => {
    for (let parent = el.parentElement; parent && (parent === root || root.contains(parent)); parent = parent.parentElement) {
      const record = records.get(parent)?.get('color');
      if (record?.written === value) return record.source;
      const source = sources.get(parent); if (source?.color === value) return value;
    }
    return value;
  };
  const inspect = el => {
    restore(el);
    if (el !== root && !root.contains(el)) return;
    if (el.closest(exclude)) return;
    const style = win.getComputedStyle(el);
    if(el===root){
      write(el,'color-scheme','dark',style.colorScheme);
      write(el,'scrollbar-color',`#70757d ${theme.darkSchemeBackgroundColor||'#181a1b'}`,style.scrollbarColor);
    }
    if (style.display === 'none' || style.visibility !== 'visible' || style.filter !== 'none' || style.mixBlendMode !== 'normal') return;
    const original = {color: inheritedSource(el, style.color), background: style.backgroundColor, image: style.backgroundImage};
    const edges = ['Top','Right','Bottom','Left'].filter(side => parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none').map(side => [side, style[`border${side}Color`]]);
    sources.set(el, original);
    const fg = parseColor(original.color), bg = parseColor(original.background);
    // Do not change inherited currentColor inside artwork/editors/disabled UI.
    const preservesInheritedColor = el.querySelector('svg,[disabled],[aria-disabled="true"],[contenteditable]:not([contenteditable="false"])');
    if (fg && fg[3] > 0 && !preservesInheritedColor) write(el, 'color', mappers.foreground(fg, theme), original.color);
    if (bg && bg[3] > 0) write(el, 'background-color', mappers.background(bg, theme), original.background);
    else if (el === root) write(el, 'background-color', mappers.background([255,255,255,1], theme), original.background);
    const gradient = mapMailGradient(original.image, mappers.background, theme);
    if (gradient) write(el, 'background-image', gradient, original.image);
    for (const [side, value] of edges) {const color = parseColor(value); if (color && color[3] > 0) write(el, `border-${side.toLowerCase()}-color`, mappers.border(color, theme), value);}
  };
  const schedule = () => {if (active && !pending) pending = win.requestAnimationFrame(run);};
  const enqueue = node => {
    if (!active || !node || (node !== root && !root.contains(node))) return;
    if (roots.size < 32) roots.add(node); else if (!roots.has(node)) {stats.limitHit = true; stop(); return;} schedule();
  };
  function run() {
    pending = 0; if (!active) return; stats.passes++;
    const start = win.performance.now();let batch = 0;
    if (preflight) {
      while (batch < 120 && win.performance.now() - start < 8) {
        const node = preflight.nextNode();
        if (!node) {preflight = null; break;}
        batch++; if (++preflightCount > 6000) {stats.limitHit = true; stop(); return;}
      }
      stats.maxBatch = Math.max(stats.maxBatch, batch); schedule(); return;
    }
    while (batch < 120 && win.performance.now() - start < 8) {
      let node;
      if (!iterator) {
        const next = roots.values().next().value; if (!next) break;
        roots.delete(next);
        iterator = doc.createTreeWalker(next, 1, {acceptNode: el => el.matches(exclude) ? 2 : 1}); node = next;
      } else {node = iterator.nextNode(); if (!node) {iterator = null; continue;}}
      if (!seen.has(node)) {
        if (count >= 6000) {stats.limitHit = true; stop(); return;}
        seen.add(node); count++;
      }
      inspect(node); batch++; stats.visited++;
    }
    stats.maxBatch = Math.max(stats.maxBatch, batch);
    for (const ref of refs) {const el = ref.deref(); if (!el) refs.delete(ref); else if (el !== root && !root.contains(el)) {restore(el); refs.delete(ref);}}
    if (iterator || roots.size) schedule();
  }
  const observer = new win.MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'style' && own.get(m.target) === m.target.getAttribute('style')) continue;
      if (m.type === 'childList') for (const added of m.addedNodes) enqueue(added.nodeType === 1 ? added : m.target);
      else enqueue(m.target.nodeType === 1 ? m.target : m.target.parentElement);
    }
  });
  const stop = () => {
    active = false; observer.disconnect(); if (pending) win.cancelAnimationFrame(pending); pending = 0;
    roots.clear(); iterator = null; preflight = null;
    for (const ref of refs) {const el = ref.deref(); if (el) restore(el);} refs.clear(); seen = new WeakSet(); count = 0;
  };
  return {
    update(enabled, nextTheme) {
      if (!enabled) {stop(); return;}
      const key = JSON.stringify(nextTheme || {});
      if (active && key === themeKey) {enqueue(root); return;}
      stop(); theme = {...nextTheme}; themeKey = key; active = true; stats.limitHit = false;
      preflight = doc.createTreeWalker(root, 1, {acceptNode: el => el.matches(exclude) ? 2 : 1}); preflightCount = 1;
      observer.observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style','class','bgcolor','color','hidden','inert','disabled','aria-hidden','aria-disabled','contenteditable']});
      enqueue(root);
    },
    stop,
    stats
  };
}
