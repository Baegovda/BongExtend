export const NATIVE_DARK_KEY: string;
export function colorLightness(value: string): [number, number] | null;
export function classifyNativeDark(samples: {backgrounds: number[]; texts: number[]}): boolean | null;
export function sampleNativeColors(doc: Document): {backgrounds: number[]; texts: number[]};
export function settleNativeCheck(result: boolean | null, darkStreak: number, state: {complete: boolean; last: boolean}): {verdict: boolean | null; streak: number};
export function startsNativeDark(value: unknown, host: string, now?: number): boolean;
export function nativeDarkSites(value: unknown, now?: number): Record<string, number>;
export function withNativeDark(value: unknown, host: string, dark: boolean, now?: number): Record<string, number>;
