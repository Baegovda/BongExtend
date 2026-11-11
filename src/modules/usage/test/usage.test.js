import assert from "node:assert/strict";
import test from "node:test";
import {chooseCodex, formatReset, makeWindow, parseChatgptUsage, parseClaudeUsage, parseCodexLocal, remainingLevel, windowLabel} from "../usage.js";
import {fetchClaude, fetchCodexWeb, fetchLocalUsage, loadUsage} from "../background.js";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const granted = {contains: async () => true};
const denied = {contains: async () => false};
const json = (body, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => body});

test("window labels and remaining percent", () => {
    assert.equal(windowLabel(300), "5시간");
    assert.equal(windowLabel(10080), "주간");
    assert.equal(windowLabel(1440), "1일");
    assert.equal(windowLabel(90), "90분");
    const row = makeWindow({id: "a", label: "x", usedPercent: 37.25, resetsAt: NOW});
    assert.equal(row.remainingPercent, 62.8);
    assert.equal(makeWindow({id: "a", label: "x", usedPercent: 150}).remainingPercent, 0);
    assert.equal(makeWindow({id: "a", label: "x", usedPercent: "oops"}), null);
    assert.equal(makeWindow({id: "a", label: "x", usedPercent: null}), null);
});

test("claude usage keeps known windows in order and ignores unrelated fields", () => {
    const rows = parseClaudeUsage({
        seven_day: {utilization: 20, resets_at: "2026-11-15T00:00:00Z"},
        five_hour: {utilization: 55.5, resets_at: "2026-11-11T14:00:00Z"},
        extra_usage: {is_enabled: false},
        seven_day_opus: null,
        name: "x"
    });
    assert.deepEqual(rows.map((row) => [row.id, row.label, row.remainingPercent]), [["five_hour", "5시간", 44.5], ["seven_day", "주간", 80]]);
    assert.equal(rows[0].resetsAt, Date.parse("2026-11-11T14:00:00Z"));
    assert.deepEqual(parseClaudeUsage(null), []);
});

test("chatgpt usage uses reset_at, falls back to reset_after_seconds", () => {
    const parsed = parseChatgptUsage({plan_type: "pro", rate_limit: {
        primary_window: {used_percent: 12, limit_window_seconds: 18000, reset_after_seconds: 600},
        secondary_window: {used_percent: 80, limit_window_seconds: 604800, reset_at: 1794600000}
    }}, NOW);
    assert.equal(parsed.plan, "pro");
    assert.deepEqual(parsed.windows.map((row) => [row.label, row.remainingPercent]), [["5시간", 88], ["주간", 20]]);
    assert.equal(parsed.windows[0].resetsAt, NOW + 600000);
    assert.equal(parsed.windows[1].resetsAt, 1794600000 * 1000);
    assert.deepEqual(parseChatgptUsage({}, NOW).windows, []);
});

test("local codex limits drop windows that already reset", () => {
    const future = Math.floor(NOW / 1000) + 3600, past = Math.floor(NOW / 1000) - 60;
    const fresh = parseCodexLocal({primary: {used_percent: 30, window_minutes: 300, resets_at: future}, secondary: {used_percent: 5, window_minutes: 10080, resets_at: past}, recordedAt: "2026-11-11T11:00:00Z"}, NOW);
    assert.deepEqual(fresh.windows.map((row) => row.label), ["5시간"]);
    assert.equal(fresh.stale, false);
    const stale = parseCodexLocal({primary: {used_percent: 30, window_minutes: 300, resets_at: past}}, NOW);
    assert.equal(stale.stale, true);
    assert.deepEqual(stale.windows, []);
});

test("web codex values win over local records", () => {
    const web = {plan: "pro", windows: [makeWindow({id: "p", label: "5시간", usedPercent: 1})]};
    const local = {windows: [makeWindow({id: "p", label: "5시간", usedPercent: 99})], recordedAt: 5};
    assert.equal(chooseCodex(web, local).source, "web");
    assert.equal(chooseCodex({windows: []}, local).source, "local");
    assert.equal(chooseCodex({windows: []}, {windows: []}).source, "");
});

test("reset time wording", () => {
    assert.equal(formatReset(NOW + 30 * 60000, NOW), "30분 후 초기화");
    assert.equal(formatReset(NOW + 135 * 60000, NOW), "2시간 15분 후 초기화");
    assert.equal(formatReset(NOW + 50 * 3600000, NOW), "2일 2시간 후 초기화");
    assert.equal(formatReset(NOW - 1, NOW), "곧 초기화돼요");
    assert.equal(formatReset(null, NOW), "");
    assert.equal(remainingLevel(5), "low");
    assert.equal(remainingLevel(25), "mid");
    assert.equal(remainingLevel(80), "ok");
});

test("claude fetch needs permission, then finds the org and reads usage without sending tokens elsewhere", async () => {
    assert.equal((await fetchClaude({permissions: denied, fetchImpl: async () => assert.fail("no request without permission")})).status, "permission");
    const urls = [];
    const fetchImpl = async (url) => {
        urls.push(url);
        if (url.endsWith("/api/organizations")) return json([{uuid: "11111111-2222-3333-4444-555555555555"}]);
        return json({five_hour: {utilization: 10, resets_at: "2026-11-11T15:00:00Z"}});
    };
    const result = await fetchClaude({permissions: granted, fetchImpl});
    assert.equal(result.status, "ok");
    assert.deepEqual(urls, ["https://claude.ai/api/organizations", "https://claude.ai/api/organizations/11111111-2222-3333-4444-555555555555/usage"]);
    assert.equal((await fetchClaude({permissions: granted, fetchImpl: async () => json({}, 403)})).status, "login");
    assert.equal((await fetchClaude({permissions: granted, fetchImpl: async () => json([{uuid: "../evil"}])})).status, "login");
    assert.equal((await fetchClaude({permissions: granted, fetchImpl: async () => { throw new Error("down"); }})).status, "error");
});

test("chatgpt fetch uses the session token only for the usage request", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({url, auth: init.headers.Authorization});
        if (url.endsWith("/api/auth/session")) return json({accessToken: "secret-token"});
        return json({rate_limit: {primary_window: {used_percent: 20, limit_window_seconds: 18000, reset_after_seconds: 60}}});
    };
    const result = await fetchCodexWeb({permissions: granted, fetchImpl, now: () => NOW});
    assert.equal(result.status, "ok");
    assert.equal(calls[0].auth, undefined);
    assert.equal(calls[1].auth, "Bearer secret-token");
    assert.equal(JSON.stringify(result).includes("secret-token"), false);
    assert.equal((await fetchCodexWeb({permissions: granted, fetchImpl: async () => json({})})).status, "login");
    assert.equal((await fetchCodexWeb({permissions: denied})).status, "permission");
});

const future = () => Math.floor(NOW / 1000) + 600;
const nativeReply = (reply) => ({lastError: undefined, sendNativeMessage: (_h, message, cb) => { assert.equal(message.type, "usage-local"); cb(reply); }});

test("local usage reports a missing or outdated helper", async () => {
    const missing = {lastError: {message: "Specified native messaging host not found."}, sendNativeMessage: (_h, _m, cb) => cb(undefined)};
    const local = await fetchLocalUsage({runtime: missing, now: () => NOW});
    assert.equal(local.claude.status, "helper");
    assert.equal(local.codex.status, "helper");
    const outdated = await fetchLocalUsage({runtime: nativeReply({type: "error", message: "지원하지 않는 요청이에요."}), now: () => NOW});
    assert.equal(outdated.claude.status, "helper");
});

test("local usage parses the logged-in Claude and Codex apps", async () => {
    const local = await fetchLocalUsage({now: () => NOW, runtime: nativeReply({
        type: "usage-local",
        claude: {status: "ok", usage: {five_hour: {utilization: 30, resets_at: "2026-11-11T15:00:00Z"}}},
        codex: {api: {status: "ok", data: {plan_type: "pro", rate_limit: {primary_window: {used_percent: 20, limit_window_seconds: 18000, reset_after_seconds: 60}}}}, log: {type: "codex-usage", empty: true}}
    })});
    assert.equal(local.claude.status, "ok");
    assert.equal(local.claude.windows[0].remainingPercent, 70);
    assert.equal(local.codex.status, "ok");
    assert.equal(local.codex.api.windows[0].remainingPercent, 80);
    const states = await fetchLocalUsage({now: () => NOW, runtime: nativeReply({type: "usage-local", claude: {status: "expired"}, codex: {api: {status: "none"}, log: {type: "codex-usage", empty: true}}})});
    assert.equal(states.claude.status, "expired");
    assert.equal(states.codex.status, "none");
});

test("loadUsage prefers the PC login over the web account", async () => {
    const fetchImpl = async (url) => {
        if (url.endsWith("/api/organizations")) return json([{uuid: "11111111-2222-3333-4444-555555555555"}]);
        if (url.includes("claude.ai") && url.endsWith("/usage")) return json({five_hour: {utilization: 90, resets_at: "2026-11-11T15:00:00Z"}});
        if (url.endsWith("/api/auth/session")) return json({accessToken: "t"});
        return json({rate_limit: {primary_window: {used_percent: 90, limit_window_seconds: 18000, reset_after_seconds: 60}}});
    };
    const runtime = nativeReply({type: "usage-local",
        claude: {status: "ok", usage: {five_hour: {utilization: 10, resets_at: "2026-11-11T15:00:00Z"}}},
        codex: {api: {status: "ok", data: {rate_limit: {primary_window: {used_percent: 25, limit_window_seconds: 18000, reset_after_seconds: 60}}}}, log: {type: "codex-usage", primary: {used_percent: 99, window_minutes: 300, resets_at: future()}}}});
    const snapshot = await loadUsage({fetchImpl, permissions: granted, runtime, now: () => NOW});
    assert.equal(snapshot.claude.source, "local");
    assert.equal(snapshot.claude.windows[0].remainingPercent, 90, "web value 10% remaining is ignored");
    assert.equal(snapshot.codex.source, "local");
    assert.equal(snapshot.codex.windows[0].remainingPercent, 75);
});

test("loadUsage falls back to the Codex log, then to the web account", async () => {
    const webOnly = async (url) => {
        if (url.endsWith("/api/organizations")) return json([{uuid: "11111111-2222-3333-4444-555555555555"}]);
        if (url.includes("claude.ai") && url.endsWith("/usage")) return json({five_hour: {utilization: 40, resets_at: "2026-11-11T15:00:00Z"}});
        if (url.endsWith("/api/auth/session")) return json({accessToken: "t"});
        return json({rate_limit: {primary_window: {used_percent: 50, limit_window_seconds: 18000, reset_after_seconds: 60}}});
    };
    const log = nativeReply({type: "usage-local", claude: {status: "none"}, codex: {api: {status: "expired"}, log: {type: "codex-usage", primary: {used_percent: 60, window_minutes: 300, resets_at: future()}, recordedAt: "2026-11-11T11:00:00Z"}}});
    const fromLog = await loadUsage({fetchImpl: webOnly, permissions: granted, runtime: log, now: () => NOW});
    assert.equal(fromLog.codex.source, "local-log");
    assert.equal(fromLog.claude.source, "web", "Claude has no local login, so the web account is used");
    const noHelper = {lastError: {message: "missing"}, sendNativeMessage: (_h, _m, cb) => cb(undefined)};
    const web = await loadUsage({fetchImpl: webOnly, permissions: granted, runtime: noHelper, now: () => NOW});
    assert.equal(web.codex.source, "web");
    assert.equal(web.claude.source, "web");
    const nothing = await loadUsage({fetchImpl: async () => json({}, 403), permissions: denied, runtime: noHelper, now: () => NOW});
    assert.equal(nothing.claude.windows.length, 0);
    assert.equal(nothing.claude.local.status, "helper");
    assert.equal(nothing.codex.local.status, "helper");
});
