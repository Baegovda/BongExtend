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
