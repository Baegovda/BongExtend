export type IconLimits = {width: number; height: number; pixels: number; bytes: number; target?: number};
export const ICON_LIMITS: IconLimits;
export const LOGO_LIMITS: IconLimits;
export function repairIconPixels(data: Uint8ClampedArray, width: number, height: number, background: number[], limits?: IconLimits): Uint8ClampedArray | null;
export function createIconContrastController(doc?: Document, onSettled?: () => void, options?: {fetchImage?(url: string, init: RequestInit): Promise<Response>}): {inspect(element: Element): void; start(): void; stop(): void};
