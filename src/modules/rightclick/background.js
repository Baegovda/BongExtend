import {installRightClickGuard, removeRightClickGuard} from "./inject.js";
import {nextOrigins, originOf} from "./origin.js";

const KEY = "rc.origins";

const readOrigins = async () => {
    const stored = await chrome.storage.local.get(KEY);
    return Array.isArray(stored[KEY]) ? stored[KEY].filter((item) => typeof item === "string") : [];
};

const writeOrigins = async (list) => chrome.storage.local.set({[KEY]: list});

export async function applyRightClick(tabId, url, enabled, persist = true) {
    const origin = originOf(url);
    if (!origin || tabId == null) throw new Error("이 페이지에서는 오른쪽 클릭을 바꿀 수 없어요.");
    if (persist) {
        const list = nextOrigins(await readOrigins(), origin, enabled);
        await writeOrigins(list);
    }
    await chrome.scripting.executeScript({
        target: {tabId, allFrames: true},
        world: "MAIN",
        injectImmediately: true,
        func: enabled ? installRightClickGuard : removeRightClickGuard
    });
    return {ok: true, on: enabled, origin};
}

let started = false;

export function startRightClickBackground() {
    if (started) return;
    started = true;
    chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
        if (info.status !== "loading" || !tab.url) return;
        const origin = originOf(tab.url);
        if (!origin) return;
        void readOrigins().then((list) => {
            if (!list.includes(origin)) return;
            chrome.scripting.executeScript({
                target: {tabId, allFrames: true},
                world: "MAIN",
                injectImmediately: true,
                func: installRightClickGuard
            }).catch(() => {});
        });
    });
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === "right-click-state") {
            const origin = originOf(message.url || "");
            readOrigins().then((list) => sendResponse({on: Boolean(origin) && list.includes(origin), origin}));
            return true;
        }
        if (message?.type === "right-click-apply") {
            applyRightClick(message.tabId, message.url, Boolean(message.enabled), message.persist !== false)
                .then((result) => sendResponse(result))
                .catch((error) => sendResponse({ok: false, error: error instanceof Error ? error.message : "적용하지 못했어요."}));
            return true;
        }
        return undefined;
    });
}
