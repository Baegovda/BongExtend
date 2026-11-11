// Claude와 Codex(ChatGPT)의 사용 한도를 같은 모양으로 바꿔요.
// 한도 퍼센트와 초기화 시각만 다루고, 로그인 토큰이나 대화 내용은 저장하지 않아요.

export const USAGE_SNAPSHOT_KEY = "usage.snapshot";
export const USAGE_SOURCES = ["claude", "codex"];

const finite = (value) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value));
export const clampPercent = (value) => Math.min(100, Math.max(0, Number(value)));

export function windowLabel(minutes) {
    const total = Number(minutes);
    if (!Number.isFinite(total) || total <= 0) return "사용량";
    if (total === 300) return "5시간";
    if (total >= 10000 && total <= 10200) return "주간";
    if (total % 1440 === 0) return `${total / 1440}일`;
    if (total % 60 === 0) return `${total / 60}시간`;
    return `${Math.round(total)}분`;
}

// 사용한 퍼센트(0~100)와 초기화 시각(ms)으로 한 줄 만들기. 퍼센트를 모르면 null.
export function makeWindow({id, label, usedPercent, resetsAt}) {
    if (!finite(usedPercent)) return null;
    const used = clampPercent(usedPercent);
    const reset = finite(resetsAt) && Number(resetsAt) > 0 ? Number(resetsAt) : null;
    return {id: String(id), label: String(label), usedPercent: Math.round(used * 10) / 10, remainingPercent: Math.round((100 - used) * 10) / 10, resetsAt: reset};
}

const isoMs = (value) => {
    if (typeof value !== "string") return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
};

const CLAUDE_LABELS = {
    five_hour: ["5시간", 0],
    seven_day: ["주간", 1],
    seven_day_opus: ["주간 Opus", 2],
    seven_day_sonnet: ["주간 Sonnet", 3]
};

// claude.ai 사용량 응답. 퍼센트(utilization)와 초기화 시각(resets_at)이 있는 항목만 쓰고, 모르는 항목도 키 이름으로 보여줘요.
export function parseClaudeUsage(json) {
    if (!json || typeof json !== "object") return [];
    const rows = [];
    for (const [key, value] of Object.entries(json)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const known = CLAUDE_LABELS[key];
        const row = makeWindow({id: key, label: known ? known[0] : key.replace(/_/g, " "), usedPercent: value.utilization, resetsAt: isoMs(value.resets_at)});
        if (row) rows.push({row, order: known ? known[1] : 99});
    }
    return rows.sort((a, b) => a.order - b.order).map((entry) => entry.row);
}

const chatgptWindow = (id, value, now) => {
    if (!value || typeof value !== "object") return null;
    let resetsAt = null;
    if (finite(value.reset_at) && Number(value.reset_at) > 0) resetsAt = Number(value.reset_at) * 1000;
    else if (finite(value.reset_after_seconds)) resetsAt = now + Number(value.reset_after_seconds) * 1000;
    const minutes = finite(value.limit_window_seconds) ? Number(value.limit_window_seconds) / 60 : null;
    return makeWindow({id, label: windowLabel(minutes), usedPercent: value.used_percent, resetsAt});
};

// chatgpt.com의 Codex 사용량 응답.
export function parseChatgptUsage(json, now = Date.now()) {
    const limit = json?.rate_limit || json?.rate_limits;
    if (!limit || typeof limit !== "object") return {plan: "", windows: []};
    const windows = [chatgptWindow("primary", limit.primary_window, now), chatgptWindow("secondary", limit.secondary_window, now)].filter(Boolean);
    return {plan: typeof json.plan_type === "string" ? json.plan_type : "", windows};
}

const localWindow = (id, value) => {
    if (!value || typeof value !== "object") return null;
    return makeWindow({id, label: windowLabel(value.window_minutes), usedPercent: value.used_percent, resetsAt: finite(value.resets_at) ? Number(value.resets_at) * 1000 : null});
};

// 보조 프로그램이 PC의 Codex 기록에서 읽어 온 마지막 한도. 이미 초기화 시각이 지난 줄은 오래된 값이라 빼요.
export function parseCodexLocal(reply, now = Date.now()) {
    if (!reply || typeof reply !== "object") return {windows: [], stale: false, recordedAt: null};
    const all = [localWindow("primary", reply.primary), localWindow("secondary", reply.secondary)].filter(Boolean);
    const windows = all.filter((row) => row.resetsAt == null || row.resetsAt > now);
    const recorded = isoMs(reply.recordedAt);
    return {windows, stale: all.length > 0 && windows.length === 0, recordedAt: recorded};
}

// 한 줄 요약. 웹 값이 있으면 웹 값을, 없으면 PC 기록을 써요.
export function chooseCodex(web, local) {
    if (web?.windows?.length) return {source: "web", windows: web.windows, plan: web.plan || "", recordedAt: null};
    if (local?.windows?.length) return {source: "local", windows: local.windows, plan: "", recordedAt: local.recordedAt || null};
    return {source: "", windows: [], plan: "", recordedAt: null};
}

// 초기화까지 남은 시간.
export function formatReset(resetsAt, now = Date.now()) {
    if (!finite(resetsAt) || Number(resetsAt) <= 0) return "";
    const diff = Number(resetsAt) - now;
    if (diff <= 0) return "곧 초기화돼요";
    const minutes = Math.ceil(diff / 60000);
    if (minutes < 60) return `${minutes}분 후 초기화`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 ${minutes % 60}분 후 초기화`;
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간 후 초기화`;
}

// 남은 퍼센트에 따른 단계. 화면 색을 정할 때만 써요.
export function remainingLevel(remainingPercent) {
    const value = Number(remainingPercent);
    if (!Number.isFinite(value)) return "unknown";
    if (value <= 10) return "low";
    if (value <= 30) return "mid";
    return "ok";
}
