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

const usable = (value, min) => {
    const text = String(value || "");
    return text.length >= min && text !== "null" && text !== "undefined";
};

const firstUsable = (source, pattern, min) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let match;
    while ((match = re.exec(source))) {
        if (usable(match[1], min)) return match[1];
    }
    return "";
};

// 지금 Gmail HTML은 GM_ACTION_TOKEN="null" 이 먼저 나오고, 실제 값은 뒤에나 sdpc 안에 있다.
export const parseGmailTokens = (html) => {
    const source = String(html || "");
    const token = firstUsable(source, /GM_ACTION_TOKEN\s*=\s*['"]([^'"]+)['"]/gi, 4)
        || firstUsable(source, /\["sdpc"\s*,\s*"([^"]+)"\]/gi, 8)
        || firstUsable(source, /"sdpc"\s*,\s*"([^"]+)"/gi, 8);
    const ik = firstUsable(source, /GM_ID_KEY\s*=\s*['"]([^'"]+)['"]/gi, 2)
        || firstUsable(source, /[?&]ik=([a-z0-9]+)/gi, 4)
        || firstUsable(source, /"ik"\s*,\s*"([a-z0-9]+)"/gi, 4);
    if (!token || !ik) return null;
    return {at: token, ik};
};

const PHOTO_IN_PAGE = /https:\/\/lh3\.googleusercontent\.com\/a(?:-\/|\/)[A-Za-z0-9_\-=]+/gi;
const PHOTO_ON_GMAIL = /https:\/\/mail\.google\.com\/mail\/u\/\d+\/[^"'\\\s<>]*photo[^"'\\\s<>]*/gi;

// 이미 받는 Gmail HTML 안의 프로필 사진 주소. 다른 호스트 권한은 늘리지 않는다.
export const profileFromHtml = (html, knownEmail = "") => {
    const source = String(html || "");
    const known = String(knownEmail || "").trim();
    const email = known || (source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
    const photos = [...source.matchAll(PHOTO_IN_PAGE), ...source.matchAll(PHOTO_ON_GMAIL)].map((match) => ({
        url: match[0],
        at: match.index || 0
    }));
    if (!photos.length) return {photo: "", email};
    const at = email ? source.toLowerCase().indexOf(email.toLowerCase()) : -1;
    if (at < 0) return {photo: photos[0].url, email};
    photos.sort((a, b) => Math.abs(a.at - at) - Math.abs(b.at - at));
    return {photo: photos[0].url, email};
};

export const photoCredentials = (url) => String(url || "").startsWith("https://mail.google.com/") ? "include" : "omit";

export const readProfilePhoto = async (fetchImpl, html, knownEmail = "") => {
    const profile = profileFromHtml(html, knownEmail);
    if (!profile.photo || !profile.email) return {email: profile.email, photo: ""};
    try {
        const response = await fetchImpl(profile.photo, {credentials: photoCredentials(profile.photo)});
        if (!response?.ok || typeof response.blob !== "function") return {email: profile.email, photo: ""};
        const blob = await response.blob();
        if (!String(blob.type || "").startsWith("image/") || blob.size > 120000) return {email: profile.email, photo: ""};
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return {email: profile.email, photo: `data:${blob.type};base64,${btoa(binary)}`};
    } catch {
        return {email: profile.email, photo: ""};
    }
};

export const tokenPageUrls = (index) => {
    const n = Number(index) || 0;
    return [
        `https://mail.google.com/mail/u/${n}/`,
        `https://mail.google.com/mail/u/${n}/?ui=2&view=tl&start=0&num=1`
    ];
};

// 한 계정의 받은편지함에서 읽음으로 바꿀 메일 번호. 같은 번호는 한 번만 보낸다.
export const inboxThreads = (account) =>
    [...new Set((account?.messages || []).map((item) => item?.thread).filter(Boolean))];

const TOKEN_MISS = "Gmail 작업 토큰을 아직 받지 못했어요. 메일 목록은 그대로예요. 잠시 뒤 다시 시도해 주세요.";

// 토큰과 전송은 넘겨받은 함수만 쓴다. 실패해도 예외를 던지지 않아서 목록을 지우지 않는다.
export const markInboxRead = async (accountIndex, threads, deps) => {
    const list = [...new Set((threads || []).filter(Boolean))];
    const fetchImpl = deps?.fetchImpl;
    const tokensFor = deps?.tokensFor;
    if (typeof fetchImpl !== "function" || typeof tokensFor !== "function") {
        return {ok: false, acted: 0, error: "메일을 바꾸지 못했어요."};
    }
    let tokens = null;
    let acted = 0;
    const loadTokens = async (fresh) => {
        try { return await tokensFor(accountIndex, fresh); }
        catch { return null; }
    };
    for (const thread of list) {
        if (!tokens?.at || !tokens?.ik) tokens = await loadTokens(false);
        if (!tokens?.at || !tokens?.ik) return {ok: false, acted, error: TOKEN_MISS};
        let ok = false;
        try {
            ok = await sendMailAction(actionRequest(accountIndex, tokens, "read", thread), fetchImpl);
            if (!ok) {
                tokens = await loadTokens(true);
                if (tokens?.at && tokens?.ik) ok = await sendMailAction(actionRequest(accountIndex, tokens, "read", thread), fetchImpl);
            }
        } catch {
            ok = false;
        }
        if (!ok) return {ok: false, acted, error: "Gmail에 반영하지 못했어요. 로그인 상태를 확인해 주세요."};
        acted += 1;
    }
    return {ok: true, acted, error: ""};
};

export const sendMailAction = async (request, fetchImpl = globalThis.fetch) => {
    const response = await fetchImpl(request.url, {
        method: "POST",
        credentials: "include",
        redirect: "follow",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: request.body
    });
    const finalUrl = response.url || "";
    return Boolean(response.ok && !String(finalUrl).includes("accounts.google.com"));
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
