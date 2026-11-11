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

// 이 PC에 로그인된 Claude Code·Codex에서 한도를 읽어요(보조 프로그램이 로그인 정보로 한도만 가져와요). 보조 프로그램이 없거나 옛 버전이면 'helper'예요.
export async function fetchLocalUsage({runtime = chrome.runtime, now = Date.now} = {}) {
    let reply = null;
    try { reply = await sendNative(runtime, {type: "usage-local"}); } catch { reply = null; }
    if (!reply || reply.type !== "usage-local") {
        return {claude: {status: "helper", windows: []}, codex: {status: "helper", windows: [], api: {windows: [], plan: ""}, log: {windows: [], stale: false, recordedAt: null}}};
    }
    const c = reply.claude || {};
    const claudeWindows = c.status === "ok" ? parseClaudeUsage(c.usage) : [];
    const claude = {status: claudeWindows.length ? "ok" : c.status === "ok" ? "empty" : (c.status || "error"), windows: claudeWindows};
    const api = reply.codex?.api || {};
    const apiParsed = api.status === "ok" ? parseChatgptUsage(api.data, now()) : {windows: [], plan: ""};
    const logParsed = parseCodexLocal(reply.codex?.log, now());
    let status = "empty";
    if (apiParsed.windows.length || logParsed.windows.length) status = "ok";
    else if (api.status === "expired" || api.status === "error") status = api.status;
    else if (logParsed.stale) status = "stale";
    else if (api.status === "none") status = "none";
    return {claude, codex: {status, windows: [], api: apiParsed, log: logParsed}};
}

const firstWithWindows = (sources) => sources.find((item) => item.windows?.length) || {source: "", windows: [], plan: "", recordedAt: null};

// 이 PC의 로그인(로컬)을 먼저 쓰고, 없을 때만 웹 계정 값을 써요.
export async function loadUsage(deps = {}) {
    const [local, claudeWeb, codexWeb] = await Promise.all([fetchLocalUsage(deps), fetchClaude(deps), fetchCodexWeb(deps)]);
    const claudeFrom = firstWithWindows([{source: "local", windows: local.claude.windows}, {source: "web", windows: claudeWeb.windows}]);
    const claudeStatus = claudeFrom.windows.length ? "ok" : (local.claude.status !== "helper" && local.claude.status !== "none" ? local.claude.status : claudeWeb.status);
    const codexFrom = firstWithWindows([
        {source: "local", windows: local.codex.api.windows, plan: local.codex.api.plan, recordedAt: null},
        {source: "local-log", windows: local.codex.log.windows, plan: "", recordedAt: local.codex.log.recordedAt || null},
        {source: "web", windows: codexWeb.windows, plan: codexWeb.plan || "", recordedAt: null}
    ]);
    return {
        checkedAt: (deps.now || Date.now)(),
        claude: {status: claudeStatus, windows: claudeFrom.windows, source: claudeFrom.source || "", message: claudeWeb.message || "", local: {status: local.claude.status}, web: {status: claudeWeb.status}},
        codex: {
            source: codexFrom.source || "", windows: codexFrom.windows, plan: codexFrom.plan || "", recordedAt: codexFrom.recordedAt || null,
            web: {status: codexWeb.status, message: codexWeb.message || ""},
            local: {status: local.codex.status}
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
