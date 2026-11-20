// Page backdrop photos in dark mode.
// Upstream image analysis is off for every site (artwork keeps its colors). That also left
// full-page decorative backdrops untouched: a bright photo stretched behind an app shell
// (example: Taobao IM, a pale meeting-room PNG behind the chat window) kept most of the screen white.
// A designer would keep the picture but sink it into the dark page. So, generically:
//   - only CSS background images (never <img>, video, canvas, logos or product photos),
//   - only on html/body or a container that covers at least half of the viewport and holds other content,
//   - only a single url() layer that decodes as opaque and light,
// get one dark translucent layer in the page's own dark base colour on top of the same image.
// The picture stays recognisable (not hidden, not inverted). OFF restores the original inline value.
const OWNED = 'data-bong-backdrop';
const MAX_OWNED = 6;

// sRGB 0-255 -> linear relative luminance.
const channel = value => {const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;};
export const relativeLuminance = (r, g, b) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

// Mean luminance and alpha of RGBA pixels (Uint8ClampedArray-like).
export function measurePixels(data) {
  let lum = 0, alpha = 0, count = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3] / 255;
    alpha += a;
    lum += a * relativeLuminance(data[i], data[i + 1], data[i + 2]) + (1 - a);
    count++;
  }
  return count ? {lum: lum / count, alpha: alpha / count} : null;
}

// The single url() of a background-image value, or null for gradients, several layers or none.
export function singleImageUrl(value) {
  const text = String(value || '').trim();
  // Several layers (a second url() or gradient after a comma) are left alone.
  if ((text.match(/url\(/gi) || []).length !== 1 || /\)\s*,/.test(text)) return null;
  const match = /^url\((["']?)(.*?)\1\)$/.exec(text);
  if (!match || !match[2] || /^data:image\/svg/i.test(match[2])) return null;
  return match[2];
}

// Light, opaque photos only. Dark or transparent artwork keeps its colours.
export const isLightBackdrop = measure => Boolean(measure && measure.alpha >= 0.95 && measure.lum >= 0.4);

// Overlay alpha that brings the mean down near the dark base while keeping a faint picture.
export function overlayAlpha(imageLum, baseLum, target = 0.045) {
  const span = imageLum - baseLum;
  if (!(span > 0)) return 0;
  return Math.min(0.92, Math.max(0.7, (imageLum - target) / span));
}

export function overlayValue(url, base, alpha) {
  const [r, g, b] = base.map(v => Math.round(v));
  const a = Math.round(alpha * 1000) / 1000;
  const tint = `rgba(${r}, ${g}, ${b}, ${a})`;
  return `linear-gradient(${tint}, ${tint}), url("${String(url).replace(/["\\]/g, '\\$&')}")`;
}

// A geometry/role check that needs no pixels. Covers >= half the viewport and is a container.
export function isBackdropBox({tag, area, viewportArea, childElements, root}) {
  if (/^(IMG|PICTURE|VIDEO|CANVAS|IFRAME|SVG|OBJECT|EMBED|INPUT|BUTTON|A)$/i.test(tag)) return false;
  if (!(viewportArea > 0) || area < viewportArea * 0.5) return false;
  return Boolean(root || childElements > 0);
}

const parseRgb = value => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(String(value || ''));
  if (!m) return null;
  const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
};

// In-page decode. Works when the image host sends CORS headers (many CDNs do).
export function measureInPage(url, doc = document) {
  return new Promise(resolve => {
    const win = doc.defaultView;
    const img = new win.Image();
    let done = false;
    const finish = value => {if (!done) {done = true; clearTimeout(timer); resolve(value);}};
    const timer = setTimeout(() => finish(null), 8000);
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const canvas = doc.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d', {willReadFrequently: true});
        ctx.drawImage(img, 0, 0, 32, 32);
        finish(measurePixels(ctx.getImageData(0, 0, 32, 32).data));
      } catch {finish(null);}
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
}

/**
 * @param {Document} doc
 * @param {{measure?: (url: string) => Promise<{lum:number, alpha:number}|null>}} [options]
 */
export function createBackdropDimmer(doc = document, {measure} = {}) {
  const win = doc.defaultView;
  const owned = new Map(); // element -> {value, priority, written, url}
  const verdicts = new Map(); // url -> Promise<measure|null>
  let active = false, timer = 0, observer = null, generation = 0;
  const measureUrl = url => {
    if (!verdicts.has(url)) {
      if (verdicts.size > 40) verdicts.clear();
      verdicts.set(url, (async () => (await measureInPage(url, doc)) || (measure ? await measure(url).catch(() => null) : null))());
    }
    return verdicts.get(url);
  };
  const release = el => {
    const state = owned.get(el);
    owned.delete(el);
    if (!state) return;
    if (el.style.getPropertyValue('background-image') === state.written) {
      if (state.value) el.style.setProperty('background-image', state.value, state.priority);
      else el.style.removeProperty('background-image');
    }
    el.removeAttribute(OWNED);
  };
  const baseColor = () => {
    for (const node of [doc.body, doc.documentElement]) {
      const c = node && parseRgb(win.getComputedStyle(node).backgroundColor);
      if (c && c[3] > 0.5) return c.slice(0, 3);
    }
    return [24, 26, 27];
  };
  const candidates = () => {
    const viewportArea = win.innerWidth * win.innerHeight, found = [];
    const visit = (el, depth) => {
      if (!el || depth > 7 || found.length >= MAX_OWNED) return;
      const rect = el.getBoundingClientRect(), area = Math.max(0, rect.width) * Math.max(0, rect.height);
      const root = el === doc.documentElement || el === doc.body;
      if (!root && area < viewportArea * 0.5) return;
      if (isBackdropBox({tag: el.tagName, area: root ? viewportArea : area, viewportArea, childElements: el.childElementCount, root})) {
        const s = win.getComputedStyle(el);
        const ownedState = owned.get(el);
        const url = ownedState ? ownedState.url : singleImageUrl(s.backgroundImage);
        if (url && s.visibility === 'visible' && s.display !== 'none') found.push({el, url});
      }
      for (const child of el.children) visit(child, depth + 1);
    };
    visit(doc.documentElement, 0);
    return found;
  };
  const scan = async () => {
    timer = 0;
    if (!active || doc.documentElement?.getAttribute('data-darkreader-scheme') !== 'dark') return;
    const run = ++generation;
    const list = candidates();
    const keep = new Set();
    for (const {el, url} of list) {
      const state = owned.get(el);
      // The site wrote its own inline background: yield to it.
      if (state && el.style.getPropertyValue('background-image') !== state.written) {release(el); continue;}
      if (state) {keep.add(el); continue;}
      let absolute;
      try {absolute = new URL(url, doc.baseURI).href;} catch {continue;}
      if (!/^https?:/.test(absolute)) continue;
      const result = await measureUrl(absolute);
      if (run !== generation || !active || !el.isConnected) return;
      if (!isLightBackdrop(result)) continue;
      const base = baseColor();
      const alpha = overlayAlpha(result.lum, relativeLuminance(...base));
      if (!alpha) continue;
      const written = overlayValue(absolute, base, alpha);
      owned.set(el, {value: el.style.getPropertyValue('background-image'), priority: el.style.getPropertyPriority('background-image'), written: '', url});
      el.setAttribute(OWNED, '1');
      el.style.setProperty('background-image', written, 'important');
      owned.get(el).written = el.style.getPropertyValue('background-image');
      keep.add(el);
    }
    for (const el of [...owned.keys()]) if (!keep.has(el)) release(el);
  };
  const schedule = (delay = 400) => {if (active && !timer) timer = win.setTimeout(() => void scan(), delay);};
  const onResize = () => schedule(600);
  return {
    start() {
      if (active) {schedule(0); return;}
      active = true;
      observer = new win.MutationObserver(records => {
        if (records.every(r => r.type === 'attributes' && r.target instanceof win.Element && r.target.hasAttribute(OWNED) && r.attributeName === OWNED)) return;
        schedule();
      });
      observer.observe(doc.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-darkreader-scheme']});
      win.addEventListener('resize', onResize);
      schedule(0);
    },
    stop() {
      active = false; generation++;
      if (timer) {win.clearTimeout(timer); timer = 0;}
      observer?.disconnect(); observer = null;
      win.removeEventListener('resize', onResize);
      for (const el of [...owned.keys()]) release(el);
    },
    owned: () => [...owned.keys()]
  };
}
