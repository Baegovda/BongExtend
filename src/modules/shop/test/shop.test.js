import assert from "node:assert/strict";
import test from "node:test";
import {CHECK_EVERY, MAX_PRODUCTS, SAME_PRICE_GAP, chartPath, dueForCheck, formatPrice, normalizeProducts, originalProductImage, parsePriceText, parseProductUrl, priceStats, recordPrice, safeFolderName, setWatch, watchedList} from "../shop.js";

test("recognizes AliExpress and Taobao product pages and strips tracking tails", () => {
    assert.deepEqual(parseProductUrl("https://ko.aliexpress.com/item/1005012074949594.html?spm=a2g0o.productlist&pdp_npi=4"),
        {site: "aliexpress", id: "1005012074949594", key: "aliexpress:1005012074949594", url: "https://ko.aliexpress.com/item/1005012074949594.html"});
    assert.equal(parseProductUrl("https://item.taobao.com/item.htm?spm=a21n57&id=7123456789&ns=1").url, "https://item.taobao.com/item.htm?id=7123456789");
    assert.equal(parseProductUrl("https://item.taobao.com/item.htm?id=7123456789&skuId=55").url, "https://item.taobao.com/item.htm?id=7123456789&skuId=55");
    assert.equal(parseProductUrl("https://detail.tmall.com/item.htm?id=1012705556814"), null, "Tmall is not supported");
    assert.equal(parseProductUrl("https://ko.aliexpress.com/w/wholesale-phone.html"), null);
    assert.equal(parseProductUrl("http://item.taobao.com/item.htm?id=7123456789"), null);
    assert.equal(parseProductUrl("https://evil.example/item/1005012074949594.html"), null);
});

test("reads prices from shop texts and prefers the number after a currency sign", () => {
    assert.deepEqual(parsePriceText("₩1,503"), {amount: 1503, currency: "KRW"});
    assert.deepEqual(parsePriceText("店铺优惠后 ￥ 4.4 起"), {amount: 4.4, currency: "CNY"});
    assert.deepEqual(parsePriceText("88VIP价 ￥12.90"), {amount: 12.9, currency: "CNY"});
    assert.deepEqual(parsePriceText("1503.", "KRW"), {amount: 1503, currency: "KRW"});
    assert.deepEqual(parsePriceText("US $3.25"), {amount: 3.25, currency: "USD"});
    assert.equal(parsePriceText("가격 없음"), null);
    assert.equal(parsePriceText("₩0"), null);
    assert.equal(formatPrice(1503, "KRW"), "₩1,503");
    assert.equal(formatPrice(4.4, "CNY"), "¥4.40");
});

test("records a point when the price changes or half a day passed, and reports drops", () => {
    const url = "https://ko.aliexpress.com/item/1005012074949594.html";
    const t = 1_800_000_000_000;
    let r = recordPrice(undefined, {url, title: " 케이스 ", image: "https://ae-pic-a1.aliexpress-media.com/kf/a.jpg", price: 1503, currency: "KRW"}, t);
    assert.equal(r.product.title, "케이스");
    assert.deepEqual(r.product.points, [[t, 1503]]);
    r = recordPrice(r.products, {url, price: 1503, currency: "KRW"}, t + 1000);
    assert.equal(r.product.points.length, 1, "same price soon after: no new point");
    r = recordPrice(r.products, {url, price: 1503, currency: "KRW"}, t + SAME_PRICE_GAP);
    assert.equal(r.product.points.length, 2);
    r = recordPrice(r.products, {url, price: 1371, currency: "KRW"}, t + SAME_PRICE_GAP + 5);
    assert.equal(r.dropped, true);
    assert.equal(r.previous, 1503);
    assert.deepEqual(priceStats(r.product.points), {current: 1371, low: 1371, lowAt: t + SAME_PRICE_GAP + 5, high: 1503, highAt: t, first: t, count: 3});
    r = recordPrice(r.products, {url, price: 3, currency: "USD"}, t + SAME_PRICE_GAP + 10);
    assert.deepEqual(r.product.points, [[t + SAME_PRICE_GAP + 10, 3]], "a currency switch starts a new history");
    assert.equal(recordPrice(r.products, {url: "https://example.com/x", price: 3}).product, null);
});

test("watch list, due checks and trimming keep watched items", () => {
    const t = 1_800_000_000_000;
    let products = {};
    for (let i = 0; i < MAX_PRODUCTS + 5; i++) products = recordPrice(products, {url: `https://item.taobao.com/item.htm?id=${7000000 + i}`, price: 10 + i, currency: "CNY"}, t + i).products;
    assert.equal(Object.keys(products).length, MAX_PRODUCTS);
    assert.ok(!products["taobao:7000000"] && products[`taobao:${7000000 + MAX_PRODUCTS + 4}`], "oldest seen goes first");
    products = setWatch(products, "taobao:7000010", true, t + 9999);
    assert.equal(products["taobao:7000010"].watchPrice, 20);
    for (let i = 0; i < 20; i++) products = recordPrice(products, {url: `https://item.taobao.com/item.htm?id=${8000000 + i}`, price: 1, currency: "CNY"}, t + 20000 + i).products;
    assert.ok(products["taobao:7000010"], "watched items are never trimmed");
    assert.deepEqual(dueForCheck(products, t + 10 + CHECK_EVERY - 1).map((d) => d.key), []);
    assert.deepEqual(dueForCheck(products, t + 10 + CHECK_EVERY).map((d) => d.key), ["taobao:7000010"]);
    assert.equal(watchedList(products)[0].stats.current, 20);
    assert.deepEqual(normalizeProducts({"bad:1": {}, "aliexpress:123": {points: [[1, 2]]}, "taobao:1234567": {points: [[2, -1], ["x", 3]]}}), {
        "taobao:1234567": {site: "taobao", id: "1234567", title: "", image: "", url: "", currency: "", points: [], watch: false, watchedAt: 0, watchPrice: 0, seenAt: 0, checkedAt: 0}
    });
});

test("draws a step chart and cleans image addresses and folder names", () => {
    const chart = chartPath([[0, 10], [50, 5]], 104, 24, 100, 2);
    assert.equal(chart.line, "M2,2H52V22H102");
    assert.equal(chart.area, "M2,2H52V22H102V24H2Z");
    assert.equal(chartPath([], 10, 10).line, "");
    assert.equal(chartPath([[0, 7]], 10, 10, 10, 0).line, "M0,5H10", "a single price is a flat line in the middle");
    assert.equal(originalProductImage("//img.alicdn.com/imgextra/i4/2200/O1CN01x_!!2200.jpg_q50.jpg_.webp"), "https://img.alicdn.com/imgextra/i4/2200/O1CN01x_!!2200.jpg");
    assert.equal(originalProductImage("https://ae-pic-a1.aliexpress-media.com/kf/S15ee.jpg_220x220q75.jpg_.avif"), "https://ae-pic-a1.aliexpress-media.com/kf/S15ee.jpg");
    assert.equal(originalProductImage("javascript:alert(1)"), "");
    assert.equal(safeFolderName('a/b:c*?"<>|.. 케이스'), "a b c 케이스");
    assert.equal(safeFolderName(""), "상품");
});
