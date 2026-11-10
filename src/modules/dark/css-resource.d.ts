export function darkStylesheetPermission(pageUrl: string, resourceUrl: string): string | null;
export function darkStylesheetOrigins(pageUrl: string, resourceUrl: string): string[] | null;
export const MAX_DARK_CSS_BYTES: number;
export function fetchDarkStylesheet(url: string, options?: {fetchImpl?: typeof fetch; signal?: AbortSignal}): Promise<string>;
