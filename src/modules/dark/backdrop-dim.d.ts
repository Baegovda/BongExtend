export declare const relativeLuminance: (r: number, g: number, b: number) => number;
export declare function measurePixels(data: ArrayLike<number>): {lum: number; alpha: number} | null;
export declare function singleImageUrl(value: string): string | null;
export declare const isLightBackdrop: (measure: {lum: number; alpha: number} | null | undefined) => boolean;
export declare function overlayAlpha(imageLum: number, baseLum: number, target?: number): number;
export declare function overlayValue(url: string, base: number[], alpha: number): string;
export declare function isBackdropBox(box: {tag: string; area: number; viewportArea: number; childElements: number; root: boolean}): boolean;
export declare function measureInPage(url: string, doc?: Document): Promise<{lum: number; alpha: number} | null>;
export declare function createBackdropDimmer(doc?: Document, options?: {measure?: (url: string) => Promise<{lum: number; alpha: number} | null>}): {start(): void; stop(): void; owned(): Element[]};
