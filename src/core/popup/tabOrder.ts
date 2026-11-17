// 팝업 탭 순서 순수 함수 (테스트 가능).
export const normalizeTabOrder = <T extends string>(saved: unknown, defaults: readonly T[]): T[] => {
    if (!Array.isArray(saved)) return [...defaults];
    const out: T[] = [];
    for (const id of saved) if (defaults.includes(id as T) && !out.includes(id as T)) out.push(id as T);
    for (const id of defaults) if (!out.includes(id)) out.push(id);
    return out;
};

export const moveItem = <T>(order: readonly T[], from: number, to: number): T[] => {
    const out = [...order];
    if (from < 0 || from >= out.length) return out;
    const clamped = Math.max(0, Math.min(out.length - 1, to));
    const [item] = out.splice(from, 1);
    out.splice(clamped, 0, item);
    return out;
};

// 앱 아이콘을 눌러 팝업을 열 때 먼저 보여줄 탭.
// 받는 중인 파일이 있으면 다운로더, 아니면 메일. 다른 기능이 특정 탭을 보여주려고 연 별도 창(window=1)은 저장된 탭을 따라요.
export const pickStartTab = <T extends string>(o: {
    mailSettings: boolean; windowed: boolean; saved: unknown; downloadsActive: boolean;
    modules: Record<string, boolean | undefined>; tabs: readonly T[]; fallback: T;
}): T => {
    const usable = (id: string) => o.tabs.includes(id as T) && o.modules[id] !== false;
    if (o.mailSettings) return "gmail" as T;
    if (o.windowed && typeof o.saved === "string" && o.tabs.includes(o.saved as T)) return o.saved as T;
    if (o.downloadsActive && usable("download")) return "download" as T;
    if (usable("gmail")) return "gmail" as T;
    return typeof o.saved === "string" && o.tabs.includes(o.saved as T) ? o.saved as T : o.fallback;
};
