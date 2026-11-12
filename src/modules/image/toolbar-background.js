// 이미지 도구 막대의 백그라운드: 콘텐츠 스크립트 등록, 다운로드, 이미지 가져오기, 새 탭 열기.
// 전체 https 사이트 권한을 사용자가 허용했고 기능이 켜져 있을 때만 모든 https 페이지에 등록해요.
import {IMAGE_SETTINGS_KEY, MAX_FETCH_BYTES, TOOLBAR_SCRIPT_FILE, TOOLBAR_SCRIPT_ID, filenameFromUrl, normalizeToolbarSettings} from "./toolbar.js";

const MODULES_KEY = "core.modules";
const ALL_HTTPS = ["https://*/*"];
const isHttp = (value) => /^https?:\/\/[^\s]+$/i.test(String(value || ""));

const toBase64 = (bytes) => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
};

// 서버가 image/*가 아닌 종류(예: 디시인사이드의 application/octet-stream)로 줘도 파일 앞부분으로 이미지인지 알아봐요.
export function sniffImageMime(bytes) {
    const at = (i) => bytes[i];
    if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "image/png";
    if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
    if (bytes.length >= 6 && at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return "image/gif";
    if (bytes.length >= 12 && at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "image/webp";
    if (bytes.length >= 2 && at(0) === 0x42 && at(1) === 0x4d) return "image/bmp";
    if (bytes.length >= 12 && at(4) === 0x66 && at(5) === 0x74 && at(6) === 0x79 && at(7) === 0x70 && at(8) === 0x61 && at(9) === 0x76 && at(10) === 0x69 && at(11) === 0x66) return "image/avif";
    return "";
}

export async function fetchImageAsBase64(url, fetchImpl = fetch) {
    if (!isHttp(url)) return {ok: false, error: "주소가 올바르지 않아요."};
    const response = await fetchImpl(url, {credentials: "omit", redirect: "follow", cache: "force-cache"});
    if (!response.ok) return {ok: false, error: `응답 ${response.status}`};
    let mime = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const declaredImage = /^image\/(png|jpe?g|webp|gif|bmp|avif)$/.test(mime);
    // 이미지로 선언하지 않았으면 일반 바이너리/없음일 때만 내용으로 확인해요(HTML 같은 건 거부).
    if (!declaredImage && mime && !/^(application\/octet-stream|binary\/octet-stream|application\/x-binary)$/.test(mime)) return {ok: false, error: "이미지가 아니에요."};
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_FETCH_BYTES) return {ok: false, error: "이미지가 너무 커요."};
    const chunks = [];
    let total = 0;
    const reader = response.body.getReader();
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_FETCH_BYTES) { await reader.cancel(); return {ok: false, error: "이미지가 너무 커요."}; }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (!declaredImage) {
        mime = sniffImageMime(bytes);
        if (!mime) return {ok: false, error: "이미지가 아니에요."};
    }
    return {ok: true, mime, data: toBase64(bytes)};
}

// 사이트가 'Referer'(어느 페이지에서 왔는지)를 확인해 이미지를 막는 경우(디시인사이드 등)를 위해, 이미지 서버로 가는 요청에만 그 페이지 주소를 붙여요.
const RULE_BASE = 91000;
const RULE_SLOTS = 400;
let ruleCounter = 0;
const httpsPage = (value) => { try { const url = new URL(value); return url.protocol === "https:" ? `${url.origin}${url.pathname}${url.search}` : ""; } catch { return ""; } };

export async function withReferer(chromeApi, imageUrl, pageUrl, task, keepMs = 0) {
    const referer = httpsPage(pageUrl);
    const dnr = chromeApi.declarativeNetRequest;
    let host = "";
    try { host = new URL(imageUrl).hostname; } catch { host = ""; }
    if (!referer || !host || !dnr?.updateSessionRules) return task();
    const id = RULE_BASE + (ruleCounter++ % RULE_SLOTS);
    await dnr.updateSessionRules({
        removeRuleIds: [id],
        addRules: [{id, priority: 1, action: {type: "modifyHeaders", requestHeaders: [{header: "referer", operation: "set", value: referer}]},
            condition: {requestDomains: [host], resourceTypes: ["main_frame", "xmlhttprequest", "other", "image", "media"]}}]
    });
    const remove = () => dnr.updateSessionRules({removeRuleIds: [id]}).catch(() => {});
    try { return await task(); }
    finally { if (keepMs > 0) setTimeout(remove, keepMs); else await remove(); }
}

const SITE_START = {aliexpress: "https://ko.aliexpress.com/", taobao: "https://www.taobao.com/"};

// 사이트 안에서 실행돼요(직렬화되므로 바깥 값을 쓰지 않아요): 그 사이트의 '이미지로 검색'에 사진을 넣고 검색까지 눌러요.
export async function siteUploadSteps(site, mime, base64) {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (find, timeout = 20000) => { const end = Date.now() + timeout; while (Date.now() < end) { const found = find(); if (found) return found; await wait(150); } return null; };
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const ext = /png/.test(mime) ? "png" : /webp/.test(mime) ? "webp" : "jpg";
    const file = new File([bytes], `image.${ext}`, {type: mime});
    const fill = (input) => {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("input", {bubbles: true}));
        input.dispatchEvent(new Event("change", {bubbles: true}));
    };
    if (site === "aliexpress") {
        const button = await until(() => document.querySelector('[class*="picture-search-btn"]'));
        if (!button) return {ok: false, error: "이미지 검색 버튼을 찾지 못했어요."};
        button.click();
        const input = await until(() => document.querySelector('input[type="file"]'));
        if (!input) return {ok: false, error: "파일 입력칸을 찾지 못했어요."};
        fill(input);
        return {ok: true};
    }
    if (site === "taobao") {
        const input = await until(() => document.querySelector('input[type="file"]'));
        if (!input) return {ok: false, error: "파일 입력칸을 찾지 못했어요."};
        fill(input);
        const search = await until(() => Array.from(document.querySelectorAll('[class*="image-search-context"] *')).find((el) => el.children.length === 0 && el.textContent.trim() === "搜索"));
        if (!search) return {ok: false, error: "검색 버튼을 찾지 못했어요."};
        (search.closest("button") || search).click();
        return {ok: true};
    }
    return {ok: false, error: "지원하지 않는 사이트예요."};
}

export function startImageToolbarBackground(chromeApi = chrome) {
    // 지난 실행에서 남은 임시 규칙 정리
    try { chromeApi.declarativeNetRequest?.updateSessionRules?.({removeRuleIds: Array.from({length: RULE_SLOTS}, (_, i) => RULE_BASE + i)}).catch?.(() => {}); } catch { /* 지원하지 않으면 건너뛰어요. */ }
    const waitForTab = (tabId, timeout = 15000) => new Promise((resolve) => {
        const finish = () => { chromeApi.tabs.onUpdated.removeListener(listener); clearTimeout(timer); resolve(); };
        const listener = (id, change) => { if (id === tabId && change.status === "complete") finish(); };
        const timer = setTimeout(finish, timeout);
        chromeApi.tabs.onUpdated.addListener(listener);
        chromeApi.tabs.get(tabId).then((tab) => { if (tab.status === "complete") finish(); }).catch(finish);
    });

    const settingsNow = async () => {
        const stored = await chromeApi.storage.local.get([IMAGE_SETTINGS_KEY, MODULES_KEY]);
        const moduleOn = stored[MODULES_KEY]?.image !== false;
        const settings = normalizeToolbarSettings(stored[IMAGE_SETTINGS_KEY]);
        return {on: moduleOn && settings.toolbar, settings};
    };

    const sync = async () => {
        try {
            const {on} = await settingsNow();
            const granted = await chromeApi.permissions.contains({origins: ALL_HTTPS});
            const registered = await chromeApi.scripting.getRegisteredContentScripts({ids: [TOOLBAR_SCRIPT_ID]});
            if (!(on && granted)) {
                if (registered.length) await chromeApi.scripting.unregisterContentScripts({ids: [TOOLBAR_SCRIPT_ID]});
                return;
            }
            // 이전 버전은 맨 위 프레임에만 등록했어요. 모든 프레임(네이버 블로그 본문 iframe 등)으로 다시 등록해요.
            if (registered.length && registered[0].allFrames !== true) {
                await chromeApi.scripting.unregisterContentScripts({ids: [TOOLBAR_SCRIPT_ID]});
                registered.length = 0;
            }
            if (!registered.length) {
                await chromeApi.scripting.registerContentScripts([{id: TOOLBAR_SCRIPT_ID, matches: ALL_HTTPS, js: [TOOLBAR_SCRIPT_FILE], allFrames: true, runAt: "document_idle", persistAcrossSessions: true}]);
            }
        } catch (error) {
            console.warn("이미지 도구 막대 등록을 갱신하지 못했어요.", error);
        }
    };
    void sync();
    chromeApi.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes[IMAGE_SETTINGS_KEY] || changes[MODULES_KEY])) void sync();
    });
    chromeApi.permissions.onAdded.addListener(() => void sync());
    chromeApi.permissions.onRemoved.addListener(() => void sync());

    chromeApi.runtime.onMessage.addListener((message, sender, reply) => {
        const type = message?.type;
        if (typeof type !== "string" || !type.startsWith("bongextend-image-")) return undefined;
        // 이 확장 프로그램이 넣은 페이지(https)에서 온 요청만 받아요.
        if (sender.id !== chromeApi.runtime.id || !Number.isInteger(sender.tab?.id) || !/^https:\/\//.test(sender.url || "")) return undefined;
        (async () => {
            const {on} = await settingsNow();
            if (!on) { reply({ok: false, error: "꺼져 있어요."}); return; }
            if (type === "bongextend-image-download") {
                if (!isHttp(message.url)) { reply({ok: false}); return; }
                // downloads API는 Referer를 붙일 수 없어서, 가져온 뒤 페이지에서 파일로 저장해요(Referer가 필요한 사이트 대응).
                const image = await withReferer(chromeApi, message.url, message.pageUrl, () => fetchImageAsBase64(message.url));
                if (!image.ok) { reply(image); return; }
                reply({...image, filename: filenameFromUrl(message.url) .replace(/\.[a-z0-9]+$/i, "") + "." + ({"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/bmp": "bmp", "image/avif": "avif"}[image.mime] || "jpg")});
            } else if (type === "bongextend-image-fetch") {
                reply(await withReferer(chromeApi, message.url, message.pageUrl, () => fetchImageAsBase64(message.url)));
            } else if (type === "bongextend-image-site-search") {
                const start = SITE_START[message.site];
                if (!start || !isHttp(message.url)) { reply({ok: false, error: "지원하지 않는 검색이에요."}); return; }
                const image = await withReferer(chromeApi, message.url, message.pageUrl, () => fetchImageAsBase64(message.url));
                if (!image.ok) { reply(image); return; }
                const tab = await chromeApi.tabs.create({url: start, windowId: sender.tab.windowId, index: sender.tab.index + 1, openerTabId: sender.tab.id, active: true});
                await waitForTab(tab.id);
                const [result] = await chromeApi.scripting.executeScript({target: {tabId: tab.id}, func: siteUploadSteps, args: [message.site, image.mime, image.data]});
                reply(result?.result || {ok: false, error: "검색을 시작하지 못했어요."});
            } else if (type === "bongextend-image-open") {
                if (!isHttp(message.url)) { reply({ok: false}); return; }
                // 디시인사이드 같은 곳은 게시글 주소(Referer) 없이 이미지 주소를 바로 열면 막아요. 새 탭을 열 때만 잠깐 붙여줘요.
                await withReferer(chromeApi, message.url, message.withReferer ? (message.pageUrl || sender.tab?.url) : "", () => chromeApi.tabs.create({url: message.url, windowId: sender.tab.windowId, index: sender.tab.index + 1, openerTabId: sender.tab.id}), 10000);
                reply({ok: true});
            } else if (type === "bongextend-image-settings") {
                await chromeApi.storage.local.set({"core.popupTab": "image"});
                await chromeApi.windows.create({url: chromeApi.runtime.getURL("popup.html?window=1"), type: "popup", width: 840, height: 640});
                reply({ok: true});
            } else reply({ok: false});
        })().catch((error) => reply({ok: false, error: String(error?.message || error)}));
        return true;
    });
}
