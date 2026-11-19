// 쇼핑: 알리익스프레스 · 타오바오 상품 가격 기록 · 관심 상품 · 가격 내림 알림의 순수 로직.
// 가격 기록은 이 PC(chrome.storage.local)에만 쌓여요. 다른 서버로 보내지 않고, 설정 내보내기에도 넣지 않아요.

export const SHOP_SETTINGS_KEY = "shop.settings";
export const SHOP_PRODUCTS_KEY = "shop.products";
export const SHOP_SCRIPT_ID = "bongextend-shop";
export const SHOP_SCRIPT_FILE = "content-scripts/shop.js";
// 사용자가 '쇼핑몰 연결 허용'을 누를 때만 요청하는 주소(기존 선택 권한 https://*/* 의 일부예요).
export const SHOP_ORIGINS = ["https://*.aliexpress.com/*", "https://*.taobao.com/*"];
export const SHOP_MATCHES = ["https://*.aliexpress.com/item/*", "https://*.taobao.com/item.htm*"];

export const MAX_PRODUCTS = 400;
export const MAX_POINTS = 180;
// 같은 가격이면 이 시간이 지났을 때만 점을 하나 더 찍어요(그래프 끝을 오늘까지 이어요).
export const SAME_PRICE_GAP = 12 * 60 * 60 * 1000;
// 관심 상품 가격 확인 간격.
export const CHECK_EVERY = 6 * 60 * 60 * 1000;

export const SITE_NAMES = {aliexpress: "알리익스프레스", taobao: "타오바오"};

export const normalizeShopSettings = (value) => ({
    panel: value?.panel !== false,
    alerts: value?.alerts !== false,
    open: value?.open === true
});

// 상품 주소 → {site, id, key, url(깨끗한 주소)}. 상품 페이지가 아니면 null.
export function parseProductUrl(value) {
    let url;
    try { url = new URL(String(value || "")); } catch { return null; }
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const ali = host === "aliexpress.com" || host.endsWith(".aliexpress.com");
    if (ali) {
        const match = url.pathname.match(/^\/item\/(\d{6,20})\.html$/);
        if (!match) return null;
        // 언어별 주소(ko., www., ja. …)는 그대로 두고 추적용 꼬리(spm, pdp 등)만 떼요.
        return {site: "aliexpress", id: match[1], key: `aliexpress:${match[1]}`, url: `https://${host}/item/${match[1]}.html`};
    }
    if (host.endsWith(".taobao.com") && url.pathname === "/item.htm") {
        const id = url.searchParams.get("id");
        if (!id || !/^\d{6,20}$/.test(id)) return null;
        // 고른 옵션(skuId)은 가격이 달라서 남겨 둬요.
        const sku = url.searchParams.get("skuId");
        return {site: "taobao", id, key: `taobao:${id}`, url: `https://item.taobao.com/item.htm?id=${id}${sku && /^\d{1,20}$/.test(sku) ? `&skuId=${sku}` : ""}`};
    }
    return null;
}

const CURRENCY_SIGNS = [["₩", "KRW"], ["원", "KRW"], ["KRW", "KRW"], ["￥", "CNY"], ["¥", "CNY"], ["CN¥", "CNY"], ["US$", "USD"], ["$", "USD"], ["€", "EUR"], ["£", "GBP"]];

// "₩1,503", "店铺优惠后 ￥ 4.4 起", "US $3.25" → {amount, currency}. 숫자가 없으면 null.
export function parsePriceText(text, fallbackCurrency = "") {
    const value = String(text || "").replace(/\s+/g, " ");
    // 통화 기호 바로 뒤 숫자를 먼저 봐요("88VIP ￥4.4"에서 88을 집지 않게).
    const number = "(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{1,2}))?";
    const match = value.match(new RegExp(`(?:₩|￥|¥|\\$|€|£|KRW|CNY|USD)\\s?${number}`)) || value.match(new RegExp(number));
    if (!match) return null;
    const amount = Number(match[1].replace(/[,\s]/g, "") + (match[2] ? `.${match[2]}` : ""));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    let currency = fallbackCurrency;
    for (const [sign, code] of CURRENCY_SIGNS) if (value.includes(sign)) { currency = code; break; }
    return {amount, currency};
}

// amount.toLocaleString("ko-KR", 옵션) 과 같은 표기기를 자릿수마다 한 번만 만들어요(매번 만들면 크롬에서 약 11µs).
const PRICE_FORMATS = new Map();
const priceFormat = (digits) => {
    let format = PRICE_FORMATS.get(digits);
    if (!format) PRICE_FORMATS.set(digits, (format = new Intl.NumberFormat("ko-KR", {minimumFractionDigits: digits, maximumFractionDigits: digits})));
    return format;
};

export const formatPrice = (amount, currency) => {
    if (!Number.isFinite(amount)) return "";
    const digits = currency === "KRW" || currency === "JPY" ? 0 : 2;
    const number = priceFormat(digits).format(amount);
    const sign = {KRW: "₩", CNY: "¥", USD: "$", EUR: "€", GBP: "£"}[currency];
    return sign ? `${sign}${number}` : `${number}${currency ? ` ${currency}` : ""}`;
};

const cleanText = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const httpsOnly = (value) => /^https:\/\/[^\s"'<>]+$/i.test(String(value || "")) ? String(value).slice(0, 600) : "";

const normalizeProduct = (key, row) => {
    if (!row || typeof row !== "object" || !/^(aliexpress|taobao):\d{6,20}$/.test(key)) return null;
    const points = (Array.isArray(row.points) ? row.points : [])
        .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > 0)
        .sort((a, b) => a[0] - b[0])
        .slice(-MAX_POINTS)
        .map((p) => [p[0], p[1]]);
    return {
        site: key.split(":")[0],
        id: key.split(":")[1],
        title: cleanText(row.title, 200),
        image: httpsOnly(row.image),
        url: httpsOnly(row.url),
        currency: /^[A-Z]{3}$/.test(row.currency) ? row.currency : "",
        points,
        watch: row.watch === true,
        watchedAt: Number.isFinite(row.watchedAt) ? row.watchedAt : 0,
        watchPrice: Number.isFinite(row.watchPrice) ? row.watchPrice : 0,
        seenAt: Number.isFinite(row.seenAt) ? row.seenAt : (points.at(-1)?.[0] || 0),
        checkedAt: Number.isFinite(row.checkedAt) ? row.checkedAt : 0
    };
};

export function normalizeProducts(value) {
    const out = {};
    if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [key, row] of Object.entries(value)) {
            const product = normalizeProduct(key, row);
            if (product) out[key] = product;
        }
    }
    return out;
}

// 오래 안 본 상품부터 지워요. 관심 상품은 지우지 않아요.
const trimProducts = (products) => {
    const keys = Object.keys(products);
    if (keys.length <= MAX_PRODUCTS) return products;
    const removable = keys.filter((key) => !products[key].watch).sort((a, b) => products[a].seenAt - products[b].seenAt);
    for (const key of removable.slice(0, keys.length - MAX_PRODUCTS)) delete products[key];
    return products;
};

// 가격 하나를 기록해요. 돌려주는 값: {products, product, previous(직전 가격), dropped(내렸는지)}.
export function recordPrice(value, info, now = Date.now()) {
    const products = normalizeProducts(value);
    const parsed = parseProductUrl(info?.url);
    const amount = Number(info?.price);
    if (!parsed || !Number.isFinite(amount) || amount <= 0) return {products, product: null, previous: 0, dropped: false};
    const old = products[parsed.key];
    const product = old ? {...old, points: [...old.points]} : normalizeProduct(parsed.key, {});
    product.title = cleanText(info.title, 200) || product.title;
    product.image = httpsOnly(info.image) || product.image;
    product.url = parsed.url;
    const currency = /^[A-Z]{3}$/.test(info.currency) ? info.currency : product.currency;
    // 통화가 바뀌면(사이트 언어·지역을 바꾼 경우) 서로 비교할 수 없어서 기록을 새로 시작해요.
    if (product.currency && currency && currency !== product.currency) { product.points = []; product.watchPrice = 0; }
    product.currency = currency || product.currency;
    const last = product.points.at(-1);
    const previous = last ? last[1] : 0;
    if (!last || last[1] !== amount || now - last[0] >= SAME_PRICE_GAP) product.points.push([now, amount]);
    else product.points[product.points.length - 1] = [last[0], amount];
    product.points = product.points.slice(-MAX_POINTS);
    product.seenAt = now;
    product.checkedAt = now;
    if (product.watch && !product.watchPrice) product.watchPrice = amount;
    products[parsed.key] = product;
    trimProducts(products);
    return {products, product, previous, dropped: previous > 0 && amount < previous};
}

export function setWatch(value, key, watch, now = Date.now()) {
    const products = normalizeProducts(value);
    const product = products[key];
    if (!product) return products;
    product.watch = Boolean(watch);
    product.watchedAt = watch ? now : 0;
    product.watchPrice = watch ? (product.points.at(-1)?.[1] || 0) : 0;
    return products;
}

export function removeProduct(value, key) {
    const products = normalizeProducts(value);
    delete products[key];
    return products;
}

export function priceStats(points) {
    if (!points?.length) return null;
    let low = points[0], high = points[0];
    for (const point of points) {
        if (point[1] < low[1]) low = point;
        if (point[1] > high[1]) high = point;
    }
    return {current: points.at(-1)[1], low: low[1], lowAt: low[0], high: high[1], highAt: high[0], first: points[0][0], count: points.length};
}

// 관심 상품 중 확인할 때가 된 것(오래된 순).
export function dueForCheck(value, now = Date.now(), every = CHECK_EVERY) {
    const products = normalizeProducts(value);
    return Object.entries(products)
        .filter(([, product]) => product.watch && product.url && now - product.checkedAt >= every)
        .sort((a, b) => a[1].checkedAt - b[1].checkedAt)
        .map(([key, product]) => ({key, url: product.url, site: product.site, checkedAt: product.checkedAt}));
}

export const watchedList = (value) => Object.entries(normalizeProducts(value))
    .filter(([, product]) => product.watch)
    .sort((a, b) => b[1].watchedAt - a[1].watchedAt)
    .map(([key, product]) => ({key, ...product, stats: priceStats(product.points)}));

// 계단식 가격 그래프의 SVG 경로. 가격은 다음 기록 전까지 그대로라서 계단 모양이 맞아요.
export function chartPath(points, width, height, now = Date.now(), pad = 4) {
    if (!points?.length) return {line: "", area: "", dots: []};
    const start = points[0][0];
    const end = Math.max(now, points.at(-1)[0], start + 1);
    const prices = points.map((p) => p[1]);
    const min = Math.min(...prices), max = Math.max(...prices);
    const span = max - min || 1;
    const x = (t) => pad + ((t - start) / (end - start)) * (width - pad * 2);
    const y = (v) => max === min ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2);
    const round = (n) => Math.round(n * 10) / 10;
    let line = `M${round(x(points[0][0]))},${round(y(points[0][1]))}`;
    for (let i = 1; i < points.length; i++) line += `H${round(x(points[i][0]))}V${round(y(points[i][1]))}`;
    line += `H${round(x(end))}`;
    const area = `${line}V${height}H${round(x(points[0][0]))}Z`;
    const dots = points.map((p) => ({x: round(x(p[0])), y: round(y(p[1])), price: p[1], at: p[0]}));
    return {line, area, dots, min, max};
}

// 사진 주소를 원본 크기로: 알리 "…jpg_220x220q75.jpg_.avif", 타오바오 "…jpg_q50.jpg_.webp" 꼬리를 떼요.
export function originalProductImage(value) {
    const text = String(value || "").trim();
    let url;
    try { url = new URL(text.startsWith("//") ? `https:${text}` : text); } catch { return ""; }
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.protocol = "https:";
    url.pathname = url.pathname.replace(/\.(jpe?g|png|webp|gif)_[^/]*$/i, ".$1");
    url.search = "";
    url.hash = "";
    return url.href;
}

export const safeFolderName = (value) => cleanText(value, 60).replace(/[\\/:*?"<>|~.]+/g, " ").replace(/\s+/g, " ").trim() || "상품";
