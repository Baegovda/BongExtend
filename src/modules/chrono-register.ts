export const CHRONO_SITE_ACCESS_KEY = "chrono.siteAccess";
export const CHRONO_SCRIPT_IDS = ["chrono-download-helper", "chrono-download-sniffer"];
export const CHRONO_MATCHES = ["http://*/*", "https://*/*"];

const scripts: chrome.scripting.RegisteredContentScript[] = [
    {
        id: CHRONO_SCRIPT_IDS[0],
        matches: CHRONO_MATCHES,
        js: ["cs/main.js"],
        runAt: "document_idle",
        persistAcrossSessions: true
    },
    {
        id: CHRONO_SCRIPT_IDS[1],
        matches: CHRONO_MATCHES,
        js: ["cs/sniffer.js"],
        runAt: "document_idle",
        allFrames: true,
        persistAcrossSessions: true
    }
];

const upsert = async (script: chrome.scripting.RegisteredContentScript) => {
    const current = await chrome.scripting.getRegisteredContentScripts({ids: [script.id]});
    if (current.length) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
};

export const syncChronoContentScripts = async (enabled: boolean) => {
    try {
        const current = await chrome.scripting.getRegisteredContentScripts({ids: CHRONO_SCRIPT_IDS});
        if (!enabled) {
            if (current.length) await chrome.scripting.unregisterContentScripts({ids: current.map(script => script.id)});
            return;
        }
        if (!await chrome.permissions.contains({permissions: ["webRequest"], origins: CHRONO_MATCHES})) return;
        for (const script of scripts) await upsert(script);
    } catch (error) {
        console.warn("Chrono 페이지 연결을 등록하지 못했어요.", error);
    }
};
