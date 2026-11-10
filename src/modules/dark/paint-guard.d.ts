export function createPaintGuard(doc?: Document): {prepare(): boolean; start(): void; stop(): void};

export function createImageBlendGuard(doc?: Document): {inspect(el: Element, background: number[] | null): void; stop(): void};
