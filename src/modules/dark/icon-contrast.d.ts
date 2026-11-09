export function repairIconPixels(data: Uint8ClampedArray, width: number, height: number, background: number[]): Uint8ClampedArray | null;
export function createIconContrastController(doc?: Document, onSettled?: () => void, options?: {fetchImage?(url: string, init: RequestInit): Promise<Response>}): {inspect(element: Element): void; start(): void; stop(): void};
