// 트레이딩뷰 시세. 시험은 가짜 소켓과 가짜 fetch 만 쓴다.

export const TV_WS_URL = "wss://data.tradingview.com/socket.io/websocket";
export const TV_FOREX_URL = "https://scanner.tradingview.com/forex/scan";
export const TV_CRYPTO_URL = "https://scanner.tradingview.com/crypto/scan";

// 1달러가 몇 원인지는 FX_IDC:USDKRW. 나머지는 달러 교차로 원화 표를 만든다.
export const TV_PAIRS = [
    {symbol: "FX_IDC:USDKRW", code: "usd", via: "krw-per-usd"},
    {symbol: "FX_IDC:EURUSD", code: "eur", via: "times-usd"},
    {symbol: "FX_IDC:GBPUSD", code: "gbp", via: "times-usd"},
    {symbol: "FX_IDC:AUDUSD", code: "aud", via: "times-usd"},
    {symbol: "FX_IDC:USDJPY", code: "jpy", via: "per-usd"},
    {symbol: "FX_IDC:USDCAD", code: "cad", via: "per-usd"},
    {symbol: "FX_IDC:USDCHF", code: "chf", via: "per-usd"},
    {symbol: "FX_IDC:USDCNH", code: "cny", via: "per-usd"},
    {symbol: "FX_IDC:USDHKD", code: "hkd", via: "per-usd"},
    {symbol: "FX_IDC:USDSGD", code: "sgd", via: "per-usd"},
    {symbol: "FX_IDC:USDTWD", code: "twd", via: "per-usd"},
    {symbol: "FX_IDC:USDTHB", code: "thb", via: "per-usd"},
    {symbol: "FX_IDC:USDVND", code: "vnd", via: "per-usd"},
    {symbol: "FX_IDC:USDINR", code: "inr", via: "per-usd"},
    {symbol: "BITSTAMP:BTCUSD", code: "btc", via: "times-usd"},
    {symbol: "BITSTAMP:ETHUSD", code: "eth", via: "times-usd"}
];

export const encodeTv = (payload) => {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    return `~m~${text.length}~m~${text}`;
};

export const decodeTv = (packet) => {
    const frames = [];
    const text = String(packet || "");
    let index = 0;
    while (index < text.length) {
        if (text.startsWith("~h~", index)) {
            const match = /^~h~(\d+)/.exec(text.slice(index));
            if (!match) break;
            frames.push({type: "heartbeat", value: match[1]});
            index += match[0].length;
            continue;
        }
        if (!text.startsWith("~m~", index)) break;
        const lenEnd = text.indexOf("~m~", index + 3);
        if (lenEnd < 0) break;
        const len = Number(text.slice(index + 3, lenEnd));
        if (!Number.isFinite(len) || len < 0) break;
        const bodyStart = lenEnd + 3;
        const body = text.slice(bodyStart, bodyStart + len);
        index = bodyStart + len;
        if (body.startsWith("~h~")) {
            frames.push({type: "heartbeat", value: body.slice(3)});
            continue;
        }
        try {
            frames.push({type: "message", data: JSON.parse(body)});
        } catch {
            frames.push({type: "text", data: body});
        }
    }
    return frames;
};

export const quoteFromFrame = (frame) => {
    if (!frame || frame.type !== "message" || frame.data?.m !== "qsd") return null;
    const payload = frame.data.p?.[1];
    const symbol = payload?.n;
    const price = Number(payload?.v?.lp ?? payload?.v?.close);
    if (!symbol || !Number.isFinite(price) || price <= 0) return null;
    return {symbol, price};
};

export const quoteHello = (sessionId, symbols) => [
    {m: "set_auth_token", p: ["unauthorized_user_token"]},
    {m: "quote_create_session", p: [sessionId]},
    {m: "quote_set_fields", p: [sessionId, "lp"]},
    {m: "quote_add_symbols", p: [sessionId, ...symbols, {flags: ["force_permission"]}]}
];

export const ratesFromQuotes = (prices, now = Date.now()) => {
    const krwPerUsd = Number(prices?.["FX_IDC:USDKRW"]);
    if (!Number.isFinite(krwPerUsd) || krwPerUsd <= 0) return null;
    const rates = {krw: 1, usd: 1 / krwPerUsd};
    for (const pair of TV_PAIRS) {
        if (pair.code === "usd") continue;
        const quote = Number(prices?.[pair.symbol]);
        if (!Number.isFinite(quote) || quote <= 0) continue;
        const krwPerUnit = pair.via === "times-usd" ? quote * krwPerUsd : krwPerUsd / quote;
        if (krwPerUnit > 0) rates[pair.code] = 1 / krwPerUnit;
    }
    return {base: "krw", date: "", rates, fetchedAt: now, source: "tradingview"};
};

const parseScan = (payload) => {
    const prices = {};
    for (const row of payload?.data || []) {
        const price = Number(row?.d?.[0]);
        if (row?.s && Number.isFinite(price) && price > 0) prices[row.s] = price;
    }
    return prices;
};

export async function fetchScannerPrices(fetchImpl) {
    const forex = TV_PAIRS.filter((pair) => pair.symbol.startsWith("FX_IDC:")).map((pair) => pair.symbol);
    const crypto = TV_PAIRS.filter((pair) => !pair.symbol.startsWith("FX_IDC:")).map((pair) => pair.symbol);
    const prices = {};
    const pull = async (url, tickers) => {
        const response = await fetchImpl(url, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({symbols: {tickers, query: {types: []}}, columns: ["close"]})
        });
        if (!response?.ok) throw new Error("시세 표를 받지 못했어요.");
        Object.assign(prices, parseScan(await response.json()));
    };
    await pull(TV_FOREX_URL, forex);
    await pull(TV_CRYPTO_URL, crypto);
    return prices;
}

export function openQuoteStream(deps) {
    const WS = deps.WebSocket;
    const symbols = TV_PAIRS.map((pair) => pair.symbol);
    const prices = {};
    const sessionId = deps.sessionId || "qs_bex";
    let socket;
    const send = (payload) => {
        if (socket && socket.readyState === 1) socket.send(encodeTv(payload));
    };
    const handle = (data) => {
        for (const frame of decodeTv(data)) {
            if (frame.type === "heartbeat") {
                send(`~h~${frame.value}`);
                continue;
            }
            const quote = quoteFromFrame(frame);
            if (!quote) continue;
            prices[quote.symbol] = quote.price;
            const table = ratesFromQuotes(prices, deps.now ? deps.now() : Date.now());
            if (table && deps.onTable) deps.onTable(table);
        }
    };
    socket = new WS(TV_WS_URL);
    socket.onopen = () => {
        for (const message of quoteHello(sessionId, symbols)) send(message);
    };
    socket.onmessage = (event) => handle(String(event?.data || ""));
    socket.onerror = () => { if (deps.onError) deps.onError(); };
    return {
        close() {
            try { socket.close(); } catch { /* 이미 닫힘 */ }
        }
    };
}
