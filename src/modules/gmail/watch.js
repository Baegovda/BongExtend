// 메일 감시 간격. 크롬 알람은 1분 아래가 안 되므로 쓰지 않고, 오프스크린 문서의 타이머를 쓴다.

export const GMAIL_INTERVAL_DEFAULT_MS = 8000;
export const GMAIL_INTERVAL_MIN_MS = 5000;
export const GMAIL_INTERVAL_MAX_MS = 60000;
export const GMAIL_IDLE_MS = 60000;
export const GMAIL_LOCKED_MS = 120000;
export const GMAIL_OFFLINE_MS = 60000;
export const ACCOUNT_PROBE_LIMIT = 8;

export const clampIntervalMs = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return GMAIL_INTERVAL_DEFAULT_MS;
    return Math.min(GMAIL_INTERVAL_MAX_MS, Math.max(GMAIL_INTERVAL_MIN_MS, Math.round(number)));
};

// 0이면 감시를 완전히 멈춘다. 알림이 꺼져 있거나 메일 모듈이 꺼진 경우다.
export const nextWaitMs = ({notify, moduleOn, online, idle, intervalMs}) => {
    if (moduleOn === false || notify === false) return 0;
    if (online === false) return GMAIL_OFFLINE_MS;
    if (idle === "locked") return GMAIL_LOCKED_MS;
    if (idle === "idle") return GMAIL_IDLE_MS;
    return clampIntervalMs(intervalMs);
};

export const enabledAccounts = (accounts, disabled) => {
    const off = new Set((disabled || []).map(Number));
    return (accounts || []).filter((account) => !off.has(Number(account.index)));
};

export const unreadOf = (accounts, disabled) =>
    enabledAccounts(accounts, disabled).reduce((sum, account) => sum + (Number(account.unread) || 0), 0);

export const inboxSignature = (accounts) =>
    (accounts || []).map((account) => {
        if (account.kept) return `${account.index}:kept`;
        const ids = (account.messages || []).map((message) => message.id).join(",");
        return `${account.index}:${account.unread}:${ids}`;
    }).join("|");

// 꺼 둔 계정은 주소를 이미 알면 피드를 다시 받지 않는다.
export const skipDisabledFetch = (index, disabled, knownEmail) => {
    const off = new Set((disabled || []).map(Number));
    return off.has(Number(index)) && Boolean(knownEmail);
};

// 받은편지함이 그대로면 메일 본문은 빼고 숫자만 보낸다.
export const watchPayload = (accounts, changed) =>
    (accounts || []).map((account) => {
        if (account.kept) return {index: account.index, email: account.email || "", kept: true};
        if (!changed) return {index: account.index, email: account.email || "", unread: Number(account.unread) || 0};
        return account;
    });

export const notificationTitle = (message, account) => {
    const who = message?.fromName || message?.fromEmail || "새 메일";
    const mail = account?.email || `계정 ${(Number(account?.index) || 0) + 1}`;
    return `${who} · ${mail}`;
};

export const notificationId = (message) =>
    `gmail-${Number(message?.account) || 0}-${message?.id || ""}`;
