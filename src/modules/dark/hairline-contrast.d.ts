export function createHairlineController(doc?: Document): {
  start(): void;
  inspect(element: Element, background: number[]): void;
  stop(): void;
  stats: {inspected: number; pseudoReads: number; changed: number; owned: number; maxOwned: number; capped: number; sheetWrites: number};
};
