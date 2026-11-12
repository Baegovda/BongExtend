export const CHRONO_SITE_ACCESS_KEY = "chrono.siteAccess";
const LEGACY_SCRIPT_IDS = ["chrono-download-helper", "chrono-download-sniffer"];

// 예전 다운로드 엔진이 등록해 둔 페이지 연결을 지워요. 지금은 BongExtend 자체 다운로드 관리만 써요.
export const removeLegacyChronoScripts = async () => {
    try {
        const current = await chrome.scripting.getRegisteredContentScripts({ids: LEGACY_SCRIPT_IDS});
        if (current.length) await chrome.scripting.unregisterContentScripts({ids: current.map(script => script.id)});
    } catch { /* 이미 없어요 */ }
};
