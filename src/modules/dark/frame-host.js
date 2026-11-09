// Chrome's matchOriginAsFallback also injects into embedded srcdoc/blank documents.
// They have no hostname, so apply their embedding site's existing settings.
export function darkFrameHost(href, embedded, ancestors = [], referrer = '') {
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.hostname.toLowerCase();
    if (!embedded || !((url.protocol === 'about:' && ['blank', 'srcdoc'].includes(url.pathname)) ||
        url.protocol === 'blob:' || url.protocol === 'data:')) return '';
    for (const origin of [...ancestors, url.origin, referrer]) {
      try {
        const parent = new URL(origin);
        if (parent.protocol === 'https:' || parent.protocol === 'http:') return parent.hostname.toLowerCase();
      } catch { /* Opaque origins do not identify a site. */ }
    }
  } catch { /* Invalid URLs do not identify a site. */ }
  return '';
}
