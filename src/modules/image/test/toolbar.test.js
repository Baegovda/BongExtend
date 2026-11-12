import assert from "node:assert/strict";
import test from "node:test";
import {fetchImageAsBase64, sniffImageMime} from "../toolbar-background.js";
import {DEFAULT_ENGINES, activeEngines, buildEngineUrl, filenameFromUrl, formatCustomEngines, imageSource, isEligibleImage, normalizeToolbarSettings, originalImageUrl, parseCustomEngines} from "../toolbar.js";

test("settings default to the toolbar on with every built-in engine, and unknown values are dropped", () => {
    const defaults = normalizeToolbarSettings(undefined);
    assert.equal(defaults.toolbar, true);
    assert.deepEqual(defaults.disabledEngines, []);
    assert.deepEqual(DEFAULT_ENGINES.map((e) => e.id), ["lens", "aliexpress", "taobao"]);
    const custom = normalizeToolbarSettings({toolbar: false, disabledEngines: ["taobao", "evil"], custom: [{name: " 내 검색 ", url: "https://x.example/s?u={url}"}, {name: "나쁨", url: "http://x.example/{url}"}, {name: "", url: "https://x/{url}"}, {name: "no placeholder", url: "https://x.example/"}], hiddenHosts: ["shop.example", "BAD HOST", 5]});
    assert.equal(custom.toolbar, false);
    assert.deepEqual(custom.disabledEngines, ["taobao"]);
    assert.deepEqual(custom.custom, [{name: "내 검색", url: "https://x.example/s?u={url}"}]);
    assert.deepEqual(custom.hiddenHosts, ["shop.example"]);
});

test("engine urls only come from https templates and http(s) images", () => {
    const lens = DEFAULT_ENGINES.find((e) => e.id === "lens");
    assert.equal(buildEngineUrl(lens.url, "https://img.example/a b.jpg?x=1&y=2"), "https://lens.google.com/uploadbyurl?url=https%3A%2F%2Fimg.example%2Fa%20b.jpg%3Fx%3D1%26y%3D2");
    assert.equal(buildEngineUrl("http://x.example/{url}", "https://a/b.jpg"), "");
    assert.equal(buildEngineUrl("javascript:alert({url})", "https://a/b.jpg"), "");
    assert.equal(buildEngineUrl(lens.url, "data:image/png;base64,AAAA"), "");
    assert.equal(buildEngineUrl(lens.url, "file:///C:/x.jpg"), "");
    assert.deepEqual(activeEngines({disabledEngines: ["aliexpress"], custom: [{name: "A", url: "https://a.example/{url}"}]}).map((e) => e.name), ["Google 렌즈", "타오바오", "A"]);
    assert.equal(activeEngines({}).find((e) => e.id === "aliexpress").site, "aliexpress");
    assert.equal(buildEngineUrl(DEFAULT_ENGINES.find((e) => e.id === "aliexpress").url, "https://a/b.jpg"), "", "site engines have no url template");
});

test("custom engine lines round-trip and bad lines are skipped", () => {
    const rows = parseCustomEngines("1688|https://s.example/img?u={url}\n잘못된 줄\nbad|http://x/{url}\n|https://x/{url}\n");
    assert.deepEqual(rows, [{name: "1688", url: "https://s.example/img?u={url}"}]);
    assert.equal(formatCustomEngines(rows), "1688|https://s.example/img?u={url}");
    assert.deepEqual(parseCustomEngines(Array.from({length: 15}, (_, i) => `n${i}|https://x.example/{url}`).join("\n")).length, 10);
});

test("only large photos get a toolbar and only http(s) sources are used", () => {
    assert.equal(isEligibleImage({width: 400, height: 300, naturalWidth: 800, naturalHeight: 600}), true);
    assert.equal(isEligibleImage({width: 100, height: 300, naturalWidth: 800, naturalHeight: 600}), false);
    assert.equal(isEligibleImage({width: 400, height: 300, naturalWidth: 90, naturalHeight: 90}), false, "tiny sprites and icons are skipped");
    assert.equal(imageSource({currentSrc: "https://a.example/x.jpg", src: "https://a.example/y.jpg"}), "https://a.example/x.jpg");
    assert.equal(imageSource({src: "data:image/gif;base64,AAA"}), "");
    assert.equal(imageSource({src: "blob:https://a.example/1"}), "");
});

test("original image urls drop known thumbnail suffixes and options", () => {
    assert.equal(originalImageUrl("https://ae01.alicdn.com/kf/Sabc123.jpg_640x640q90.jpg_.webp"), "https://ae01.alicdn.com/kf/Sabc123.jpg");
    assert.equal(originalImageUrl("https://ae01.alicdn.com/kf/Sabc123.jpg_.webp"), "https://ae01.alicdn.com/kf/Sabc123.jpg");
    assert.equal(originalImageUrl("https://shop-phinf.pstatic.net/2026/a.jpg?type=m510"), "https://shop-phinf.pstatic.net/2026/a.jpg");
    assert.equal(originalImageUrl("https://cdn.example/a.jpg?w=200&h=200&keep=1"), "https://cdn.example/a.jpg?keep=1");
    assert.equal(originalImageUrl("https://cdn.example/photo.jpg"), "https://cdn.example/photo.jpg");
    assert.equal(originalImageUrl("not a url"), "not a url");
});

test("download file names are safe and always have an image extension", () => {
    assert.equal(filenameFromUrl("https://cdn.example/path/My%20Photo.png?x=1"), "My Photo.png");
    assert.equal(filenameFromUrl("https://cdn.example/path/noext"), "noext.jpg");
    assert.equal(filenameFromUrl("https://cdn.example/"), "image.jpg");
    assert.equal(filenameFromUrl("https://cdn.example/a%2F..%2Fb:c*.webp"), "a_.._b_c_.webp");
    assert.equal(filenameFromUrl("???"), "image.jpg");
});

const fakeResponse = (status, headers, chunks) => ({
    ok: status >= 200 && status < 300, status,
    headers: {get: (name) => headers[name.toLowerCase()] ?? null},
    body: {getReader: () => { let i = 0; return {read: async () => (i < chunks.length ? {done: false, value: chunks[i++]} : {done: true}), cancel: async () => {}}; }}
});

test("image fetch returns base64 only for small http(s) images", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const ok = await fetchImageAsBase64("https://img.example/a.png", async () => fakeResponse(200, {"content-type": "image/png"}, [bytes]));
    assert.deepEqual(ok, {ok: true, mime: "image/png", data: Buffer.from(bytes).toString("base64")});
    assert.equal((await fetchImageAsBase64("file:///C:/x.png", async () => assert.fail("never fetched"))).ok, false);
    assert.equal((await fetchImageAsBase64("https://img.example/a", async () => fakeResponse(200, {"content-type": "text/html"}, [bytes]))).ok, false);
    assert.equal((await fetchImageAsBase64("https://img.example/a", async () => fakeResponse(404, {}, []))).ok, false);
    assert.equal((await fetchImageAsBase64("https://img.example/a", async () => fakeResponse(200, {"content-type": "image/jpeg", "content-length": String(50 * 1024 * 1024)}, []))).ok, false, "too big by header");
    const big = new Uint8Array(21 * 1024 * 1024);
    assert.equal((await fetchImageAsBase64("https://img.example/a", async () => fakeResponse(200, {"content-type": "image/jpeg"}, [big]))).ok, false, "too big while streaming");
});

test("octet-stream images are accepted by their content, other types still are not", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    assert.equal(sniffImageMime(jpeg), "image/jpeg");
    assert.equal(sniffImageMime(png), "image/png");
    assert.equal(sniffImageMime(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), "image/gif");
    assert.equal(sniffImageMime(new TextEncoder().encode("<html>nope</html>")), "");
    const dc = await fetchImageAsBase64("https://dcimg.example/viewimage.php?id=1", async () => fakeResponse(200, {"content-type": "application/octet-stream"}, [jpeg]));
    assert.deepEqual(dc, {ok: true, mime: "image/jpeg", data: Buffer.from(jpeg).toString("base64")});
    const none = await fetchImageAsBase64("https://img.example/a", async () => fakeResponse(200, {}, [png]));
    assert.equal(none.mime, "image/png");
    assert.equal((await fetchImageAsBase64("https://img.example/a", async () => fakeResponse(200, {"content-type": "application/octet-stream"}, [new TextEncoder().encode("<html>403</html>")]))).ok, false, "an HTML error page labelled octet-stream is rejected");
    assert.equal((await fetchImageAsBase64("https://img.example/a", async () => fakeResponse(200, {"content-type": "text/html"}, [jpeg]))).ok, false);
});
