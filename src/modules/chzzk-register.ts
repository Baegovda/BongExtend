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
    "chzzk/content-autoplay.js"
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
        } catch (error) {
            console.error("치지직 스크립트를 등록하지 못했어요.", error);
        }
    });
    return running;
};
