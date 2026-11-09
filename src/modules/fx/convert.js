import {CURRENCY_NAMES} from './currency-names.js';
// 키 없는 환율표로 금액을 바꾼다. 표는 기준 통화 1이 다른 통화로 얼마인지다.

export const FX_URL = "https://latest.currency-api.pages.dev/v1/currencies/krw.min.json";
export const FX_CACHE_MS = 12 * 60 * 60 * 1000;
// 팝업이 열려 있는 동안의 다시 받기. 배경 배지는 알람으로, 크롬 알람은 1분보다 짧게 못 돌린다.
export const FX_POPUP_REFRESH_MS = 30 * 1000;
export const FX_BADGE_REFRESH_MS = 60 * 1000;
export const FX_ICON_CODES = ["krw", "usd", "eur", "jpy", "cny", "gbp", "aud", "cad", "chf", "hkd", "sgd", "twd", "thb", "vnd", "inr", "btc", "eth"];

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
export const FX_SELECTED_KEY = "fx.selectedCards";
export const FX_DAILY_KEY = "fx.dailyTable";
export const availableCurrencyCodes = rates => Object.entries(rates || {}).filter(([code,value])=>/^[a-z0-9_-]{1,20}$/i.test(code)&&Number.isFinite(value)&&value>0).map(([code])=>code.toLowerCase()).sort();
export const selectedCurrencyCards = (saved,codes) => {
    const available=new Set(codes || []);
    return [...new Set((Array.isArray(saved)?saved:COMMON_CODES).map(code=>String(code).toLowerCase()))].filter(code=>available.has(code));
};
export const mergeRateTables = (daily, live) => ({...live,date:daily?.date || live.date,rates:{...(daily?.rates || {}),...live.rates}});
export const currencySearchText = code => `${currencyLabel(code)} ${CURRENCY_NAMES[code] || ''}`.toLowerCase();
const koreanCurrencies = new Intl.DisplayNames(['ko'], {type:'currency'});
export const FX_ORDER_KEY = "fx.cardOrder";
export const FX_FORM_KEY = "fx.form";

const defaultFxForm = () => ({amount: "10000", from: "krw", to: "usd"});

// 금액과 고른 통화만 담는다. fx.favorites 와 fx.table, fx.cardOrder 는 여기서 읽거나 쓰지 않는다.
export const normalizeFxForm = (raw, codes) => {
    const base = defaultFxForm();
    const source = raw && typeof raw === "object" ? raw : {};
    const amountText = String(source.amount ?? "").trim();
    const amount = /^(?:\d+)(?:\.\d+)?$/.test(amountText) ? amountText : base.amount;
    const known = new Set((codes || []).map((code) => String(code || "").toLowerCase()).filter(Boolean));
    const pick = (value, fallback) => {
        const id = String(value || "").toLowerCase();
        if (!id) return fallback;
        if (known.size && !known.has(id)) return fallback;
        return id;
    };
    let from = pick(source.from, base.from);
    let to = pick(source.to, base.to);
    if (known.size && !known.has(from)) from = [...known][0] || base.from;
    if (from === to && known.size > 1) to = [...known].find((code) => code !== from) || to;
    if (known.size && !known.has(to)) to = [...known].find((code) => code !== from) || from;
    return {amount, from, to};
};

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
    if (FX_NAMES[id]) return FX_NAMES[id];
    if (/^[a-z]{3}$/.test(id)) {const name=koreanCurrencies.of(id.toUpperCase());if(name!==id.toUpperCase())return name;}
    return CURRENCY_NAMES[id] || id.toUpperCase();
};

export const CURRENCY_SYMBOLS = {
    krw: "₩", usd: "$", eur: "€", jpy: "¥", cny: "元", gbp: "£",
    aud: "A$", cad: "C$", chf: "Fr", hkd: "HK$", sgd: "S$", twd: "NT$",
    thb: "฿", vnd: "₫", inr: "₹", btc: "₿", eth: "Ξ"
};

export const currencySymbol = (code) => CURRENCY_SYMBOLS[String(code || "").toLowerCase()] || "";

export const currencyCode = (code) => {
    const id = String(code || "").trim().toLowerCase();
    return id ? id.toUpperCase() : "";
};

export const currencyLabel = (code) => {
    const id = String(code || "").toLowerCase();
    const name = currencyName(id);
    const iso = currencyCode(id);
    if (!name || name === iso) return iso;
    const symbol = currencySymbol(id);
    return symbol ? `${symbol} ${name} (${iso})` : `${name} (${iso})`;
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

// 기호 칸의 글자색. 밝은 상징색에는 어두운 글자, 어두운 상징색에는 흰 글자.
export const currencySymbolInk = (code) => {
    const hex = currencyColor(code).replace("#", "");
    const r = Number.parseInt(hex.slice(0, 2), 16) || 0;
    const g = Number.parseInt(hex.slice(2, 4), 16) || 0;
    const b = Number.parseInt(hex.slice(4, 6), 16) || 0;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1c1c1e" : "#ffffff";
};

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

export const shouldRefreshRates = (savedAt, now = Date.now(), interval = FX_POPUP_REFRESH_MS) => !isCacheFresh(savedAt, now, interval);

export const currencyIconPath = (code) => {
    const id = String(code || "").toLowerCase();
    return FX_ICON_CODES.includes(id) ? `/fx-icons/${id}.svg` : "";
};

export const parseRatePayload = (payload) => {
    if (!payload || typeof payload !== "object") return null;
    const base = Object.keys(payload).find((key) => key !== "date" && payload[key] && typeof payload[key] === "object");
    if (!base) return null;
    return {base, date: payload.date || "", rates: withBase(base, payload[base]), fetchedAt: Date.now()};
};
