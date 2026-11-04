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
export const FX_ORDER_KEY = "fx.cardOrder";

// 저장된 카드 순서를 앞에 두고, 없는 나라는 기본 순서대로 뒤에 붙인다.
// fx.favorites 는 읽지도 쓰지도 않는다.
export const orderCurrencyCards = (codes, saved) => {
    const list = [];
    const seen = new Set();
    const have = new Set((codes || []).map((code) => String(code || "").toLowerCase()).filter(Boolean));
    for (const raw of saved || []) {
        const code = String(raw || "").toLowerCase();
        if (!have.has(code) || seen.has(code)) continue;
        seen.add(code);
        list.push(code);
    }
    for (const raw of codes || []) {
        const code = String(raw || "").toLowerCase();
        if (!code || seen.has(code) || !have.has(code)) continue;
        seen.add(code);
        list.push(code);
    }
    return list;
};

export const currencyName = (code) => {
    const id = String(code || "").toLowerCase();
    return FX_NAMES[id] || id.toUpperCase();
};

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

// 나라(또는 자산)를 알아보는 상징색. 화면에는 이 색을 옅게 섞어서 글자 대비를 지킨다.
export const CURRENCY_COLORS = {
    krw: "#cd2e3a",
    usd: "#3c3b6e",
    eur: "#003399",
    jpy: "#bc002d",
    cny: "#de2910",
    gbp: "#012169",
    aud: "#012169",
    cad: "#c8102e",
    chf: "#da291c",
    hkd: "#de2910",
    sgd: "#ef3340",
    twd: "#000095",
    thb: "#a51931",
    vnd: "#da251d",
    inr: "#138808",
    btc: "#f7931a",
    eth: "#627eea"
};
export const CURRENCY_TINT = 0.14;

export const currencyColor = (code) => CURRENCY_COLORS[String(code || "").toLowerCase()] || "#6e6e73";

// 1달러가 몇 원인지. 표가 없으면 빈 글자.
export const fxTabBadge = (rates) => {
    const value = convertAmount(1, "usd", "krw", rates);
    if (value == null || !Number.isFinite(value) || value <= 0) return "";
    return formatMoney(value, "krw");
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
