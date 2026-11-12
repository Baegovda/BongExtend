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

export async function fetchImageAsBase64(url, fetchImpl = fetch) {
    if (!isHttp(url)) return {ok: false, error: "주소가 올바르지 않아요."};
    const response = await fetchImpl(url, {credentials: "omit", redirect: "follow", cache: "force-cache"});
    if (!response.ok) return {ok: false, error: `응답 ${response.status}`};
    const mime = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(png|jpe?g|webp|gif|bmp|avif)$/.test(mime)) return {ok: false, error: "이미지가 아니에요."};
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
    return {ok: true, mime, data: toBase64(bytes)};
}

export function startImageToolbarBackground(chromeApi = chrome) {
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
            if (!registered.length) {
                await chromeApi.scripting.registerContentScripts([{id: TOOLBAR_SCRIPT_ID, matches: ALL_HTTPS, js: [TOOLBAR_SCRIPT_FILE], runAt: "document_idle", persistAcrossSessions: true}]);
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
                await chromeApi.downloads.download({url: message.url, filename: filenameFromUrl(message.url), conflictAction: "uniquify", saveAs: false});
                reply({ok: true});
            } else if (type === "bongextend-image-fetch") {
                reply(await fetchImageAsBase64(message.url));
            } else if (type === "bongextend-image-open") {
                if (!isHttp(message.url)) { reply({ok: false}); return; }
                await chromeApi.tabs.create({url: message.url, windowId: sender.tab.windowId, index: sender.tab.index + 1, openerTabId: sender.tab.id});
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
