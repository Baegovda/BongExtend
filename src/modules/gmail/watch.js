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

export const accountEmailKey = (account) => String(account?.email || "").trim().toLowerCase();

// The Atom fullcount can lag behind its entries. The visible unread list is a
// lower bound, while an explicitly empty list means the inbox is now clear.
export const accountUnread = (account) => {
    if (Array.isArray(account?.messages) && account.messages.length === 0) return 0;
    return Math.max(0, Number(account?.unread) || 0, Array.isArray(account?.messages) ? account.messages.length : 0);
};

// 같은 주소는 한 번만 둔다. Gmail 이 /mail/u/N 여러 번호를 같은 계정으로 돌려줘도 목록이 늘어나지 않는다.
// 먼저 본 번호를 유지해서 읽음·보관 주소와 알림 끄기가 그대로다.
export const dedupeAccounts = (accounts) => {
    const seen = new Map();
    const order = [];
    const nameless = [];
    for (const account of accounts || []) {
        const key = accountEmailKey(account);
        if (!key) {
            nameless.push(account);
            continue;
        }
        const prev = seen.get(key);
        if (!prev) {
            seen.set(key, account);
            order.push(key);
            continue;
        }
        const prevCount = Array.isArray(prev.messages) ? prev.messages.length : 0;
        const nextCount = Array.isArray(account.messages) ? account.messages.length : 0;
        if (!prevCount && nextCount) seen.set(key, {...account, index: prev.index, enabled: prev.enabled});
    }
    return [...order.map((key) => seen.get(key)), ...nameless];
};

// 저장된 이메일 순서대로 놓고, 순서에 없는 새 계정은 맨 아래에 둔다.
export const orderAccounts = (accounts, saved) => {
    const unique = dedupeAccounts(accounts);
    const byEmail = new Map();
    const nameless = [];
    for (const account of unique) {
        const key = accountEmailKey(account);
        if (!key) nameless.push(account);
        else if (!byEmail.has(key)) byEmail.set(key, account);
    }
    const used = new Set();
    const ordered = [];
    for (const raw of saved || []) {
        const key = String(raw || "").trim().toLowerCase();
        const account = byEmail.get(key);
        if (!key || !account || used.has(key)) continue;
        used.add(key);
        ordered.push(account);
    }
    for (const account of unique) {
        const key = accountEmailKey(account);
        if (!key || used.has(key)) continue;
        ordered.push(account);
    }
    return [...ordered, ...nameless];
};

export const isDuplicateEmail = (accounts, account) => {
    const key = accountEmailKey(account);
    if (!key) return false;
    return (accounts || []).some((item) => accountEmailKey(item) === key);
};

export const enabledAccounts = (accounts, disabled) => {
    const off = new Set((disabled || []).map(Number));
    return (accounts || []).filter((account) => !off.has(Number(account.index)));
};

export const unreadOf = (accounts, disabled) =>
    enabledAccounts(accounts, disabled).reduce((sum, account) => sum + accountUnread(account), 0);

// 탭 배지. 같은 주소는 한 번만 더하고, 알림을 끈 계정은 빼며, 0은 빈 글자, 100부터는 99+.
export const mailTabBadge = (accounts, disabled) => {
    const off = new Set((disabled || []).map(Number));
    const count = dedupeAccounts(accounts)
        .filter((account) => account?.enabled !== false && !off.has(Number(account?.index)))
        .reduce((sum, account) => sum + accountUnread(account), 0);
    if (count <= 0) return "";
    if (count > 99) return "99+";
    return String(Math.floor(count));
};

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

const pad2 = (value) => String(value).padStart(2, "0");

// 받은 시각. 오늘이면 HH:mm, 그 외에는 M/D HH:mm. 사용자 기기의 시각이다.
export const formatMailTime = (issued, now = Date.now()) => {
    const time = Date.parse(issued);
    if (!Number.isFinite(time)) return "";
    const date = new Date(time);
    const today = new Date(now);
    const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    const sameDay = date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate();
    if (sameDay) return clock;
    return `${date.getMonth() + 1}/${date.getDate()} ${clock}`;
};

// 이름과 주소가 다르면 둘 다. 하나만 있으면 그 한 줄만.
export const mailSenderLines = (message) => {
    const name = String(message?.fromName || "").trim();
    const email = String(message?.fromEmail || "").trim();
    const same = name && email && name.toLowerCase() === email.toLowerCase();
    if (name && email && !same) return {name, email};
    if (name) return {name, email: ""};
    if (email) return {name: email, email: ""};
    return {name: "보낸 사람 없음", email: ""};
};

// 작업 토큰을 못 읽어도 이미 받아 둔 받은편지함은 남긴다. 로그아웃은 빈 목록이 맞다.
export const preferInbox = (next, previous) => {
    if (next?.loggedOut) return next;
    if (Array.isArray(next?.accounts) && next.accounts.length) return next;
    if (previous) return previous;
    return next ?? null;
};
