// 사용량 수집: 로그인된 claude.ai / chatgpt.com 웹 세션과 PC의 Codex 기록(보조 프로그램)에서 한도만 읽어요.
// 로그인 토큰은 메모리에서만 쓰고 저장하거나 화면으로 넘기지 않아요. 저장하는 건 한도 퍼센트와 초기화 시각뿐이에요.
import {isModuleEnabled} from "../core-modules.js";
import {USAGE_SNAPSHOT_KEY, chooseCodex, parseChatgptUsage, parseClaudeUsage, parseCodexLocal} from "./usage.js";

export const CLAUDE_ORIGIN = "https://claude.ai/*";
export const CHATGPT_ORIGIN = "https://chatgpt.com/*";
export const NATIVE_HOST = "com.bongextend.video";
const MIN_GAP_MS = 20000;
const TIMEOUT_MS = 12000;
const UUID = /^[0-9a-f][0-9a-f-]{15,63}$/i;

class UsageError extends Error {
    constructor(status, message = "") { super(message || status); this.status = status; }
}

const withTimeout = (fetchImpl, url, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetchImpl(url, {...init, signal: controller.signal, credentials: "include", redirect: "error", cache: "no-store"}).finally(() => clearTimeout(timer));
};

async function getJson(fetchImpl, url, headers = {}) {
    let response;
    try { response = await withTimeout(fetchImpl, url, {headers: {Accept: "application/json", ...headers}}); }
    catch (error) { throw new UsageError("error", error?.name === "AbortError" ? "응답이 늦어요." : "연결하지 못했어요."); }
    if (response.status === 401 || response.status === 403) throw new UsageError("login", "로그인이 필요해요.");
    if (!response.ok) throw new UsageError("error", `응답 ${response.status}`);
    try { return await response.json(); }
    catch { throw new UsageError("error", "응답을 읽지 못했어요."); }
}

const hasOrigin = async (origin, permissions) => {
    try { return await permissions.contains({origins: [origin]}); } catch { return false; }
};

export async function fetchClaude({fetchImpl = fetch, permissions = chrome.permissions} = {}) {
    if (!(await hasOrigin(CLAUDE_ORIGIN, permissions))) return {status: "permission", windows: []};
    try {
        const orgs = await getJson(fetchImpl, "https://claude.ai/api/organizations");
        const org = (Array.isArray(orgs) ? orgs : []).find((item) => UUID.test(String(item?.uuid || "")));
        if (!org) return {status: "login", windows: []};
        const usage = await getJson(fetchImpl, `https://claude.ai/api/organizations/${encodeURIComponent(org.uuid)}/usage`);
        const windows = parseClaudeUsage(usage);
        return windows.length ? {status: "ok", windows} : {status: "empty", windows: []};
    } catch (error) {
        return {status: error.status || "error", windows: [], message: error.message || ""};
    }
}

export async function fetchCodexWeb({fetchImpl = fetch, permissions = chrome.permissions, now = Date.now} = {}) {
    if (!(await hasOrigin(CHATGPT_ORIGIN, permissions))) return {status: "permission", windows: [], plan: ""};
    try {
        const session = await getJson(fetchImpl, "https://chatgpt.com/api/auth/session");
        const token = typeof session?.accessToken === "string" ? session.accessToken : "";
        if (!token) return {status: "login", windows: [], plan: ""};
        const usage = await getJson(fetchImpl, "https://chatgpt.com/backend-api/wham/usage", {Authorization: `Bearer ${token}`});
        const parsed = parseChatgptUsage(usage, now());
        return parsed.windows.length ? {status: "ok", ...parsed} : {status: "empty", windows: [], plan: ""};
    } catch (error) {
        return {status: error.status || "error", windows: [], plan: "", message: error.message || ""};
    }
}

const sendNative = (runtime, message) => new Promise((resolve, reject) => {
    try {
        runtime.sendNativeMessage(NATIVE_HOST, message, (reply) => {
            const error = runtime.lastError;
            if (error) reject(new Error(error.message || "native"));
            else resolve(reply);
        });
    } catch (error) { reject(error); }
});

// PC의 Codex 기록. 보조 프로그램이 없으면 'helper'로 알려줘요.
export async function fetchCodexLocal({runtime = chrome.runtime, now = Date.now} = {}) {
    let reply;
    try { reply = await sendNative(runtime, {type: "codex-usage"}); }
    catch { return {status: "helper", windows: [], stale: false, recordedAt: null}; }
    if (!reply || reply.type === "error") return {status: "helper", windows: [], stale: false, recordedAt: null, message: String(reply?.message || "")};
    const parsed = parseCodexLocal(reply, now());
    if (parsed.windows.length) return {status: "ok", ...parsed};
    return {status: parsed.stale ? "stale" : "empty", ...parsed};
}

export async function loadUsage(deps = {}) {
    const [claude, codexWeb, codexLocal] = await Promise.all([fetchClaude(deps), fetchCodexWeb(deps), fetchCodexLocal(deps)]);
    const chosen = chooseCodex(codexWeb, codexLocal);
    return {
        checkedAt: (deps.now || Date.now)(),
        claude: {status: claude.status, windows: claude.windows, message: claude.message || ""},
        codex: {
            source: chosen.source, windows: chosen.windows, plan: chosen.plan, recordedAt: chosen.recordedAt,
            web: {status: codexWeb.status, message: codexWeb.message || ""},
            local: {status: codexLocal.status}
        }
    };
}

let inflight = null;
let lastAt = 0;

export function startUsageBackground() {
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
        if (message?.type !== "usage-get") return undefined;
        // 확장 프로그램 안의 화면에서 온 요청만 받아요.
        if (sender.id !== chrome.runtime.id || !String(sender.url || "").startsWith(chrome.runtime.getURL(""))) return undefined;
        (async () => {
            if (!(await isModuleEnabled("usage"))) { reply({disabled: true}); return; }
            const stored = await chrome.storage.local.get(USAGE_SNAPSHOT_KEY);
            const cached = stored[USAGE_SNAPSHOT_KEY] || null;
            if (!message.force && cached && Date.now() - lastAt < MIN_GAP_MS) { reply({snapshot: cached}); return; }
            inflight ||= loadUsage().finally(() => { inflight = null; });
            const snapshot = await inflight;
            lastAt = Date.now();
            await chrome.storage.local.set({[USAGE_SNAPSHOT_KEY]: snapshot});
            reply({snapshot});
        })().catch(() => reply({error: true}));
        return true;
    });
}
