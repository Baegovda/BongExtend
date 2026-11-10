export interface MailThemeMappers {background(color: number[], theme: object): string; foreground(color: number[], theme: object): string; border(color: number[], theme: object): string;}
export function mapMailGradient(value: string, background: MailThemeMappers['background'], theme: object): string | null;
export function createMailThemeController(root: HTMLElement, mappers: MailThemeMappers): {update(enabled: boolean, theme?: object): void; stop(): void; stats: {visited: number; writes: number; passes: number; maxBatch: number; limitHit: boolean}};
