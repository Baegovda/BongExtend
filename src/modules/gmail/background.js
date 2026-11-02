import {isModuleEnabled} from "../core-modules.js";
import {parseAtom} from "./atom.js";
import {
    GMAIL_ALARM_MINUTES,
    GMAIL_WAKE_FOLLOWUP_MS,
    actionRequest,
    parseGmailTokens,
    planMailNotifications
} from "./actions.js";
import {paintToolbarBadge} from "../toolbar-badge.js";

const ALARM = "gmail-poll";
const SEEN_KEY = "gmail.seen";
const BASE_KEY = "gmail.baseline";
const SNAP_KEY = "gmail.snapshot";
const UNREAD_KEY = "gmail.unread";
const ERROR_KEY = "gmail.error";
const ACCOUNT_LIMIT = 6;

let started = false;
let checking = null;
let lastCheckAt = 0;
let followupTimer = 0;

const gaps = {action: 0, popup: 0, alarm: 0, followup: 0, tab: 2000, focus: 10000, idle: 10000};

const storageGet = async (keys) => chrome.storage.local.get(keys);
const storageSet = async (items) => chrome.storage.local.set(items);

export const accountUrl = (index, path) => `https://mail.google.com/mail/u/${index}/${path}`;

export async function readGmailTokensFromTab(tabId) {
    if (tabId == null || !chrome.scripting?.executeScript) return null;
    try {
        const results = await chrome.scripting.executeScript({
            target: {tabId},
            world: "MAIN",
            func: () => {
                const page = window;
                const token = page.GM_ACTION_TOKEN;
                const key = page.GM_ID_KEY || (page.GLOBALS && page.GLOBALS[9]);
                return {
                    at: typeof token === "string" ? token : "",
                    ik: typeof key === "string" ? key : ""
                };
            }
        });
        const value = results?.[0]?.result;
        if (!value?.at || value.at === "null" || !value?.ik || value.ik === "null") return null;
        return {at: value.at, ik: value.ik};
    } catch {
        return null;
    }
}

async function tokensForAccount(index) {
    const tabs = await chrome.tabs.query({url: `https://mail.google.com/mail/u/${index}/*`});
    for (const tab of tabs) {
        const fromTab = await readGmailTokensFromTab(tab.id);
        if (fromTab) return fromTab;
    }
    const response = await fetch(accountUrl(index, ""), {credentials: "include", redirect: "follow"});
    const finalUrl = response.url || "";
    if (finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) return null;
    const html = await response.text();
    return parseGmailTokens(html);
}

async function fetchAccount(index) {
    const response = await fetch(accountUrl(index, "feed/atom"), {credentials: "include", redirect: "follow"});
    const finalUrl = response.url || "";
    if (response.status === 401 || finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) {
        return {loggedOut: true};
    }
    if (!response.ok) throw new Error(`Gmail 응답 ${response.status}`);
    const xml = await response.text();
    const parsed = parseAtom(xml);
    if (!parsed) return {loggedOut: true};
    return {loggedOut: false, index, ...parsed};
}

export async function loadInbox(fetchAccountImpl = fetchAccount) {
    const accounts = [];
    for (let index = 0; index < ACCOUNT_LIMIT; index++) {
        const account = await fetchAccountImpl(index);
        if (account.loggedOut) {
            if (index === 0) return {loggedOut: true, accounts: []};
            break;
        }
        accounts.push(account);
    }
    return {loggedOut: false, accounts};
}

async function notifyNew(items) {
    if (!chrome.notifications?.create) return;
    for (const item of items) {
        const who = item.fromName || item.fromEmail || "새 메일";
        try {
            await chrome.notifications.create(`gmail-${item.id}`, {
                type: "basic",
                iconUrl: chrome.runtime.getURL("/icons/128.png"),
                title: who,
                message: item.subject || "(제목 없음)",
                contextMessage: item.snippet || ""
            });
        } catch (error) {
            console.error("메일 알림을 띄우지 못했어요.", error);
        }
    }
}

export async function checkGmail(reason = "alarm", deps = {}) {
    const gap = gaps[reason] ?? 0;
    if (checking) return checking;
    if (gap && Date.now() - lastCheckAt < gap) return storageGet(SNAP_KEY).then((s) => s[SNAP_KEY] || null);
    checking = (async () => {
        if (!(await isModuleEnabled("gmail"))) {
            await storageSet({[UNREAD_KEY]: 0});
            await paintToolbarBadge();
            return null;
        }
        try {
            const inbox = await (deps.loadInbox || loadInbox)();
            if (inbox.loggedOut) {
                const snapshot = {checkedAt: Date.now(), loggedOut: true, accounts: [], unread: 0};
                await storageSet({[SNAP_KEY]: snapshot, [UNREAD_KEY]: 0, [ERROR_KEY]: "Gmail에 로그인되어 있지 않아요. 브라우저에서 Gmail을 연 뒤 다시 확인해 주세요."});
                await paintToolbarBadge();
                return snapshot;
            }
            const stored = await storageGet([SEEN_KEY, BASE_KEY]);
            const messages = inbox.accounts.flatMap((account) => account.messages.map((message) => ({...message, account: account.index})));
            const plan = planMailNotifications(stored[SEEN_KEY], messages, stored[BASE_KEY] === true);
            const unread = inbox.accounts.reduce((sum, account) => sum + (Number(account.unread) || 0), 0);
            const snapshot = {checkedAt: Date.now(), loggedOut: false, accounts: inbox.accounts, unread};
            await storageSet({
                [SNAP_KEY]: snapshot,
                [UNREAD_KEY]: unread,
                [SEEN_KEY]: plan.seen,
                [BASE_KEY]: true,
                [ERROR_KEY]: ""
            });
            if (reason !== "baseline") await notifyNew(plan.notify);
            await paintToolbarBadge();
            lastCheckAt = Date.now();
            if (reason === "alarm" || reason === "focus" || reason === "idle") scheduleFollowup();
            return snapshot;
        } catch (error) {
            const message = error instanceof Error ? error.message : "메일을 확인하지 못했어요.";
            await storageSet({[ERROR_KEY]: message});
            const snap = await storageGet(SNAP_KEY);
            return snap[SNAP_KEY] || null;
        } finally {
            checking = null;
        }
    })();
    return checking;
}

function scheduleFollowup() {
    clearTimeout(followupTimer);
    followupTimer = setTimeout(() => { void checkGmail("followup"); }, GMAIL_WAKE_FOLLOWUP_MS);
}

async function reloadQuietGmailTabs() {
    const tabs = await chrome.tabs.query({url: "https://mail.google.com/*"});
    await Promise.all(tabs.map(async (tab) => {
        if (tab.active || tab.id == null) return;
        try { await chrome.tabs.reload(tab.id); } catch { /* 이미 닫힌 탭 */ }
    }));
}

export async function actOnGmail(accountIndex, thread, action, deps = {}) {
    const tokens = deps.tokens || await tokensForAccount(accountIndex);
    if (!tokens) throw new Error("Gmail 작업 토큰을 읽지 못했어요. Gmail 탭을 한 번 연 뒤 다시 시도해 주세요.");
    const request = actionRequest(accountIndex, tokens, action, thread);
    const response = await (deps.fetchImpl || fetch)(request.url, {
        method: "POST",
        credentials: "include",
        redirect: "follow",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: request.body
    });
    const finalUrl = response.url || "";
    if (!response.ok || finalUrl.includes("accounts.google.com")) {
        throw new Error("Gmail에 반영하지 못했어요. 로그인 상태를 확인해 주세요.");
    }
    if (!deps.skipReload) await reloadQuietGmailTabs();
    return checkGmail("action", deps);
}

function onMessage(message, _sender, sendResponse) {
    const type = message?.type;
    if (type === "gmail-tab-signal") {
        void checkGmail("tab");
        return;
    }
    if (type === "gmail-get") {
        storageGet([SNAP_KEY, ERROR_KEY]).then((stored) => {
            sendResponse({snapshot: stored[SNAP_KEY] || null, error: stored[ERROR_KEY] || ""});
            void checkGmail("popup");
        });
        return true;
    }
    if (type === "gmail-refresh") {
        checkGmail("popup").then((snapshot) => storageGet(ERROR_KEY).then((stored) => {
            sendResponse({snapshot, error: stored[ERROR_KEY] || ""});
        }));
        return true;
    }
    if (type === "gmail-act") {
        actOnGmail(message.account, message.thread, message.action)
            .then((snapshot) => sendResponse({ok: true, snapshot, error: ""}))
            .catch((error) => sendResponse({ok: false, error: error instanceof Error ? error.message : "메일을 바꾸지 못했어요."}));
        return true;
    }
    return undefined;
}

export function startGmailBackground() {
    if (started) return;
    started = true;
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === ALARM) void checkGmail("alarm");
    });
    chrome.idle?.onStateChanged?.addListener((state) => {
        if (state === "active") void checkGmail("idle");
    });
    try { chrome.idle?.setDetectionInterval?.(60); } catch { /* 간격 변경을 지원하지 않으면 기본값을 쓴다. */ }
    chrome.windows?.onFocusChanged?.addListener((windowId) => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) return;
        void checkGmail("focus");
    });
    chrome.notifications?.onClicked?.addListener((notificationId) => {
        if (!String(notificationId).startsWith("gmail-")) return;
        void (async () => {
            const stored = await storageGet(SNAP_KEY);
            const accounts = stored[SNAP_KEY]?.accounts || [];
            for (const account of accounts) {
                const message = (account.messages || []).find((item) => `gmail-${item.id}` === notificationId);
                if (message?.link) {
                    await chrome.tabs.create({url: message.link});
                    return;
                }
            }
            await chrome.tabs.create({url: "https://mail.google.com/mail/u/0/#inbox"});
        })();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes["core.modules"]) void checkGmail("popup");
    });
    void chrome.alarms.create(ALARM, {periodInMinutes: GMAIL_ALARM_MINUTES, delayInMinutes: GMAIL_ALARM_MINUTES});
    void checkGmail("popup");
}
