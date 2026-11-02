// @ts-ignore 순수 JS
import {parseAtom} from "@/modules/gmail/atom.js";
// @ts-ignore 순수 JS
import {parseGmailTokens, readProfilePhoto, tokenPageUrls} from "@/modules/gmail/actions.js";
// @ts-ignore 순수 JS
import {ACCOUNT_PROBE_LIMIT, inboxSignature, nextWaitMs, skipDisabledFetch, watchPayload} from "@/modules/gmail/watch.js";
// @ts-ignore 순수 JS
import {soundFile} from "@/modules/gmail/sound.js";

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

const readTokens = async (indexes: unknown) => {
    const tokens: Record<number, {at: string; ik: string; email?: string; photo?: string}> = {};
    const list = Array.isArray(indexes) ? indexes : [];
    for (const raw of list) {
        const index = Number(raw);
        if (!Number.isInteger(index) || index < 0 || index >= ACCOUNT_PROBE_LIMIT) continue;
        for (const url of tokenPageUrls(index)) {
            try {
                const response = await fetch(url, {credentials: "include", redirect: "follow"});
                const finalUrl = response.url || "";
                if (!response.ok || finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) continue;
                const html = await response.text();
                const profile = await readProfilePhoto(fetch, html, labels[index] || "");
                const parsed = parseGmailTokens(html);
                if (profile.photo || parsed) {
                    tokens[index] = {
                        at: parsed?.at || "",
                        ik: parsed?.ik || "",
                        email: labels[index] || profile.email,
                        photo: profile.photo
                    };
                }
                if (parsed) break;
            } catch {
                // 다음 주소. 피드는 이 실패와 상관없이 계속 본다.
            }
        }
    }
    return tokens;
};

const playSound = (name: string, volume: number) => {
    const audio = new Audio(chrome.runtime.getURL(soundFile(name)));
    audio.volume = Math.min(1, Math.max(0, Number(volume) || 0));
    void audio.play();
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "gmail-watch-config") {
        Object.assign(state, message.config || {});
        void tick();
        return;
    }
    if (message?.type === "gmail-play-sound") {
        playSound(String(message.name || "soft"), Number(message.volume));
        sendResponse({ok: true});
        return true;
    }
    if (message?.type !== "gmail-read-tokens") return;
    void readTokens(message.indexes).then(
        (tokens) => sendResponse({ok: true, tokens}),
        () => sendResponse({ok: false, tokens: {}})
    );
    return true;
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
