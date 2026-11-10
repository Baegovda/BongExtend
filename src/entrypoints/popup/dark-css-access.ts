import {darkStylesheetOrigins} from '@/modules/dark/css-resource.js';

// Read only stylesheet addresses in the current top document, never page text,
// CSS rules, cookies or arbitrary resource URLs. No permission is granted here.
export async function missingDarkStylesheetOrigins(tabId: number, pageUrl: string): Promise<string[]> {
    try {
        const results = await chrome.scripting.executeScript({target: {tabId}, func: () => ({
            page: location.href,
            styles: Array.from(new Set([
                ...Array.from(document.styleSheets, sheet => sheet.href || ''),
                ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'), link => link.href)
            ])).filter(Boolean).slice(0, 128)
        })});
        const result = results[0]?.result;
        if (!result || new URL(result.page).origin !== new URL(pageUrl).origin) return [];
        const origins = new Set<string>();
        for (const resource of result.styles) for (const origin of darkStylesheetOrigins(result.page, resource) || []) {
            if (origin !== new URL(result.page).origin + '/*' && origins.size < 16) origins.add(origin);
        }
        const missing = await Promise.all([...origins].map(async origin => await chrome.permissions.contains({origins: [origin]}) ? null : origin));
        return missing.filter((origin): origin is string => origin !== null);
    } catch {return [];}
}
