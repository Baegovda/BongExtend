// 팝업이 밖에서 하는 일. effects 를 바꾸면 테스트에서 실제 브라우저를 부르지 않는다.

import {gmailInboxUrl, planGmailOpen} from "../modules/gmail/open.js";

export const openUrl = (effects, url) => effects.tabsCreate({url});

export const openGmailPlace = async (effects, place) => {
    const index = place?.index;
    const email = place?.email || "";
    const url = place?.url || gmailInboxUrl(index, email);
    let tabs = [];
    try {
        if (typeof effects.tabsQuery === "function") tabs = await effects.tabsQuery({url: "https://mail.google.com/*"}) || [];
    } catch {
        tabs = [];
    }
    const plan = planGmailOpen(tabs, index, email, url);
    if (plan.action === "update" && typeof effects.tabsUpdate === "function") {
        const updated = await effects.tabsUpdate(plan.tabId, {url: plan.url, active: true});
        if (plan.windowId != null && typeof effects.windowsUpdate === "function") {
            try { await effects.windowsUpdate(plan.windowId, {focused: true}); } catch { /* 창 포커스는 없어도 탭은 연다. */ }
        }
        return updated || {id: plan.tabId, url: plan.url};
    }
    return effects.tabsCreate({url: plan.url, active: true});
};

export const loadJson = async (effects, url) => {
    const response = await effects.fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
};

export const sendExtension = (effects, message) => effects.sendMessage(message);

export const gmailAct = (effects, account, thread, action) =>
    effects.sendMessage({type: "gmail-act", account, thread, action});

export const gmailReadAccount = (effects, account) =>
    effects.sendMessage({type: "gmail-read-account", account});
