// 시세 다시 받기. 실패하면 저장해 둔 표를 그대로 둔다. 시험은 fetchImpl 만 쓴다.

import {FX_BADGE_REFRESH_MS, FX_URL, parseRatePayload, shouldRefreshRates} from "./convert.js";

const KEY = "fx.table";

export async function refreshStoredRates(deps = {}) {
    const storage = deps.storage;
    const fetchImpl = deps.fetchImpl;
    const now = deps.now || Date.now();
    const interval = deps.interval ?? FX_BADGE_REFRESH_MS;
    const stored = await storage.get(KEY);
    const cached = stored?.[KEY] || null;
    if (cached?.rates && !shouldRefreshRates(cached.fetchedAt, now, interval)) {
        return {ok: true, cached: true, table: cached};
    }
    try {
        const response = await fetchImpl(FX_URL);
        if (!response?.ok) throw new Error("표를 받지 못했어요.");
        const parsed = parseRatePayload(await response.json());
        if (!parsed?.rates) throw new Error("표 형식이 아니에요.");
        const table = {...parsed, fetchedAt: now};
        await storage.set({[KEY]: table});
        return {ok: true, cached: false, table};
    } catch (error) {
        return {
            ok: false,
            cached: true,
            table: cached,
            error: error instanceof Error ? error.message : "표를 받지 못했어요."
        };
    }
}
