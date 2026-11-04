import assert from "node:assert/strict";
import test from "node:test";
import {
    TV_WS_URL,
    decodeTv,
    encodeTv,
    fetchScannerPrices,
    openQuoteStream,
    quoteFromFrame,
    quoteHello,
    ratesFromQuotes
} from "../tradingview.js";
import {convertAmount, fxTabBadge} from "../convert.js";

test("a TradingView quote frame becomes a KRW table and a dollar badge", () => {
    const body = JSON.stringify({m: "qsd", p: ["qs_bex", {n: "FX_IDC:USDKRW", v: {lp: 1382.5}}]});
    const packet = `~m~${body.length}~m~${body}~h~3`;
    const frames = decodeTv(packet);
    assert.equal(frames[1].type, "heartbeat");
    assert.equal(frames[1].value, "3");
    const quote = quoteFromFrame(frames[0]);
    assert.deepEqual(quote, {symbol: "FX_IDC:USDKRW", price: 1382.5});
    const table = ratesFromQuotes({
        "FX_IDC:USDKRW": 1382.5,
        "FX_IDC:EURUSD": 1.08,
        "FX_IDC:USDJPY": 150
    }, 50);
    assert.equal(table.source, "tradingview");
    assert.equal(fxTabBadge(table.rates), "1,383");
    assert.ok(Math.abs(convertAmount(1, "eur", "krw", table.rates) - 1382.5 * 1.08) < 0.01);
    assert.ok(Math.abs(convertAmount(1, "jpy", "krw", table.rates) - 1382.5 / 150) < 0.01);
    assert.equal(ratesFromQuotes({}), null);
    const hello = quoteHello("qs_bex", ["FX_IDC:USDKRW"]);
    assert.equal(hello[3].p[1], "FX_IDC:USDKRW");
    assert.match(encodeTv(hello[0]), /^~m~\d+~m~/);
});

test("scanner prices and the quote socket stay on the fake", async () => {
    const urls = [];
    const prices = await fetchScannerPrices(async (url) => {
        urls.push(url);
        const symbol = url.includes("crypto") ? "BITSTAMP:BTCUSD" : "FX_IDC:USDKRW";
        const price = symbol.startsWith("BIT") ? 60000 : 1400;
        return {ok: true, json: async () => ({data: [{s: symbol, d: [price]}]})};
    });
    assert.deepEqual(urls, [
        "https://scanner.tradingview.com/forex/scan",
        "https://scanner.tradingview.com/crypto/scan"
    ]);
    assert.equal(prices["FX_IDC:USDKRW"], 1400);

    let seen = null;
    let socket;
    class FakeSocket {
        constructor(url) {
            this.url = url;
            this.readyState = 1;
            this.sent = [];
            socket = this;
        }
        send(data) { this.sent.push(data); }
        close() { this.readyState = 3; }
    }
    const stream = openQuoteStream({
        WebSocket: FakeSocket,
        onTable(table) { seen = table; }
    });
    assert.equal(socket.url, TV_WS_URL);
    socket.onopen();
    assert.match(socket.sent[0], /set_auth_token/);
    const quote = JSON.stringify({m: "qsd", p: ["qs_bex", {n: "FX_IDC:USDKRW", v: {lp: 1390}}]});
    socket.onmessage({data: encodeTv(JSON.parse(quote))});
    assert.equal(seen.rates.usd > 0, true);
    assert.equal(fxTabBadge(seen.rates).replace(/,/g, ""), "1390");
    socket.onmessage({data: "~h~7"});
    assert.match(socket.sent.at(-1), /~h~7/);
    stream.close();
    assert.equal(socket.readyState, 3);
});
