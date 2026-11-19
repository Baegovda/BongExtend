import {parseColor, contrastRatio, composite, readableColor} from './contrast.js';
import {prepareIconPixels, repairIconPixelsWasm} from './icon-pixels.js';

// Only small transparent bitmap controls are eligible. Decode locally, preserve
// every saturated pixel and alpha value, and never send page data to a service.
// Logo-sized images (header brand marks) get larger decode limits than icons.
export const ICON_LIMITS = Object.freeze({width: 512, height: 256, pixels: 65536, bytes: 131072, target: 4.5});
// A brand mark should stand out like the header text, not merely pass 4.5:1.
export const LOGO_LIMITS = Object.freeze({width: 1200, height: 400, pixels: 320000, bytes: 524288, target: 10});
export function repairIconPixels(data, width, height, background, limits = ICON_LIMITS) {
  if (!width || !height || width > limits.width || height > limits.height || width * height > limits.pixels) return null;
  let clear = 0, painted = 0, neutral = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) clear++;
    else {
      painted++;
      if (Math.max(data[i], data[i+1], data[i+2]) - Math.min(data[i], data[i+1], data[i+2]) <= 25) neutral++;
    }
  }
  // Opaque images/photos and dense silhouettes are deliberately left alone.
  if (clear < width * height * .2 || painted < 8 || painted > width * height * .6 || neutral < 8) return null;
  const out = new Uint8ClampedArray(data);
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] < 8 || Math.max(data[i], data[i+1], data[i+2]) - Math.min(data[i], data[i+1], data[i+2]) > 25) continue;
    // Evaluate the opaque glyph color; antialiased edge alpha stays untouched.
    const color = [data[i], data[i+1], data[i+2], 1];
    if (contrastRatio(color, background) >= 3) continue;
    const next = parseColor(readableColor(color, background, limits.target ?? 4.5));
    if (!next) continue;
    out[i] = next[0]; out[i+1] = next[1]; out[i+2] = next[2]; changed++;
  }
  return changed >= 8 ? out : null;
}


// Small CSS icons drawn from an inline data: SVG (background-image on an element
// or its ::before/::after). Text-only rewrite: never fetched, never rasterized.
// Neutral dark paint (explicit, or the implicit black of unpainted shapes) is
// lifted to a readable colour; coloured paint and masked/referencing SVGs stay.
const NEUTRAL_NAMES = {black:0,white:255,gray:128,grey:128,silver:192,darkgray:169,darkgrey:169,dimgray:105,dimgrey:105};
const svgPaint = value => {
  const v = String(value || '').trim().toLowerCase();
  const hex = v.match(/^#([a-f\d]{3}|[a-f\d]{6})$/);
  if (hex) {const d = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1]; return [0,2,4].map(i => parseInt(d.slice(i, i + 2), 16)).concat(1);}
  if (v in NEUTRAL_NAMES) return [NEUTRAL_NAMES[v], NEUTRAL_NAMES[v], NEUTRAL_NAMES[v], 1];
  return parseColor(v);
};
export function recolorSvgDataUrl(url, background, target = 7) {
  const m = String(url || '').match(/^data:image\/svg\+xml(;base64)?(?:;[^,]*)?,([\s\S]*)$/i);
  if (!m || url.length > 32768 || !background) return null;
  let text;
  try {text = m[1] ? atob(m[2]) : decodeURIComponent(m[2]);} catch {return null;}
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) return null;
  if (/<(?:script|foreignObject|image|use|style|mask|clipPath|pattern|filter|animate|set|linearGradient|radialGradient)\b|\son\w+\s*=|href\s*=|url\(|<!DOCTYPE|<!ENTITY/i.test(text)) return null;
  let changed = 0;
  const lift = value => {
    const color = svgPaint(value);
    if (!color || color[3] === 0 || Math.max(...color.slice(0,3)) - Math.min(...color.slice(0,3)) > 25) return null;
    if (contrastRatio(composite(color, background), background) >= 3) return null;
    return readableColor(color, background, target);
  };
  text = text.replace(/\s(fill|stroke)\s*=\s*(["'])([^"']*)\2/gi, (all, name, quote, value) => {const next = lift(value); if (!next) return all; changed++; return ` ${name}=${quote}${next}${quote}`;});
  // Unpainted shapes render black by default; give the root a readable fill.
  const root = text.match(/<svg\b[^>]*>/i)[0];
  const unpainted = /<(?:path|circle|rect|polygon|polyline|ellipse)\b(?![^>]*\sfill\s*=)[^>]*>/i.test(text);
  if (unpainted && !/\sfill\s*=/i.test(root)) {
    const next = lift('#000');
    if (next) {text = text.replace(root, root.replace(/^<svg\b/i, `<svg fill="${next}"`)); changed++;}
  }
  return changed ? 'data:image/svg+xml,' + encodeURIComponent(text) : null;
}

export function createIconContrastController(doc = document, onSettled = () => {}, {fetchImage} = {}) {
  const win = doc.defaultView, cache = new Map(), records = new WeakMap(), refs = new Set(), aborts = new Set();
  // 빠른 픽셀 보정(WebAssembly)을 미리 준비해요. 준비 전에 온 그림은 예전 계산으로 처리해요.
  void prepareIconPixels();
  let active = false, generation = 0, pending = 0;
  // Inline data-SVG icons: one owned stylesheet keyed by a per-element token.
  const svgMarker = 'data-bong-svgicon', svgRecords = new Map();
  const svgPrefix = `s${win.crypto?.getRandomValues ? win.crypto.getRandomValues(new Uint32Array(1))[0] : Date.now()}-`;
  let svgSheet = null, svgSerial = 0, svgPublishPending = false;
  const svgPublish = () => {
    if (svgPublishPending) return; svgPublishPending = true;
    win.queueMicrotask(() => {
      svgPublishPending = false;
      if (!active) return;
      if (!svgSheet?.isConnected) {svgSheet = doc.createElement('style'); svgSheet.setAttribute('data-bong-svgicon-sheet', ''); (doc.head || doc.documentElement).appendChild(svgSheet);}
      const css = [];
      for (const r of svgRecords.values()) for (const [part, value] of r.parts) css.push(`[${svgMarker}="${r.token}"]${part ? '::' + part : ''}{background-image:url("${value}")!important}`);
      svgSheet.textContent = css.join('\n');
    });
  };
  const svgRestore = el => {const r = svgRecords.get(el); if (!r) return; if (el.getAttribute(svgMarker) === r.token) el.removeAttribute(svgMarker); svgRecords.delete(el); svgPublish();};
  // Backdrop for icons that fade in on hover: opacity is ignored on purpose.
  const iconBackdrop = el => {
    for (let n = el, depth = 0; n && depth++ < 16; n = n.parentElement) {
      const s = win.getComputedStyle(n);
      if (s.filter !== 'none' || s.mixBlendMode !== 'normal') return null;
      if (n !== el && s.backgroundImage !== 'none') return null;
      const c = parseColor(s.backgroundColor);
      if (c?.[3] >= .95) return composite(c, [24,26,27,1]);
    }
    return null;
  };
  const inspectSvgIcon = el => {
    const old = svgRecords.get(el);
    if (old && el.getAttribute(svgMarker) !== old.token) {svgRecords.delete(el); svgPublish(); return;}
    if (el.closest('[hidden],[inert],[contenteditable],[data-bong-contrast-ignore],.a3s,.ii,[data-message-id]')) {if (old) svgRestore(el); return;}
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8 || rect.width > 48 || rect.height > 48) return;
    const found = [];
    for (const part of ['', 'before', 'after']) {
      const s = part ? win.getComputedStyle(el, '::' + part) : win.getComputedStyle(el);
      if (part && (s.content === 'none' || s.content === 'normal')) continue;
      if (part && (parseFloat(s.width) > 48 || parseFloat(s.height) > 48)) continue;
      const mm = s.backgroundImage.match(/^url\(["']?(data:image\/svg\+xml[\s\S]*?)["']?\)$/i);
      if (mm) found.push([part, mm[1]]);
    }
    // Our own replacement is what computed style shows now: nothing new to do.
    if (old && found.length === old.parts.length && found.every(([p, v]) => old.parts.some(([q, w]) => q === p && w === v))) return;
    if (!found.length) {if (old) svgRestore(el); return;}
    const bg = iconBackdrop(el);
    if (!bg || contrastRatio([255,255,255,1], bg) < 4.5) {if (old) svgRestore(el); return;}
    const next = [];
    for (const [part, value] of found) {
      const fixed = recolorSvgDataUrl(value, bg);
      if (fixed) next.push([part, fixed]);
    }
    if (!next.length) {if (old) svgRestore(el); return;}
    const token = old?.token || svgPrefix + (++svgSerial);
    el.setAttribute(svgMarker, token);
    svgRecords.set(el, {token, parts: next}); refs.add(new WeakRef(el));
    svgPublish();
  };
  const restore = el => {
    const r = records.get(el); if (!r) return;
    if (el.style.getPropertyValue(r.property) === r.written && el.style.getPropertyPriority(r.property) === 'important') {
      if (r.value) el.style.setProperty(r.property, r.value, r.priority); else el.style.removeProperty(r.property);
    }
    if (el.getAttribute('data-bong-icon-owned') === '1') {
      if (r.marker == null) el.removeAttribute('data-bong-icon-owned'); else el.setAttribute('data-bong-icon-owned', r.marker);
    }
    records.delete(el);
  };
  const signature = el => [el,el.parentElement,el.parentElement?.parentElement].map(e=>e?.getAttribute('class') || '').join('|') + '|' + (el.tagName === 'IMG' ? el.currentSrc : '');
  const backdrop = el => {
    for (let n = el, depth = 0; n && depth++ < 16; n = n.parentElement) {
      const s = win.getComputedStyle(n);
      if (Number(s.opacity) < .99 || s.filter !== 'none' || s.mixBlendMode !== 'normal') return null;
      if (n !== el && s.backgroundImage !== 'none') return null;
      const c = parseColor(s.backgroundColor);
      if (c?.[3] >= .95) return composite(c, [24,26,27,1]);
    }
    return null;
  };
  const decode = async (url, bg, limits = ICON_LIMITS) => {
    const controller = new AbortController(); aborts.add(controller);
    const timer = win.setTimeout(()=>controller.abort(), 3000);
    let bitmap, objectURL, svgDocument;
    try {
      const response = await (fetchImage || win.fetch.bind(win))(url, {credentials:'omit', redirect:'error', signal:controller.signal});
      const mime = (response.headers.get('content-type') || '').split(';')[0];
      if (!response.ok || !/^image\/(png|webp|svg\+xml)$/i.test(mime)) return null;
      const reader = response.body?.getReader(); if (!reader) return null;
      const chunks = []; let size = 0;
      for (;;) {const {value,done}=await reader.read(); if (done) break; size+=value.length; if(size>limits.bytes){await reader.cancel();return null;} chunks.push(value);}
      const blob = new Blob(chunks, {type:mime});
      if (/svg/i.test(mime)) {
        const source = await blob.text(); if (/<!DOCTYPE|<!ENTITY/i.test(source)) return null;
        const svg = new win.DOMParser().parseFromString(source, 'image/svg+xml');
        svgDocument = svg;
        const dimensions = ['width','height'].map(name => svg.documentElement.getAttribute(name) || '');
        if (dimensions.some(value => !/^\d+(?:\.\d+)?(?:px)?$/.test(value)) || Number.parseFloat(dimensions[0]) > limits.width || Number.parseFloat(dimensions[1]) > limits.height || Number.parseFloat(dimensions[0])*Number.parseFloat(dimensions[1]) > limits.pixels) return null;
        // Only standalone static vector glyphs; no references, active content,
        // embedded images or network-dependent resources are rasterized.
        if (svg.querySelector('parsererror,script,foreignObject,image,use,style,filter,animate,animateTransform,animateMotion,set,discard') || Array.from(svg.querySelectorAll('*')).some(node => Array.from(node.attributes).some(a => a.name === 'style' || /^on/i.test(a.name) || /href$/i.test(a.name) || /url\s*\(/i.test(a.value.replace(/url\(\s*(['"]?)#[\w-]+\1\s*\)/g,''))))) return null;
        // Chromium's createImageBitmap(Blob) does not decode SVG on all builds.
        // Image mode keeps scripts/external document access disabled.
        objectURL = win.URL.createObjectURL(blob); bitmap = new win.Image(); bitmap.src = objectURL; await bitmap.decode();
      } else {
        bitmap = await win.createImageBitmap(blob);
      }
      if (bitmap.width > limits.width || bitmap.height > limits.height || bitmap.width * bitmap.height > limits.pixels) return null;
      const canvas = doc.createElement('canvas'); canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx = canvas.getContext('2d', {willReadFrequently:true}); if(!ctx)return null;
      ctx.drawImage(bitmap,0,0);
      // 빠른 길(Rust → WebAssembly)이 준비됐으면 그걸 쓰고, 아니면 예전 자바스크립트 계산을 써요. 결과는 같아요.
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
      const fast=repairIconPixelsWasm(pixels.data,canvas.width,canvas.height,bg,limits);
      const repaired=fast===undefined?repairIconPixels(pixels.data,canvas.width,canvas.height,bg,limits):fast;
      if(!repaired)return null;
      pixels.data.set(repaired);ctx.putImageData(pixels,0,0);
      let result;
      if (svgDocument) {
        // Preserve vector geometry/alpha exactly: only explicit neutral paint
        // attributes change. Rasterization above is eligibility analysis only.
        let count = 0;
        for (const node of svgDocument.querySelectorAll('*')) for (const attr of ['fill','stroke']) {
          // Definitions/masks affect geometry or alpha, not visible paint.
          // Preserve their exact values even when a mask uses neutral black.
          if (node.closest('defs,mask,clipPath,pattern,linearGradient,radialGradient')) continue;
          // Ancestor paint can be inherited by a mask even when its own nodes have no fill.
          if (node.querySelector('mask')) continue;
          const value = node.getAttribute(attr); if (!value) continue;
          const hex = value.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
          const digits = hex && (hex[1].length === 3 ? [...hex[1]].map(v=>v+v).join('') : hex[1]);
          const neutralName = {black:0,white:255,gray:128,grey:128,silver:192,darkgray:169,darkgrey:169,lightgray:211,lightgrey:211}[value.trim().toLowerCase()];
          const color = digits ? [parseInt(digits.slice(0,2),16),parseInt(digits.slice(2,4),16),parseInt(digits.slice(4,6),16),1] : neutralName != null ? [neutralName,neutralName,neutralName,1] : parseColor(value);
          if (!color || Math.max(...color.slice(0,3))-Math.min(...color.slice(0,3)) > 25) continue;
          const next = readableColor(color,bg,4.5);if(next){node.setAttribute(attr,next);count++;}
        }
        if (!count) return null;
        const text = new win.XMLSerializer().serializeToString(svgDocument);
        const bytes = new TextEncoder().encode(text); let binary = '';
        for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
        result = 'data:image/svg+xml;base64,' + win.btoa(binary);
      } else result=canvas.toDataURL('image/png');
      // If page CSP disallows data images, keep the original visible asset.
      await new Promise((resolve,reject)=>{const image=new win.Image();image.onload=resolve;image.onerror=reject;image.src=result;});
      return result;
    } catch {return null;} finally {bitmap?.close?.();if(objectURL)win.URL.revokeObjectURL(objectURL);win.clearTimeout(timer);aborts.delete(controller);}
  };
  const inspect = el => {
    if (!active || !el.isConnected || el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return;
    if (el.tagName !== 'IMG') inspectSvgIcon(el);
    // Bitmap repair below still needs a fully visible element.
    if (Number(win.getComputedStyle(el).opacity) < .99) return;
    const old=records.get(el);
    if (el.closest('[hidden],[inert],[aria-hidden="true"],[disabled],[aria-disabled="true"],[contenteditable],[data-bong-contrast-ignore],.a3s,.ii,[data-message-id]')) {if(old)restore(el);return;}
    const control = el.closest('button,a,[role="button"]');
    const image = el.tagName === 'IMG';
    const searchControl = !control && /^(SPAN|I)$/.test(el.tagName) && el.parentElement?.children.length <= 2 && el.parentElement?.parentElement?.querySelector('input[type="search"],input[type="text"],input:not([type])');
    if (!image && !control && !searchControl) return;
    const bg=backdrop(el);
    if (old && old.written === el.style.getPropertyValue(old.property) && old.signature === signature(el) && bg && old.background === bg.join(',')) return;
    if (old) restore(el);
    const rect=el.getBoundingClientRect();
    // A site's brand mark (logo class/id/alt/file name) may be larger than an icon:
    // a dark logo on a transparent PNG/SVG disappears on a dark header.
    const logo=image && rect.width<=480 && rect.height<=140 && rect.width/Math.max(rect.height,1)>=1.2 && (/logo|로고/i.test(el.alt||'') || /logo/i.test(el.currentSrc||'') || Boolean(el.closest('[class*="logo" i],[id*="logo" i]')));
    if(rect.width<4||rect.height<4||(!logo&&(rect.width>160||rect.height>64))||rect.bottom<0||rect.top>win.innerHeight||rect.right<0||rect.left>win.innerWidth)return;
    // Standalone logos must be short, wide, labelled glyph assets. Square
    // images require a genuine control; product photos remain original.
    if(image && !control && !logo && (rect.height>40 || rect.width/rect.height<1.4 || !el.alt?.trim()))return;
    const style=win.getComputedStyle(el);
    if(style.filter!=='none'||style.visibility!=='visible'||Number(style.opacity)<.99)return;
    const property=image?'content':'background-image';
    if(image && (el.style.getPropertyValue('content') || style.content!=='normal'))return;
    const originalImage=image?el.currentSrc:style.backgroundImage, originalSignature=signature(el);
    const match=image?[null,originalImage]:originalImage.match(/^url\(["']?((?:https?:|data:image\/)[^"']+?)["']?\)$/);
    if(!match || !match[1])return;
    let url;try{url=new URL(match[1]);if(url.username||url.password)return;
      if(url.protocol==='data:'){if(url.href.length>174764||!/^data:image\/(?:svg\+xml|png|webp)(?:;[^,]*)?,/i.test(url.href))return;}
      else if(!/^https?:$/.test(url.protocol))return;
    }catch{return;}
    if(!bg||contrastRatio([255,255,255,1],bg)<4.5)return;
    const key=url.href+'|'+bg.slice(0,3).map(Math.round).join(',');
    const apply=result=>{
      if(!active||!result||!el.isConnected||(image?el.currentSrc:win.getComputedStyle(el).backgroundImage)!==originalImage||signature(el)!==originalSignature||el.closest('[hidden],[inert],[aria-hidden="true"],[disabled],[aria-disabled="true"]')||backdrop(el)?.join(',')!==bg.join(','))return;
      const record={property,background:bg.join(','),value:el.style.getPropertyValue(property),priority:el.style.getPropertyPriority(property),marker:el.getAttribute('data-bong-icon-owned'),signature:signature(el),written:''};
      el.setAttribute('data-bong-icon-owned','1');el.style.setProperty(property,`url("${result}")`,'important');record.written=el.style.getPropertyValue(property);
      records.set(el,record);refs.add(new WeakRef(el));
    };
    if(cache.has(key)){const cached=cache.get(key);if(typeof cached==='string')apply(cached);return;}
    if(pending>=2||cache.size>=48)return;
    cache.set(key,null);pending++;const token=generation;
    void decode(url.href,bg,logo?LOGO_LIMITS:ICON_LIMITS).then(result=>{
      if(token!==generation)return;
      cache.set(key,result);apply(result);onSettled();
    }).finally(()=>{pending--;if(active)onSettled();});
  };
  return {
    inspect,
    start(){active=true;},
    stop(){active=false;generation++;for(const controller of aborts)controller.abort();for(const ref of refs){const el=ref.deref();if(el){restore(el);const r=svgRecords.get(el);if(r&&el.getAttribute(svgMarker)===r.token)el.removeAttribute(svgMarker);}}refs.clear();cache.clear();svgRecords.clear();svgSheet?.remove();svgSheet=null;}
  };
}
