"use strict";

// Chrono의 화면 요청을 BongExtend 다운로드 탭으로 연결해요.
globalThis.BongExtendChronoAction ||= (() => {
    const POPUP_KEY = "core.chronoPopup";
    const allowedPopup = popup => /^\/(?:(?:pop\/(?:pop|sniffer))|(?:ui\/(?:index|options)))\.html(?:\?mnu=1)?$/.test(popup || "");
    let filenameHandler;
    return {
        setFilenameHandler(handler) { filenameHandler = handler; },
        suggestFilename(item, suggest) {
            if (!filenameHandler) { suggest(); return; }
            return filenameHandler(item, suggest);
        },
        async setPopup({popup}) {
            if (!allowedPopup(popup)) throw new Error("지원하지 않는 다운로드 화면이에요.");
            await chrome.storage.local.set({[POPUP_KEY]: popup});
        },
        setTitle: () => Promise.resolve(),
        setIcon: () => Promise.resolve(),
        setBadgeText: ({text}) => chrome.storage.local.set({"chrono.downloadingCount": String(text || "")}),
        async sourceTab(callback) {
            const tabs = await chrome.tabs.query({url: ["http://*/*", "https://*/*"], windowType: "normal"});
            tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
            callback(tabs.length ? [tabs[0]] : []);
        },
        async setUiOptions(options) {
            if (await chrome.permissions.contains({permissions: ["downloads.ui"]})) await chrome.downloads.setUiOptions(options);
        },
        async showView(popup) {
            await this.setPopup({popup});
            await this.openPopup();
        },
        async openPopup() {
            await chrome.storage.local.set({"core.popupTab": "download"});
            const contexts = await chrome.runtime.getContexts({});
            if (contexts.some(context => context.documentUrl?.startsWith(chrome.runtime.getURL("popup.html")))) return;
            try {
                if (!chrome.action.openPopup) throw new Error("popup unavailable");
                await chrome.action.openPopup();
            } catch {
                await chrome.windows.create({url: chrome.runtime.getURL("popup.html"), type: "popup", width: 1000, height: 760});
            }
        },
        async ensureOffscreen() {
            if (typeof globalThis.setupOffscreenDocument !== "function") throw new Error("공유 오프스크린을 준비하지 못했어요.");
            await globalThis.setupOffscreenDocument();
        },
        async siteAccess() {
            const stored = await chrome.storage.local.get(["chrono.siteAccess", "core.modules"]);
            return stored["chrono.siteAccess"] === true && stored["core.modules"]?.download !== false &&
                await chrome.permissions.contains({permissions: ["webRequest"], origins: ["http://*/*", "https://*/*"]});
        }
    };
})();
