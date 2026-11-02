// 키 없는 환율표로 금액을 바꾼다. 표는 기준 통화 1이 다른 통화로 얼마인지다.

export const FX_URL = "https://latest.currency-api.pages.dev/v1/currencies/krw.min.json";
export const FX_CACHE_MS = 12 * 60 * 60 * 1000;

export const FX_NAMES = {
    krw: "대한민국 원",
    usd: "미국 달러",
    eur: "유로",
    jpy: "일본 엔",
    cny: "중국 위안",
    gbp: "영국 파운드",
    aud: "호주 달러",
    cad: "캐나다 달러",
    chf: "스위스 프랑",
    hkd: "홍콩 달러",
    sgd: "싱가포르 달러",
    twd: "대만 달러",
    thb: "태국 바트",
    vnd: "베트남 동",
    inr: "인도 루피",
    btc: "비트코인",
    eth: "이더리움"
};

export const COMMON_CODES = ["krw", "usd", "eur", "jpy", "cny", "gbp", "btc", "eth"];

export const currencyLabel = (code) => {
    const id = String(code || "").toLowerCase();
    const name = FX_NAMES[id];
    return name ? `${name} (${id.toUpperCase()})` : id.toUpperCase();
};

export const withBase = (base, rates) => {
    const table = {...(rates || {})};
    const key = String(base || "").toLowerCase();
    if (key && table[key] == null) table[key] = 1;
    return table;
};

export const convertAmount = (amount, from, to, rates) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return null;
    const table = rates || {};
    const left = table[String(from || "").toLowerCase()];
    const right = table[String(to || "").toLowerCase()];
    if (!left || !right) return null;
    return value * right / left;
};

export const formatMoney = (amount, code) => {
    if (amount == null || !Number.isFinite(amount)) return "";
    const id = String(code || "").toLowerCase();
    const digits = id === "btc" || id === "eth" ? 8 : (id === "jpy" || id === "krw" || id === "vnd" ? 0 : 2);
    return new Intl.NumberFormat("ko-KR", {maximumFractionDigits: digits, minimumFractionDigits: 0}).format(amount);
};

const FAVORITE_CODE = /^[a-z0-9]{2,12}$/;

export const favoriteCurrencyId = (code) => `c:${String(code || "").toLowerCase()}`;

export const favoritePairId = (from, to) => `p:${String(from || "").toLowerCase()}>${String(to || "").toLowerCase()}`;

export const parseFavoriteId = (id) => {
    const text = String(id || "");
    if (text.startsWith("c:")) {
        const code = text.slice(2);
        return FAVORITE_CODE.test(code) ? {kind: "currency", code} : null;
    }
    if (text.startsWith("p:")) {
        const [from, to] = text.slice(2).split(">");
        if (FAVORITE_CODE.test(from || "") && FAVORITE_CODE.test(to || "") && from !== to) return {kind: "pair", from, to};
    }
    return null;
};

export const normalizeFavorites = (raw) => {
    const order = [];
    const seen = new Set();
    const push = (id) => {
        const text = String(id || "");
        if (!parseFavoriteId(text) || seen.has(text)) return;
        seen.add(text);
        order.push(text);
    };
    if (Array.isArray(raw?.order)) raw.order.forEach(push);
    if (Array.isArray(raw?.currencies)) raw.currencies.forEach((code) => push(favoriteCurrencyId(code)));
    if (Array.isArray(raw?.pairs)) raw.pairs.forEach((pair) => push(favoritePairId(pair?.from, pair?.to)));
    return {order};
};

export const toggleFavorite = (raw, id) => {
    const fav = normalizeFavorites(raw);
    const text = String(id || "");
    if (!parseFavoriteId(text)) return fav;
    const order = fav.order.includes(text) ? fav.order.filter((item) => item !== text) : [...fav.order, text];
    return {order};
};

export const reorderFavorites = (raw, fromIndex, toIndex) => {
    const fav = normalizeFavorites(raw);
    const order = [...fav.order];
    if (fromIndex < 0 || fromIndex >= order.length) return fav;
    const clamped = Math.max(0, Math.min(order.length - 1, toIndex));
    const [item] = order.splice(fromIndex, 1);
    order.splice(clamped, 0, item);
    return {order};
};

export const pinFavoriteCodes = (codes, favorites) => {
    const fav = normalizeFavorites(favorites);
    const have = new Set(codes || []);
    const pinned = fav.order
        .map(parseFavoriteId)
        .filter((item) => item?.kind === "currency" && have.has(item.code))
        .map((item) => item.code);
    return [...pinned, ...(codes || []).filter((code) => !pinned.includes(code))];
};

export const isCacheFresh = (savedAt, now = Date.now(), maxAge = FX_CACHE_MS) => {
    const time = Number(savedAt) || 0;
    return time > 0 && now - time < maxAge;
};

export const parseRatePayload = (payload) => {
    if (!payload || typeof payload !== "object") return null;
    const base = Object.keys(payload).find((key) => key !== "date" && payload[key] && typeof payload[key] === "object");
    if (!base) return null;
    return {base, date: payload.date || "", rates: withBase(base, payload[base]), fetchedAt: Date.now()};
};
