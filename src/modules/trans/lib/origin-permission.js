// 항상 번역은 그 사이트 주소만 권한을 받는다. <all_urls> 는 쓰지 않는다.
export function originPermissionPattern(input) {
  if (!input || typeof input !== 'string') return '';
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (!parsed.hostname) return '';
    return `${parsed.origin}/*`;
  } catch {
    return '';
  }
}
