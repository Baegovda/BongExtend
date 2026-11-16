export const TAKEOVER_EVENT: string;
export function announceTakeover(doc: Document): void;
export function listenForTakeover(doc: Document, isOrphaned: () => boolean, retire: () => void): () => void;
export const FALLBACK_SETTLE_MS: number;
export function createFallbackSweeper(doc: Document, options: {
    isActive: () => boolean;
    onSweep?: (cleared: number) => void;
    delay?: number;
    setTimer?: (fn: () => void, ms: number) => any;
    clearTimer?: (id: any) => void;
}): {start(): void; stop(): void};
