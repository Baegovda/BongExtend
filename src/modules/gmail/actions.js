// 로그인된 Gmail 세션의 작업 토큰으로 읽음·보관·삭제를 보낸다.
// Google Cloud OAuth 클라이언트는 쓰지 않는다.

export const GMAIL_ACTIONS = {
    read: "rd",
    archive: "rc_^i",
    trash: "tr"
};

// 크롬 주기 알람의 최소 간격은 1분이다. Gmail 탭이 열려 있으면 그 탭이 더 자주 깨운다.
export const GMAIL_ALARM_MINUTES = 1;
export const GMAIL_TAB_POLL_MS = 10_000;
export const GMAIL_WAKE_FOLLOWUP_MS = 20_000;

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

export const planMailNotifications = (previousIds, messages, hasBaseline) => {
    const ids = (messages || []).map((item) => item.id).filter(Boolean);
    if (!hasBaseline) {
        return {notify: [], seen: ids.slice(-400), baseline: true};
    }
    const prev = new Set(previousIds || []);
    const notify = (messages || []).filter((item) => item.id && !prev.has(item.id));
    const seen = [...new Set([...(previousIds || []), ...ids])].slice(-400);
    return {notify, seen, baseline: true};
};

export const describeGmailLatency = () => ({
    alarmMinutes: GMAIL_ALARM_MINUTES,
    tabPollMs: GMAIL_TAB_POLL_MS,
    followupMs: GMAIL_WAKE_FOLLOWUP_MS,
    withTab: "Gmail 탭이 열려 있으면 제목이 바뀌는 즉시, 그리고 10초마다 확인해요. Gmail이 받은편지함을 갱신하는 시간(보통 몇 초)이 더해져요.",
    withoutTab: "Gmail 탭이 없으면 크롬 알람이 1분에 한 번만 허용돼요. 브라우저로 돌아오거나 자리를 비웠다 돌아오면 그 사이에도 바로 확인해요."
});
