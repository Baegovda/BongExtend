export function parseColor(value: string): number[] | null;
export function composite(front: number[], back: number[]): number[];
export function contrastRatio(a: number[], b: number[]): number;
export function readableColor(foreground: number[], background: number[], target?: number): string | null;
export function hairlineColor(color: number[] | null, background: number[]): string | null;
export function ringShadow(shadow: string, background: number[]): string | null;
export function createContrastController(doc?: Document, options?: {inspectImage?(element: Element): void; inspectPseudo?(element: Element, background: number[]): void; inspectHairline?(element: Element, background: number[]): void; inspectPhoto?(element: Element, background: number[] | null): void}): {start(): void; update(): void; stop(): void; stats: {visited: number; measured: number; changed: number; passes: number; maxBatch: number; styleReads: number; animationReads: number}};
