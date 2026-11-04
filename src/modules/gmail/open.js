// 계정별 Gmail 주소와, 이미 열린 그 계정 탭을 고르는 일. 새 권한은 쓰지 않는다.

export const accountIndex = (index) => {
    const n = Number(index);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
};

const authQuery = (email) => {
    const user = String(email || "").trim();
    return user ? `?authuser=${encodeURIComponent(user)}` : "";
};

export const gmailInboxUrl = (index, email = "") =>
    `https://mail.google.com/mail/u/${accountIndex(index)}/${authQuery(email)}#inbox`;

export const gmailComposeUrl = (index, email = "") => {
    const params = new URLSearchParams({view: "cm", fs: "1", tf: "1"});
    const user = String(email || "").trim();
    if (user) params.set("authuser", user);
    return `https://mail.google.com/mail/u/${accountIndex(index)}/?${params.toString()}`;
};

export const gmailMessageUrl = (index, email = "", link = "", thread = "") => {
    const hash = String(link || "").split("#")[1] || "";
    const parts = hash.split("/").filter(Boolean);
    let target = "inbox";
    if (parts.length >= 2) target = `${parts[0]}/${parts[parts.length - 1]}`;
    else if (thread) target = `inbox/${encodeURIComponent(thread)}`;
    else if (parts.length === 1 && parts[0] !== "inbox" && parts[0] !== "all") target = `inbox/${parts[0]}`;
    return `https://mail.google.com/mail/u/${accountIndex(index)}/${authQuery(email)}#${target}`;
};

const isMailTab = (tab) => /https:\/\/mail\.google\.com\//.test(String(tab?.url || ""));

export const pickGmailTab = (tabs, index, email = "") => {
    const n = String(accountIndex(index));
    const user = String(email || "").trim().toLowerCase();
    const encoded = user ? encodeURIComponent(user).toLowerCase() : "";
    const mail = (Array.isArray(tabs) ? tabs : []).filter(isMailTab);
    const byIndex = mail.find((tab) => new RegExp(`/mail/u/${n}(?:/|\\?|#|$)`).test(String(tab.url)));
    if (byIndex) return byIndex;
    if (!user) return null;
    return mail.find((tab) => {
        const url = String(tab.url || "").toLowerCase();
        return url.includes(`authuser=${encoded}`) || url.includes(`authuser=${user}`);
    }) || null;
};

export const planGmailOpen = (tabs, index, email, url) => {
    const existing = pickGmailTab(tabs, index, email);
    if (existing && existing.id != null) {
        return {action: "update", tabId: existing.id, windowId: existing.windowId ?? null, url};
    }
    return {action: "create", url};
};
