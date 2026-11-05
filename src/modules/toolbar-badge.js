// 툴바 아이콘 배지는 계정들의 읽지 않은 메일 합계만 보여 준다. 0이면 비운다.
import {unreadOf} from "./gmail/watch.js";

const badgeApi = () => {
    const browserApi = globalThis.browser;
    if (import.meta.env?.FIREFOX && browserApi?.browserAction) return browserApi.browserAction;
    return browserApi?.action || globalThis.chrome?.action;
};

export const toolbarBadgeText = (mail) => {
    const count = Math.max(0, Math.floor(Number(mail) || 0));
    if (count <= 0) return "";
    return count > 99 ? "99+" : String(count);
};

export const checkerPlusUnreadCount = (record) => {
    if (!record || record.value === undefined) return null;
    const count = Number(record.value);
    return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : null;
};

export const toolbarUnreadCount = (snapshot, disabled, fallback, checkerPlusCount = null) => {
    if (checkerPlusCount !== null && checkerPlusCount !== undefined) return Math.max(0, Math.floor(Number(checkerPlusCount) || 0));
    if (Array.isArray(snapshot?.accounts)) return unreadOf(snapshot.accounts, disabled);
    return Math.max(0, Math.floor(Number(fallback) || 0));
};

const readCheckerPlusUnreadCount = async () => {
    if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return null;
    try {
        const databases = await indexedDB.databases();
        if (!databases.some((database) => database.name === "MCP_DB")) return null;
        const db = await new Promise((resolve) => {
            const request = indexedDB.open("MCP_DB");
            let creating = false;
            request.onupgradeneeded = () => {
                creating = true;
                request.transaction?.abort();
            };
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                if (creating || !request.result.objectStoreNames.contains("settings")) {
                    request.result.close();
                    resolve(null);
                    return;
                }
                resolve(request.result);
            };
        });
        if (!db) return null;
        const count = await new Promise((resolve) => {
            const transaction = db.transaction("settings", "readonly");
            const request = transaction.objectStore("settings").get("unreadCount");
            request.onsuccess = () => resolve(checkerPlusUnreadCount(request.result));
            request.onerror = () => resolve(null);
            transaction.oncomplete = () => db.close();
            transaction.onerror = () => { db.close(); resolve(null); };
        });
        return count;
    } catch {
        return null;
    }
};

const clearTabBadges = async (api) => {
    const tabsApi = globalThis.chrome?.tabs || globalThis.browser?.tabs;
    if (!tabsApi?.query || !api?.setBadgeText) return;
    try {
        const tabs = await tabsApi.query({});
        await Promise.all((tabs || []).map((tab) => {
            if (tab?.id == null) return null;
            return api.setBadgeText({tabId: tab.id, text: ""}).catch(() => {});
        }));
    } catch {
        // 탭별 배지를 못 지워도 아래 공통 배지는 다시 그린다.
    }
};

export async function paintToolbarBadge(knownCheckerPlusCount = null) {
    const api = badgeApi();
    if (!api?.setBadgeText) return;
    const stored = await chrome.storage.local.get(["gmail.unread", "gmail.snapshot", "gmail.disabled", "core.modules"]);
    const modules = stored["core.modules"] && typeof stored["core.modules"] === "object" ? stored["core.modules"] : {};
    const checkerPlusCount = modules.gmail === false
        ? null
        : knownCheckerPlusCount ?? await readCheckerPlusUnreadCount();
    const unread = modules.gmail === false
        ? 0
        : toolbarUnreadCount(stored["gmail.snapshot"], stored["gmail.disabled"], stored["gmail.unread"], checkerPlusCount);
    if (Number(stored["gmail.unread"]) !== unread) await chrome.storage.local.set({"gmail.unread": unread});
    const text = toolbarBadgeText(unread);
    try {
        await clearTabBadges(api);
        await api.setBadgeText({text});
        if (!text) return;
        await api.setBadgeBackgroundColor({color: "#0f766e"});
    } catch (error) {
        console.error("툴바 배지를 바꾸지 못했어요.", error);
        return;
    }
    if (import.meta.env?.FIREFOX || !api.setBadgeTextColor) return;
    try {
        await api.setBadgeTextColor({color: "#ffffff"});
    } catch {
        // 글자색을 지원하지 않는 브라우저는 건너뛴다.
    }
}
