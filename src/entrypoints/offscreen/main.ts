// @ts-ignore 순수 JS
import {parseAtom} from "@/modules/gmail/atom.js";
// @ts-ignore 순수 JS
import {ACCOUNT_PROBE_LIMIT, inboxSignature, nextWaitMs, skipDisabledFetch, watchPayload} from "@/modules/gmail/watch.js";

type WatchConfig = {
    intervalMs?: number;
    notify?: boolean;
    moduleOn?: boolean;
    idle?: string;
    disabled?: number[];
};

type Account = {
    index: number;
    email: string;
    unread: number;
    loggedOut?: boolean;
    messages?: unknown[];
};

const state: WatchConfig = {intervalMs: 8000, notify: true, moduleOn: true, idle: "active", disabled: []};
const labels: Record<number, string> = {};
let lastSignature = "";
let timer = 0;
let running = false;

const feedUrl = (index: number) => `https://mail.google.com/mail/u/${index}/feed/atom`;

const readFeed = async (index: number): Promise<Account & {loggedOut: boolean}> => {
    const response = await fetch(feedUrl(index), {credentials: "include", redirect: "follow"});
    const finalUrl = response.url || "";
    if (response.status === 401 || finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) {
        return {loggedOut: true, index, email: labels[index] || "", unread: 0};
    }
    if (!response.ok) throw new Error(`Gmail 응답 ${response.status}`);
    const xml = await response.text();
    new DOMParser().parseFromString(xml, "text/xml");
    const parsed = parseAtom(xml);
    if (!parsed) return {loggedOut: true, index, email: labels[index] || "", unread: 0};
    labels[index] = parsed.email || labels[index] || `계정 ${index + 1}`;
    return {loggedOut: false, index, email: labels[index], unread: parsed.unread, messages: parsed.messages};
};

const collect = async () => {
    const accounts = [];
    for (let index = 0; index < ACCOUNT_PROBE_LIMIT; index++) {
        if (skipDisabledFetch(index, state.disabled, labels[index])) {
            accounts.push({index, email: labels[index], kept: true});
            continue;
        }
        const account = await readFeed(index);
        if (account.loggedOut) {
            if (index === 0 && accounts.length === 0) return {loggedOut: true, accounts: []};
            break;
        }
        accounts.push(account);
    }
    return {loggedOut: false, accounts};
};

const schedule = (ms: number) => {
    window.clearTimeout(timer);
    if (ms === 0) return;
    timer = window.setTimeout(() => { void tick(); }, ms);
};

const tick = async () => {
    if (running) return;
    const wait = nextWaitMs({
        notify: state.notify !== false,
        moduleOn: state.moduleOn !== false,
        online: navigator.onLine,
        idle: state.idle || "active",
        intervalMs: state.intervalMs
    });
    if (wait === 0) {
        schedule(0);
        return;
    }
    if (!navigator.onLine) {
        schedule(wait);
        return;
    }
    running = true;
    try {
        const inbox = await collect();
        const signature = inbox.loggedOut ? "out" : inboxSignature(inbox.accounts);
        const changed = signature !== lastSignature;
        lastSignature = signature;
        const accounts = watchPayload(inbox.accounts, changed);
        chrome.runtime.sendMessage({
            type: "gmail-watch-tick",
            changed,
            loggedOut: inbox.loggedOut,
            accounts
        });
    } catch (error) {
        chrome.runtime.sendMessage({
            type: "gmail-watch-tick",
            changed: false,
            error: error instanceof Error ? error.message : "메일을 확인하지 못했어요."
        });
    } finally {
        running = false;
        schedule(nextWaitMs({
            notify: state.notify !== false,
            moduleOn: state.moduleOn !== false,
            online: navigator.onLine,
            idle: state.idle || "active",
            intervalMs: state.intervalMs
        }));
    }
};

chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "gmail-watch-config") return;
    Object.assign(state, message.config || {});
    void tick();
});

window.addEventListener("online", () => { void tick(); });
window.addEventListener("offline", () => schedule(nextWaitMs({
    notify: state.notify !== false,
    moduleOn: state.moduleOn !== false,
    online: false,
    idle: state.idle || "active",
    intervalMs: state.intervalMs
})));

chrome.runtime.sendMessage({type: "gmail-watch-ready"});
void tick();
