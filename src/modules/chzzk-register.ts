// 치지직 콘텐츠 스크립트를 동적으로 등록한다.
// 파일 순서는 예전 콘텐츠 스크립트 순서 그대로이고, 맨 앞에 저장소 구역 shim(lib/ns.js)만 더했다.
export const CHZZK_SCRIPT_ID = "bongextend-chzzk";

export const CHZZK_SCRIPT_FILES = [
    "chzzk/lib/ns.js",
    "chzzk/lib/guard.js",
    "chzzk/lib/quality.js",
    "chzzk/lib/following.js",
    "chzzk/lib/extras.js",
    "chzzk/lib/watch.js",
    "chzzk/lib/wide.js",
    "chzzk/lib/player.js",
    "chzzk/lib/autoplay.js",
    "chzzk/lib/retrytimer.js",
    "chzzk/content.js",
    "chzzk/content-following.js",
    "chzzk/content-extras.js",
    "chzzk/content-watch.js",
    "chzzk/content-wide.js",
    "chzzk/content-autoplay.js",
    "chzzk/content-log-power.js"
];

export const CHZZK_MATCHES = ["https://chzzk.naver.com/*"];

// 광고 차단은 페이지 스크립트보다 먼저, 메인 세상에서 붙인다. 위의 파일 순서는 바꾸지 않는다.
export const CHZZK_AD_SCRIPT_ID = "bongextend-chzzk-ads";
export const CHZZK_AD_SCRIPT_FILES = [
    "chzzk/lib/ads.js",
    "chzzk/content-adblock.js"
];
export const CHZZK_AD_FLAG_ID = "bongextend-chzzk-adflag";
export const CHZZK_AD_FLAG_FILES = [
    "chzzk/lib/ns.js",
    "chzzk/lib/player.js",
    "chzzk/content-adflag.js"
];

const CHZZK_SCRIPT_IDS = [CHZZK_SCRIPT_ID, CHZZK_AD_SCRIPT_ID, CHZZK_AD_FLAG_ID];

type ModulesGetter = () => Promise<Record<string, boolean>>;

let running: Promise<void> = Promise.resolve();

const upsertScript = async (script: chrome.scripting.RegisteredContentScript) => {
    const existing = await chrome.scripting.getRegisteredContentScripts({ids: [script.id]});
    if (existing.length) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
};

const applyAdProtectionToOpenTabs = async () => {
    const tabs = await chrome.tabs.query({url: CHZZK_MATCHES});
    for (const tab of tabs) {
        if (typeof tab.id !== "number") continue;
        const target = {tabId: tab.id};
        await chrome.scripting.executeScript({target, files: CHZZK_AD_SCRIPT_FILES, world: "MAIN"});
        await chrome.scripting.executeScript({target, files: CHZZK_AD_FLAG_FILES, world: "ISOLATED"});
    }
};

// 확장이 설치·업데이트되면 이미 열려 있던 치지직 탭의 예전 스크립트는 연결이 끊겨 멈춰요(통나무 자동 받기·넓은 화면 등).
// Chrome은 등록된 스크립트를 열린 탭에 다시 넣어 주지 않아서, 그 탭들에 새로 넣어 줘요.
export const reinjectChzzkIntoOpenTabs = async (getModules: ModulesGetter): Promise<number> => {
    if (!chrome.scripting?.executeScript) return 0;
    const modules = await getModules();
    if (modules.chzzk === false) return 0;
    await running.catch(() => {});
    const tabs = await chrome.tabs.query({url: CHZZK_MATCHES});
    let count = 0;
    for (const tab of tabs) {
        if (typeof tab.id !== "number" || tab.discarded) continue;
        try {
            // 이번 확장 인스턴스의 스크립트가 이미 돌고 있는 탭(새로 열린 탭)은 건너뛰어요(lib/guard.js의 BongAlive로 확인; ns.js는 광고 차단용으로 따로 들어가서 표시로 못 써요). 같은 스크립트가 두 번 돌면 안 돼요.
            const [probe] = await chrome.scripting.executeScript({target: {tabId: tab.id}, func: () => typeof (globalThis as unknown as {BongAlive?: unknown}).BongAlive === "function"});
            if (probe?.result) continue;
            await chrome.scripting.executeScript({target: {tabId: tab.id, allFrames: true}, files: CHZZK_SCRIPT_FILES});
            count++;
        } catch (error) {
            console.warn("열려 있는 치지직 탭에 스크립트를 다시 넣지 못했어요.", error);
        }
    }
    return count;
};

export const syncChzzkScripts = (getModules: ModulesGetter): Promise<void> => {
    running = running.then(async () => {
        if (!chrome.scripting?.registerContentScripts) return;
        try {
            const modules = await getModules();
            if (modules.chzzk === false) {
                const existing = await chrome.scripting.getRegisteredContentScripts({ids: CHZZK_SCRIPT_IDS});
                if (existing.length) await chrome.scripting.unregisterContentScripts({ids: existing.map(script => script.id)});
                return;
            }
            const script: chrome.scripting.RegisteredContentScript = {
                id: CHZZK_SCRIPT_ID,
                matches: CHZZK_MATCHES,
                js: CHZZK_SCRIPT_FILES,
                runAt: "document_idle",
                allFrames: true,
                persistAcrossSessions: true
            };
            await upsertScript(script);
            await upsertScript({
                id: CHZZK_AD_FLAG_ID,
                matches: CHZZK_MATCHES,
                js: CHZZK_AD_FLAG_FILES,
                runAt: "document_start",
                allFrames: true,
                persistAcrossSessions: true
            });
            await upsertScript({
                id: CHZZK_AD_SCRIPT_ID,
                matches: CHZZK_MATCHES,
                js: CHZZK_AD_SCRIPT_FILES,
                runAt: "document_start",
                allFrames: true,
                world: "MAIN",
                persistAcrossSessions: true
            });
            await applyAdProtectionToOpenTabs();
        } catch (error) {
            console.error("치지직 스크립트를 등록하지 못했어요.", error);
        }
    });
    return running;
};
