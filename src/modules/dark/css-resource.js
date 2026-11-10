import {darkImageOrigins} from './image-resource.js';

// Shared public-origin validation; no implicit grants or site allowlist.
export function darkStylesheetOrigins(pageUrl, resourceUrl) {
  const origins = darkImageOrigins(pageUrl, resourceUrl);
  if (!origins) return null;
  try {return new URL(resourceUrl).pathname.toLowerCase().endsWith('.css') ? origins : null;} catch {return null;}
}

export const MAX_DARK_CSS_BYTES = 5 * 1024 * 1024;
export async function fetchDarkStylesheet(url, {fetchImpl = fetch, signal} = {}) {
  const response = await fetchImpl(url, {credentials:'omit',redirect:'error',cache:'force-cache',signal});
  if (!response.ok || (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'text/css' || Number(response.headers.get('content-length')) > MAX_DARK_CSS_BYTES) throw new Error('CSS response rejected');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Missing CSS body');
  let size = 0; const chunks = [];
  try {
    for (;;) {const {done,value} = await reader.read(); if(done)break; size += value.length; if(size > MAX_DARK_CSS_BYTES)throw new Error('CSS too large'); chunks.push(value);}
  } catch(error) {await reader.cancel().catch(()=>{});throw error;} finally {reader.releaseLock();}
  const bytes = new Uint8Array(size); let offset = 0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(bytes);
}

// Legacy site-specific permission path is retained for existing callers.
export function darkStylesheetPermission(pageUrl, resourceUrl) {
  try {
    const page = new URL(pageUrl), resource = new URL(resourceUrl);
    if (page.protocol !== 'https:' || resource.protocol !== 'https:' || resource.username || resource.password || resource.port ||
        !resource.pathname.toLowerCase().endsWith('.css')) return null;
    const within = (host, domain) => host === domain || host.endsWith(`.${domain}`);
    if (within(page.hostname, 'naver.com')) {
      if (within(resource.hostname, 'pstatic.net')) return 'https://*.pstatic.net/*';
      if (resource.hostname === 'spastatic.naver.com') return 'https://*.naver.com/*';
    }
    if (within(page.hostname, 'dcinside.com') && within(resource.hostname, 'dcinside.com')) return 'https://*.dcinside.com/*';
  } catch { /* Invalid URLs are never fetched. */ }
  return null;
}
