// Only the site's known stylesheet hosts may use the background CSS connection.
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
