import {isModuleEnabled} from "../core-modules.js";
import {parseAtom} from "./atom.js";
import {
    GMAIL_ALARM_MINUTES,
    actionRequest,
    sendMailAction,
    inboxThreads,
    markInboxRead,
    parseGmailTokens,
    planMailNotifications,
    readProfilePhoto,
    tokenPageUrls
} from "./actions.js";
import {GMAIL_SOUND_KEY, normalizeSound} from "./sound.js";
import {looksLoggedOut, printViewUrl} from "./reader.js";
import {paintToolbarBadge} from "../toolbar-badge.js";
import {clampIntervalMs, dedupeAccounts, enabledAccounts, isDuplicateEmail, notificationId, notificationTitle, unreadOf} from "./watch.js";

const ALARM = "gmail-watchdog";
const SEEN_KEY = "gmail.seen";
const BASE_KEY = "gmail.baseline";
const SNAP_KEY = "gmail.snapshot";
const UNREAD_KEY = "gmail.unread";
const ERROR_KEY = "gmail.error";
const NOTIFY_KEY = "gmail.notify";
const INTERVAL_KEY = "gmail.intervalMs";
const DISABLED_KEY = "gmail.disabled";
const PHOTO_KEY = "gmail.photos";
const PHOTO_RETRY_MS = 30 * 60 * 1000;
const ACCOUNT_LIMIT = 8;
const OFFSCREEN_URL = "offscreen.html";

let started = false;
let checking = null;
let lastCheckAt = 0;
let lock = Promise.resolve();

const exclusive = (fn) => {
    const run = lock.then(() => fn());
    lock = run.then(() => {}, () => {});
    return run;
};

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

const TOKEN_KEY = "gmail.sessionTokens";
const TOKEN_TTL_MS = 20 * 60 * 1000;
const TOKEN_MISS = "Gmail 작업 토큰을 아직 받지 못했어요. 메일 목록은 그대로예요. 잠시 뒤 다시 시도해 주세요.";
const memoryTokens = new Map();

async function sessionTokens() {
    try {
        const stored = await chrome.storage.session.get(TOKEN_KEY);
        return stored[TOKEN_KEY] && typeof stored[TOKEN_KEY] === "object" ? stored[TOKEN_KEY] : {};
    } catch {
        return {};
    }
}

async function cachedToken(index) {
    const key = String(Number(index) || 0);
    const hit = memoryTokens.get(key);
    if (hit && Date.now() - hit.savedAt < TOKEN_TTL_MS) return {at: hit.at, ik: hit.ik};
    const all = await sessionTokens();
    const row = all[key];
    if (row?.at && row?.ik && Date.now() - Number(row.savedAt) < TOKEN_TTL_MS) {
        memoryTokens.set(key, row);
        return {at: row.at, ik: row.ik};
    }
    return null;
}

async function storeToken(index, tokens) {
    const key = String(Number(index) || 0);
    const row = {at: tokens.at, ik: tokens.ik, savedAt: Date.now()};
    memoryTokens.set(key, row);
    try {
        const all = await sessionTokens();
        all[key] = row;
        await chrome.storage.session.set({[TOKEN_KEY]: all});
    } catch { /* 세션 저장이 없어도 메모리에 남아요. 설정 파일에는 넣지 않아요. */ }
}

async function forgetToken(index) {
    const key = String(Number(index) || 0);
    memoryTokens.delete(key);
    try {
        const all = await sessionTokens();
        delete all[key];
        await chrome.storage.session.set({[TOKEN_KEY]: all});
    } catch { /* 없음 */ }
}

async function storePhoto(email, photo) {
    if (!email || !String(photo || "").startsWith("data:image/")) return;
    const key = String(email).toLowerCase();
    const stored = await storageGet(PHOTO_KEY);
    const photos = {...(stored[PHOTO_KEY] || {})};
    if (photos[key] === photo) return;
    photos[key] = photo;
    await storageSet({[PHOTO_KEY]: photos});
}

async function readTokensDirect(index, email = "") {
    for (const url of tokenPageUrls(index)) {
        try {
            const response = await fetch(url, {credentials: "include", redirect: "follow"});
            const finalUrl = response.url || "";
            if (!response.ok || finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) continue;
            const html = await response.text();
            const profile = await readProfilePhoto(fetch, html, email);
            await storePhoto(email || profile.email, profile.photo);
            const parsed = parseGmailTokens(html);
            if (!parsed) continue;
            return parsed;
        } catch { /* 다음 주소 */ }
    }
    return null;
}

async function readTokensFromOffscreen(indexes) {
    if (!(await hasOffscreen())) return null;
    try {
        const response = await chrome.runtime.sendMessage({type: "gmail-read-tokens", indexes});
        return response?.tokens || null;
    } catch {
        return null;
    }
}

async function tokensForAccount(index, fresh = false) {
    if (!fresh) {
        const cached = await cachedToken(index);
        if (cached) return cached;
    } else await forgetToken(index);
    const tabs = await chrome.tabs.query({url: `https://mail.google.com/mail/u/${index}/*`});
    for (const tab of tabs) {
        const fromTab = await readGmailTokensFromTab(tab.id);
        if (fromTab) {
            await storeToken(index, fromTab);
            return fromTab;
        }
    }
    const fromOffscreen = await readTokensFromOffscreen([index]);
    const picked = fromOffscreen?.[index] || fromOffscreen?.[String(index)];
    if (picked?.photo) await storePhoto(picked.email, picked.photo);
    if (picked?.at && picked?.ik) {
        await storeToken(index, picked);
        return {at: picked.at, ik: picked.ik};
    }
    const direct = await readTokensDirect(index, picked?.email || "");
    if (direct) {
        await storeToken(index, direct);
        return direct;
    }
    return null;
}

const photoTried = new Map();
let warming = null;
function warmTokens(accounts) {
    const list = (accounts || []).filter((account) => account && account.enabled !== false && account.index != null);
    if (!list.length || warming) return;
    warming = (async () => {
        const stored = await storageGet(PHOTO_KEY);
        const photos = stored[PHOTO_KEY] && typeof stored[PHOTO_KEY] === "object" ? stored[PHOTO_KEY] : {};
        const missing = [];
        for (const account of list) {
            const email = String(account.email || "").toLowerCase();
            const havePhoto = email && String(photos[email] || "").startsWith("data:image/");
            const tried = email ? photoTried.get(email) || 0 : 0;
            const needPhoto = Boolean(email) && !havePhoto && Date.now() - tried > PHOTO_RETRY_MS;
            if (needPhoto || !(await cachedToken(account.index))) missing.push(account);
        }
        if (!missing.length) return;
        for (const account of missing) {
            const email = String(account.email || "").toLowerCase();
            if (email) photoTried.set(email, Date.now());
        }
        const got = (await readTokensFromOffscreen(missing.map((account) => account.index))) || {};
        for (const account of missing) {
            const picked = got[account.index] || got[String(account.index)];
            const email = account.email || picked?.email || "";
            if (picked?.photo) await storePhoto(email, picked.photo);
            if (picked?.at && picked?.ik) {
                await storeToken(account.index, picked);
                continue;
            }
            const tokens = await readTokensDirect(account.index, email);
            if (tokens?.at && tokens?.ik) await storeToken(account.index, tokens);
        }
    })().catch(() => {}).finally(() => { warming = null; });
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
        if (isDuplicateEmail(accounts, account)) break;
        accounts.push(account);
    }
    return {loggedOut: false, accounts: dedupeAccounts(accounts)};
}

async function playMailSound() {
    const stored = await storageGet(GMAIL_SOUND_KEY);
    const sound = normalizeSound(stored[GMAIL_SOUND_KEY]);
    if (!sound.on || sound.volume <= 0) return;
    try {
        await chrome.runtime.sendMessage({type: "gmail-play-sound", name: sound.name, volume: sound.volume});
    } catch { /* 오프스크린이 없으면 알림만 보여요. */ }
}

async function notifyNew(items, accounts) {
    if (!items?.length || !chrome.notifications?.create) return;
    void playMailSound();
    const byIndex = new Map((accounts || []).map((account) => [account.index, account]));
    for (const item of items) {
        const account = byIndex.get(item.account) || {index: item.account, email: ""};
        try {
            await chrome.notifications.create(notificationId(item), {
                type: "basic",
                iconUrl: chrome.runtime.getURL("/icons/128.png"),
                title: notificationTitle(item, account),
                message: item.subject || "(제목 없음)",
                contextMessage: account.email || item.snippet || ""
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
    checking = exclusive(async () => {
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
            const stored = await storageGet([SEEN_KEY, BASE_KEY, NOTIFY_KEY, DISABLED_KEY]);
            const disabled = Array.isArray(stored[DISABLED_KEY]) ? stored[DISABLED_KEY] : [];
            const unique = dedupeAccounts(inbox.accounts);
            const messages = enabledAccounts(unique, disabled).flatMap((account) =>
                (account.messages || []).map((message) => ({...message, account: account.index}))
            );
            const plan = planMailNotifications(stored[SEEN_KEY], messages, stored[BASE_KEY] === true);
            const off = new Set(disabled.map(Number));
            const unread = unreadOf(unique, disabled);
            const accounts = unique.map((account) => ({...account, enabled: !off.has(Number(account.index))}));
            const snapshot = {checkedAt: Date.now(), loggedOut: false, accounts, unread};
            await storageSet({
                [SNAP_KEY]: snapshot,
                [UNREAD_KEY]: unread,
                [SEEN_KEY]: plan.seen,
                [BASE_KEY]: true,
                [ERROR_KEY]: ""
            });
            if (reason !== "baseline" && stored[NOTIFY_KEY] !== false) await notifyNew(plan.notify, accounts);
            await paintToolbarBadge();
            lastCheckAt = Date.now();
            warmTokens(accounts);
            return snapshot;
        } catch (error) {
            const message = error instanceof Error ? error.message : "메일을 확인하지 못했어요.";
            await storageSet({[ERROR_KEY]: message});
            const snap = await storageGet(SNAP_KEY);
            return snap[SNAP_KEY] || null;
        } finally {
            checking = null;
        }
    });
    return checking;
}

async function reloadQuietGmailTabs() {
    const tabs = await chrome.tabs.query({url: "https://mail.google.com/*"});
    await Promise.all(tabs.map(async (tab) => {
        if (tab.active || tab.id == null) return;
        try { await chrome.tabs.reload(tab.id); } catch { /* 이미 닫힌 탭 */ }
    }));
}

async function postMailAction(accountIndex, tokens, action, thread, deps) {
    const request = actionRequest(accountIndex, tokens, action, thread);
    return sendMailAction(request, deps.fetchImpl);
}

export async function actOnGmail(accountIndex, thread, action, deps = {}) {
    let tokens = deps.tokens || await tokensForAccount(accountIndex, false);
    if (!tokens) throw new Error(TOKEN_MISS);
    let ok = await postMailAction(accountIndex, tokens, action, thread, deps);
    if (!ok && !deps.tokens) {
        tokens = await tokensForAccount(accountIndex, true);
        if (tokens) ok = await postMailAction(accountIndex, tokens, action, thread, deps);
    }
    if (!ok) throw new Error("Gmail에 반영하지 못했어요. 로그인 상태를 확인해 주세요.");
    if (!deps.skipReload) await reloadQuietGmailTabs();
    return checkGmail("action", deps);
}

async function watchSettings() {
    const stored = await storageGet([NOTIFY_KEY, INTERVAL_KEY, DISABLED_KEY]);
    let idle = "active";
    try { idle = await chrome.idle.queryState(60); } catch { /* 상태를 모르면 평소 간격을 쓴다. */ }
    return {
        notify: stored[NOTIFY_KEY] !== false,
        moduleOn: await isModuleEnabled("gmail"),
        intervalMs: clampIntervalMs(stored[INTERVAL_KEY]),
        disabled: Array.isArray(stored[DISABLED_KEY]) ? stored[DISABLED_KEY] : [],
        idle
    };
}

async function hasOffscreen() {
    if (chrome.offscreen?.hasDocument) return chrome.offscreen.hasDocument();
    const contexts = await chrome.runtime.getContexts?.({contextTypes: ["OFFSCREEN_DOCUMENT"]});
    return Array.isArray(contexts) && contexts.length > 0;
}

async function closeOffscreen() {
    if (!(await hasOffscreen())) return;
    try { await chrome.offscreen.closeDocument(); } catch { /* 이미 닫힘 */ }
}

async function syncOffscreen() {
    const settings = await watchSettings();
    if (!settings.moduleOn || !settings.notify) {
        await closeOffscreen();
        if (!settings.moduleOn) {
            await storageSet({[UNREAD_KEY]: 0});
            await paintToolbarBadge();
        }
        return;
    }
    if (!(await hasOffscreen())) {
        await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL(OFFSCREEN_URL),
            reasons: ["DOM_PARSER", "AUDIO_PLAYBACK"],
            justification: "로그인된 Gmail 받은편지함 피드를 읽고, 새 메일 알림 소리를 재생합니다."
        });
    }
    try {
        await chrome.runtime.sendMessage({type: "gmail-watch-config", config: settings});
    } catch { /* 문서가 아직 준비되지 않으면 ready 신호에서 다시 보냅니다. */ }
}

async function applyWatchTick(message) {
    return exclusive(async () => {
    if (!(await isModuleEnabled("gmail"))) return;
    if (message.error) {
        await storageSet({[ERROR_KEY]: message.error});
        return;
    }
    if (message.loggedOut) {
        const snapshot = {checkedAt: Date.now(), loggedOut: true, accounts: [], unread: 0};
        await storageSet({[SNAP_KEY]: snapshot, [UNREAD_KEY]: 0, [ERROR_KEY]: "Gmail에 로그인되어 있지 않아요. 브라우저에서 Gmail을 연 뒤 다시 확인해 주세요."});
        await paintToolbarBadge();
        return;
    }
    const stored = await storageGet([SEEN_KEY, BASE_KEY, NOTIFY_KEY, DISABLED_KEY, SNAP_KEY]);
    const disabled = Array.isArray(stored[DISABLED_KEY]) ? stored[DISABLED_KEY] : [];
    const previous = new Map((stored[SNAP_KEY]?.accounts || []).map((account) => [account.index, account]));
    const off = new Set(disabled.map(Number));
    const accounts = dedupeAccounts((message.accounts || []).map((account) => {
        const prior = previous.get(account.index);
        const messages = account.kept ? (prior?.messages || []) : (Array.isArray(account.messages) ? account.messages : (prior?.messages || []));
        const unread = account.kept ? (prior?.unread || 0) : account.unread;
        return {...account, messages, unread, enabled: !off.has(Number(account.index))};
    }));
    const watched = enabledAccounts(accounts, disabled);
    const messages = watched.flatMap((account) => (account.messages || []).map((item) => ({...item, account: account.index})));
    const plan = message.changed
        ? planMailNotifications(stored[SEEN_KEY], messages, stored[BASE_KEY] === true)
        : {notify: [], seen: stored[SEEN_KEY] || [], baseline: stored[BASE_KEY] === true};
    const unread = unreadOf(accounts, disabled);
    const snapshot = {checkedAt: Date.now(), loggedOut: false, accounts, unread};
    await storageSet({
        [SNAP_KEY]: snapshot,
        [UNREAD_KEY]: unread,
        [SEEN_KEY]: plan.seen,
        [BASE_KEY]: true,
        [ERROR_KEY]: ""
    });
    if (stored[NOTIFY_KEY] !== false && message.changed) await notifyNew(plan.notify, accounts);
    await paintToolbarBadge();
    warmTokens(accounts);
    });
}

function onMessage(message, _sender, sendResponse) {
    const type = message?.type;
    if (type === "gmail-tab-signal") {
        void checkGmail("tab");
        return;
    }
    if (type === "gmail-watch-ready") {
        void syncOffscreen();
        return;
    }
    if (type === "gmail-watch-tick") {
        void applyWatchTick(message);
        return;
    }
    if (type === "gmail-config") {
        const intervalMs = clampIntervalMs(message.intervalMs);
        const disabled = Array.isArray(message.disabled) ? message.disabled.map(Number) : [];
        storageSet({
            [NOTIFY_KEY]: message.notify !== false,
            [INTERVAL_KEY]: intervalMs,
            [DISABLED_KEY]: disabled
        }).then(() => syncOffscreen()).then(() => sendResponse({ok: true, intervalMs}));
        return true;
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
    if (type === "gmail-read-account") {
        (async () => {
            const stored = await storageGet(SNAP_KEY);
            const previous = stored[SNAP_KEY] || null;
            const account = (previous?.accounts || []).find((item) => Number(item.index) === Number(message.account));
            const threads = inboxThreads(account);
            if (!threads.length) {
                sendResponse({ok: true, error: "", snapshot: previous});
                return;
            }
            const result = await markInboxRead(message.account, threads, {
                fetchImpl: fetch,
                tokensFor: (index, fresh) => tokensForAccount(index, fresh)
            });
            if (!result.ok) {
                const after = await storageGet(SNAP_KEY);
                sendResponse({ok: false, error: result.error, snapshot: after[SNAP_KEY] || previous});
                return;
            }
            try {
                await reloadQuietGmailTabs();
                const snapshot = await checkGmail("action");
                sendResponse({ok: true, error: "", snapshot: snapshot || previous});
            } catch (error) {
                const after = await storageGet(SNAP_KEY);
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : "메일을 바꾸지 못했어요.",
                    snapshot: after[SNAP_KEY] || previous
                });
            }
        })();
        return true;
    }
    if (type === "gmail-read-thread") {
        (async () => {
            const thread = String(message.thread || "");
            if (!/^[0-9a-f]{6,32}$/i.test(thread)) { sendResponse({ok: false, error: "메일 번호를 알 수 없어요."}); return; }
            try {
                for (const fresh of [false, true]) {
                    const tokens = await tokensForAccount(message.account, fresh);
                    if (!tokens?.ik) continue;
                    const response = await fetch(printViewUrl(message.account, tokens.ik, thread), {credentials: "include", redirect: "follow"});
                    const html = response.ok ? await response.text() : "";
                    if (html && !looksLoggedOut(html, response.url)) { sendResponse({ok: true, html}); return; }
                }
                sendResponse({ok: false, error: "메일 내용을 불러오지 못했어요. Gmail 로그인 상태를 확인해 주세요."});
            } catch (error) {
                sendResponse({ok: false, error: error instanceof Error ? error.message : "메일 내용을 불러오지 못했어요."});
            }
        })();
        return true;
    }
    if (type === "gmail-act") {
        actOnGmail(message.account, message.thread, message.action)
            .then((snapshot) => sendResponse({ok: true, snapshot, error: ""}))
            .catch((error) => storageGet(SNAP_KEY).then((stored) => sendResponse({
                ok: false,
                error: error instanceof Error ? error.message : "메일을 바꾸지 못했어요.",
                snapshot: stored[SNAP_KEY] || null
            })));
        return true;
    }
    return undefined;
}

export function startGmailBackground() {
    if (started) return;
    started = true;
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === ALARM) void syncOffscreen();
    });
    chrome.idle?.onStateChanged?.addListener(() => { void syncOffscreen(); });
    try { chrome.idle?.setDetectionInterval?.(60); } catch { /* 간격 변경을 지원하지 않으면 기본값을 쓴다. */ }
    chrome.windows?.onFocusChanged?.addListener((windowId) => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) return;
        void syncOffscreen();
    });
    chrome.notifications?.onClicked?.addListener((clickedId) => {
        if (!String(clickedId).startsWith("gmail-")) return;
        void (async () => {
            const stored = await storageGet(SNAP_KEY);
            const accounts = stored[SNAP_KEY]?.accounts || [];
            for (const account of accounts) {
                const message = (account.messages || []).find((item) => notificationId({...item, account: account.index}) === clickedId || `gmail-${item.id}` === clickedId);
                if (message?.link) {
                    await chrome.tabs.create({url: message.link});
                    return;
                }
            }
            await chrome.tabs.create({url: "https://mail.google.com/mail/u/0/#inbox"});
        })();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes["core.modules"] || changes[NOTIFY_KEY])) void syncOffscreen();
    });
    void chrome.alarms.create(ALARM, {periodInMinutes: GMAIL_ALARM_MINUTES, delayInMinutes: GMAIL_ALARM_MINUTES});
    void syncOffscreen();
    void migrateDuplicateAccounts().then(() => checkGmail("popup"));
}

// 이미 저장된 목록에 같은 주소가 여러 번 있으면 첫 계정만 남긴다. 다른 설정 키는 건드리지 않는다.
async function migrateDuplicateAccounts() {
    const stored = await storageGet([SNAP_KEY, DISABLED_KEY]);
    const snapshot = stored[SNAP_KEY];
    if (!snapshot || !Array.isArray(snapshot.accounts)) return;
    const accounts = dedupeAccounts(snapshot.accounts);
    if (accounts.length === snapshot.accounts.length) return;
    const kept = new Set(accounts.map((account) => Number(account.index)));
    const disabled = (Array.isArray(stored[DISABLED_KEY]) ? stored[DISABLED_KEY] : []).map(Number).filter((index) => kept.has(index));
    const off = new Set(disabled);
    const nextAccounts = accounts.map((account) => ({...account, enabled: !off.has(Number(account.index))}));
    const unread = unreadOf(nextAccounts, disabled);
    await storageSet({
        [SNAP_KEY]: {...snapshot, accounts: nextAccounts, unread},
        [UNREAD_KEY]: unread,
        [DISABLED_KEY]: disabled
    });
    await paintToolbarBadge();
}
