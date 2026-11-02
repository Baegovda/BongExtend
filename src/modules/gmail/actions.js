// 로그인된 Gmail 세션의 작업 토큰으로 읽음·보관·삭제를 보낸다.
// Google Cloud OAuth 클라이언트는 쓰지 않는다.

export const GMAIL_ACTIONS = {
    read: "rd",
    archive: "rc_^i",
    trash: "tr"
};

// 새 메일 확인은 오프스크린 문서가 한다. 알람은 그 문서가 꺼졌을 때만 다시 켠다.
export const GMAIL_ALARM_MINUTES = 1;
export const GMAIL_TAB_POLL_MS = 0;

export const parseGmailTokens = (html) => {
    const source = String(html || "");
    const token = (source.match(/GM_ACTION_TOKEN\s*=\s*['"]([^'"]+)['"]/) || [])[1] || "";
    const ik = (source.match(/GM_ID_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1] || "";
    if (!token || token === "null" || !ik || ik === "null") return null;
    return {at: token, ik};
};

export const actionRequest = (accountIndex, tokens, action, thread) => {
    const act = GMAIL_ACTIONS[action];
    if (!act) throw new Error("알 수 없는 메일 작업이에요.");
    if (!tokens?.at || !tokens?.ik) throw new Error("Gmail 작업 토큰이 없어요.");
    if (!thread) throw new Error("메일 번호를 찾지 못했어요.");
    const index = Number(accountIndex) || 0;
    const url = `https://mail.google.com/mail/u/${index}/?ui=2&ik=${encodeURIComponent(tokens.ik)}&view=up`;
    const body = new URLSearchParams({
        act,
        at: tokens.at,
        t: thread,
        th: thread
    });
    return {url, body: body.toString()};
};

// 계정마다 메일 번호가 겹칠 수 있어서, 본 적 있는 메일은 계정 번호를 붙여 기억한다.
export const mailSeenKey = (item) => {
    if (!item?.id) return "";
    if (item.account == null || item.account === "") return String(item.id);
    return `${Number(item.account)}:${item.id}`;
};

export const planMailNotifications = (previousIds, messages, hasBaseline) => {
    const list = messages || [];
    const ids = list.map(mailSeenKey).filter(Boolean);
    if (!hasBaseline) {
        return {notify: [], seen: ids.slice(-400), baseline: true};
    }
    const prev = new Set(previousIds || []);
    const notify = list.filter((item) => {
        const key = mailSeenKey(item);
        if (!key) return false;
        if (prev.has(key) || prev.has(item.id)) return false;
        return true;
    });
    const seen = [...new Set([...(previousIds || []), ...ids])].slice(-400);
    return {notify, seen, baseline: true};
};

export const describeGmailLatency = () => ({
    alarmMinutes: GMAIL_ALARM_MINUTES,
    tabPollMs: GMAIL_TAB_POLL_MS,
    withTab: "Gmail 탭이 열려 있으면 제목이 바뀌는 즉시 확인해요.",
    withoutTab: "Gmail 탭이 없어도 로그인된 계정을 모두, 기본 8초마다 받은편지함 피드만 확인해요. 간격은 5초에서 60초 사이로 바꿀 수 있어요. 자리를 비우거나 화면이 잠기면 더 느리게 보고, 알림을 끄면 확인을 멈춥니다."
});
