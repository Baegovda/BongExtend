import {parseColor, contrastRatio, composite, readableColor} from './contrast.js';

// Only small transparent bitmap controls are eligible. Decode locally, preserve
// every saturated pixel and alpha value, and never send page data to a service.
export function repairIconPixels(data, width, height, background) {
  if (!width || !height || width > 512 || height > 256 || width * height > 65536) return null;
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
    const next = parseColor(readableColor(color, background, 4.5));
    if (!next) continue;
    out[i] = next[0]; out[i+1] = next[1]; out[i+2] = next[2]; changed++;
  }
  return changed >= 8 ? out : null;
}

export function createIconContrastController(doc = document, onSettled = () => {}, {fetchImage} = {}) {
  const win = doc.defaultView, cache = new Map(), records = new WeakMap(), refs = new Set(), aborts = new Set();
  let active = false, generation = 0, pending = 0;
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
  const decode = async (url, bg) => {
    const controller = new AbortController(); aborts.add(controller);
    const timer = win.setTimeout(()=>controller.abort(), 3000);
    let bitmap, objectURL, svgDocument;
    try {
      const response = await (fetchImage || win.fetch.bind(win))(url, {credentials:'omit', redirect:'error', signal:controller.signal});
      const mime = (response.headers.get('content-type') || '').split(';')[0];
      if (!response.ok || !/^image\/(png|webp|svg\+xml)$/i.test(mime)) return null;
      const reader = response.body?.getReader(); if (!reader) return null;
      const chunks = []; let size = 0;
      for (;;) {const {value,done}=await reader.read(); if (done) break; size+=value.length; if(size>131072){await reader.cancel();return null;} chunks.push(value);}
      const blob = new Blob(chunks, {type:mime});
      if (/svg/i.test(mime)) {
        const source = await blob.text(); if (/<!DOCTYPE|<!ENTITY/i.test(source)) return null;
        const svg = new win.DOMParser().parseFromString(source, 'image/svg+xml');
        svgDocument = svg;
        const dimensions = ['width','height'].map(name => svg.documentElement.getAttribute(name) || '');
        if (dimensions.some(value => !/^\d+(?:\.\d+)?(?:px)?$/.test(value)) || Number.parseFloat(dimensions[0]) > 512 || Number.parseFloat(dimensions[1]) > 256 || Number.parseFloat(dimensions[0])*Number.parseFloat(dimensions[1]) > 65536) return null;
        // Only standalone static vector glyphs; no references, active content,
        // embedded images or network-dependent resources are rasterized.
        if (svg.querySelector('parsererror,script,foreignObject,image,use,style,filter,animate,animateTransform,animateMotion,set,discard') || Array.from(svg.querySelectorAll('*')).some(node => Array.from(node.attributes).some(a => a.name === 'style' || /^on/i.test(a.name) || /href$/i.test(a.name) || /url\s*\(/i.test(a.value.replace(/url\(\s*(['"]?)#[\w-]+\1\s*\)/g,''))))) return null;
        // Chromium's createImageBitmap(Blob) does not decode SVG on all builds.
        // Image mode keeps scripts/external document access disabled.
        objectURL = win.URL.createObjectURL(blob); bitmap = new win.Image(); bitmap.src = objectURL; await bitmap.decode();
      } else {
        bitmap = await win.createImageBitmap(blob);
      }
      if (bitmap.width > 512 || bitmap.height > 256 || bitmap.width * bitmap.height > 65536) return null;
      const canvas = doc.createElement('canvas'); canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx = canvas.getContext('2d', {willReadFrequently:true}); if(!ctx)return null;
      ctx.drawImage(bitmap,0,0);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height), repaired=repairIconPixels(pixels.data,canvas.width,canvas.height,bg);
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
    if(rect.width<4||rect.height<4||rect.width>160||rect.height>64||rect.bottom<0||rect.top>win.innerHeight||rect.right<0||rect.left>win.innerWidth)return;
    // Standalone logos must be short, wide, labelled glyph assets. Square
    // images require a genuine control; product photos remain original.
    if(image && !control && (rect.height>40 || rect.width/rect.height<1.4 || !el.alt?.trim()))return;
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
    void decode(url.href,bg).then(result=>{
      if(token!==generation)return;
      cache.set(key,result);apply(result);onSettled();
    }).finally(()=>{pending--;if(active)onSettled();});
  };
  return {
    inspect,
    start(){active=true;},
    stop(){active=false;generation++;for(const controller of aborts)controller.abort();for(const ref of refs){const el=ref.deref();if(el)restore(el);}refs.clear();cache.clear();}
  };
}
