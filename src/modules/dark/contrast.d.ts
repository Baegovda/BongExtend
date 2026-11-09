export function parseColor(value: string): number[] | null;
export function composite(front: number[], back: number[]): number[];
export function contrastRatio(a: number[], b: number[]): number;
export function readableColor(foreground: number[], background: number[], target?: number): string | null;
export function createContrastController(doc?: Document, options?: {inspectImage?(element: Element): void}): {start(): void; update(): void; stop(): void; stats: {visited: number; measured: number; changed: number; passes: number; maxBatch: number; styleReads: number; animationReads: number}};
