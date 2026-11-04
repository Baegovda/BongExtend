// 툴바 아이콘 배지는 계정들의 읽지 않은 메일 합계만 보여 준다. 0이면 비운다.

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

export async function paintToolbarBadge() {
    const api = badgeApi();
    if (!api?.setBadgeText) return;
    const stored = await chrome.storage.local.get(["gmail.unread"]);
    const text = toolbarBadgeText(stored["gmail.unread"]);
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
