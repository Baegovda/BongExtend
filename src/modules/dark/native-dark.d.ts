export const NATIVE_DARK_KEY: string;
export function colorLightness(value: string): [number, number] | null;
export function classifyNativeDark(samples: {backgrounds: number[]; texts: number[]}): boolean | null;
export function sampleNativeColors(doc: Document): {backgrounds: number[]; texts: number[]};
export function nativeDarkSites(value: unknown, now?: number): Record<string, number>;
export function withNativeDark(value: unknown, host: string, dark: boolean, now?: number): Record<string, number>;
