// 툴바 배지 하나. 읽지 않은 메일이 있으면 그 수를, 없으면 업데이트 NEW를 보여 준다.

const badgeApi = () => {
    const browserApi = globalThis.browser;
    if (import.meta.env?.FIREFOX && browserApi?.browserAction) return browserApi.browserAction;
    return browserApi?.action || globalThis.chrome?.action;
};

export async function paintToolbarBadge() {
    const api = badgeApi();
    if (!api?.setBadgeText) return;
    const stored = await chrome.storage.local.get(["gmail.unread", "core.update:available"]);
    const mail = Number(stored["gmail.unread"]) || 0;
    const update = stored["core.update:available"] === true;
    const text = mail > 0 ? (mail > 99 ? "99+" : String(mail)) : (update ? "NEW" : "");
    try {
        await api.setBadgeText({text});
        if (!text) return;
        await api.setBadgeBackgroundColor({color: mail > 0 ? "#0f766e" : "#3b5bdb"});
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
