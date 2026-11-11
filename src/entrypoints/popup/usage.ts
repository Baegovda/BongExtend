// 사용량 탭 화면. 값은 백그라운드가 읽어 와서 퍼센트와 초기화 시각만 넘겨줘요.
// @ts-ignore plain JS shared with the background
import {formatReset, remainingLevel, USAGE_SNAPSHOT_KEY} from "@/modules/usage/usage.js";
// @ts-ignore plain JS shared with the background
import {CHATGPT_ORIGIN, CLAUDE_ORIGIN} from "@/modules/usage/background.js";

type Row = {id: string; label: string; remainingPercent: number; usedPercent: number; resetsAt: number | null};
type Snapshot = {
    checkedAt: number;
    claude: {status: string; windows: Row[]; message?: string; source?: string; local?: {status: string}; web?: {status: string}};
    codex: {source: string; windows: Row[]; plan: string; recordedAt: number | null; web: {status: string; message?: string}; local: {status: string}};
};

const REFRESH_MS = 30000;

const NOTES: Record<string, string> = {
    permission: "연결을 허용하면 로그인된 계정의 남은 한도를 볼 수 있어요.",
    login: "웹에서 로그인한 뒤 새로고침해 주세요.",
    empty: "표시할 한도 정보가 아직 없어요.",
    error: "불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.",
    helper: "내 PC에 로그인된 앱의 한도를 보려면 PC 보조 프로그램(다운로더 탭)을 설치하거나 새로 받아 설치해 주세요.",
    none: "이 PC에서 로그인된 앱을 찾지 못했어요. 앱에 로그인해 주세요.",
    expired: "앱 로그인이 만료됐어요. 앱을 한 번 열면 갱신돼요.",
    stale: "PC 기록의 한도가 이미 초기화돼서 지금 값은 알 수 없어요."
};

const el = <T extends HTMLElement = HTMLElement>(tag: string, className = "", text = ""): T => {
    const node = document.createElement(tag) as T;
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
};

function windowRow(row: Row, now: number): HTMLElement {
    const wrap = el("div", `usage-row level-${remainingLevel(row.remainingPercent)}`);
    const head = el("div", "usage-row-head");
    head.append(el("span", "usage-label", row.label), el("strong", "usage-percent", `${Math.round(row.remainingPercent)}% 남음`));
    const bar = el<HTMLProgressElement>("progress", "usage-bar");
    bar.max = 100;
    bar.value = Math.round(row.usedPercent);
    bar.setAttribute("aria-label", `${row.label} 사용 ${Math.round(row.usedPercent)}%`);
    wrap.append(head, bar, el("small", "usage-reset", formatReset(row.resetsAt, now) || "초기화 시각 정보 없음"));
    return wrap;
}

function card(title: string, badge: string, rows: Row[], notes: string[], actions: HTMLElement[], now: number): HTMLElement {
    const box = el("section", "be-card usage-card");
    const head = el("div", "usage-card-head");
    head.append(el("h4", "", title));
    if (badge) head.append(el("span", "usage-badge", badge));
    box.append(head);
    for (const row of rows) box.append(windowRow(row, now));
    for (const note of notes) box.append(el("p", "be-hint usage-note", note));
    if (actions.length) {
        const bar = el("div", "be-actions");
        bar.append(...actions);
        box.append(bar);
    }
    return box;
}

export function setupUsage(onError: (error: unknown) => void) {
    const cards = document.getElementById("usageCards")!;
    const stamp = document.getElementById("usageStamp")!;
    const refreshButton = document.getElementById("usageRefresh") as HTMLButtonElement;
    let timer = 0;
    let visible = false;
    let busy = false;
    let lastSnapshot: Snapshot | null = null;

    const allow = (origins: string[]) => {
        const button = el<HTMLButtonElement>("button", "primary", "연결 허용");
        button.type = "button";
        button.addEventListener("click", async () => {
            button.disabled = true;
            try { await chrome.permissions.request({origins}); } catch (error) { onError(error); }
            await refresh(true);
        });
        return button;
    };

    function render(snapshot: Snapshot) {
        lastSnapshot = snapshot;
        const now = Date.now();
        cards.replaceChildren();

        const claude = snapshot.claude;
        const claudeNotes: string[] = [];
        const claudeActions: HTMLElement[] = [];
        if (!claude.windows.length) {
            if (claude.local && claude.local.status !== "ok") claudeNotes.push(NOTES[claude.local.status] || NOTES.error);
            if (claude.web?.status === "permission") { claudeNotes.push("대신 웹 계정으로 연결할 수도 있어요."); claudeActions.push(allow([CLAUDE_ORIGIN])); }
            else if (claude.web?.status && claude.web.status !== "permission" && !claudeNotes.length) claudeNotes.push(NOTES[claude.web.status] || NOTES.error);
        }
        const claudeBadge = claude.windows.length ? (claude.source === "local" ? "내 PC 로그인" : "웹 계정") : "";
        cards.append(card("Claude", claudeBadge, claude.windows, claudeNotes, claudeActions, now));

        const codex = snapshot.codex;
        const notes: string[] = [];
        const actions: HTMLElement[] = [];
        let badge = "";
        if (codex.windows.length) {
            badge = codex.source === "local" ? "내 PC 로그인" : codex.source === "local-log" ? "PC 기록" : `웹 계정${codex.plan ? ` · ${codex.plan}` : ""}`;
            if (codex.source === "local-log" && codex.recordedAt) notes.push(`마지막 기록 ${new Date(codex.recordedAt).toLocaleString("ko-KR", {month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"})}. Codex를 쓸 때 갱신돼요.`);
        } else {
            if (codex.local.status !== "ok") notes.push(NOTES[codex.local.status] || NOTES.error);
            if (codex.web.status === "permission") { notes.push("대신 웹 계정으로 연결할 수도 있어요."); actions.push(allow([CHATGPT_ORIGIN])); }
        }
        cards.append(card("Codex", badge, codex.windows, notes, actions, now));
        stamp.textContent = `${new Date(snapshot.checkedAt).toLocaleTimeString("ko-KR", {hour: "2-digit", minute: "2-digit", second: "2-digit"})} 확인`;
    }

    async function refresh(force = false) {
        if (busy) return;
        busy = true;
        refreshButton.disabled = true;
        try {
            const reply = await chrome.runtime.sendMessage({type: "usage-get", force});
            if (reply?.disabled) { stamp.textContent = "사용량 기능이 꺼져 있어요."; return; }
            if (reply?.snapshot) render(reply.snapshot as Snapshot);
        } catch (error) { onError(error); }
        finally { busy = false; refreshButton.disabled = false; }
    }

    // 값이 그대로여도 초기화까지 남은 시간은 줄어들어야 해서 저장된 값으로 다시 그려요.
    const tick = () => {
        if (!visible) return;
        if (lastSnapshot) render(lastSnapshot);
        void refresh(false);
    };

    refreshButton.addEventListener("click", () => void refresh(true));
    document.addEventListener("visibilitychange", () => { if (!document.hidden && visible) void refresh(false); });

    return {
        show() {
            visible = true;
            clearInterval(timer);
            timer = window.setInterval(tick, REFRESH_MS);
            void chrome.storage.local.get(USAGE_SNAPSHOT_KEY).then((stored) => { if (stored[USAGE_SNAPSHOT_KEY] && !lastSnapshot) render(stored[USAGE_SNAPSHOT_KEY] as Snapshot); }).catch(() => {});
            void refresh(true);
        },
        hide() { visible = false; clearInterval(timer); }
    };
}
