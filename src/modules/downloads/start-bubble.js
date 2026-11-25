// 다운로드가 시작되면 도구막대의 BongExtend 아이콘 바로 아래에 "파일명(용량) 다운로드가 시작!" 말풍선을 띄워요.
// 확장 프로그램 창(action popup)이 아이콘 아래에 붙어 열리는 것을 써요. 잠깐 말풍선 화면(bubble.html)으로 바꿔 열고 곧바로 원래 화면으로 되돌려요.
// 브라우저 확장 배경 코드라 JavaScript로 써요(크롬 안에서는 이것만 돼요).

export const BUBBLE_KEY = "core.download:startBubble";
export const BUBBLE_PAGE = "bubble.html";
// 이 시간 안에 또 시작한 다운로드는 같은 말풍선에 "외 N개"로 묶어요.
export const BUBBLE_GROUP_MS = 4000;
// 파일 이름이 정해지길 기다리는 최대 시간. 그 뒤엔 이름 없이 알리지 않고 그냥 넘어가요.
const NAME_WAIT_MS = 15000;

export const bubbleSize = (n) => !Number.isFinite(n) || n <= 0 ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;

export const bubbleName = (item) => String(item?.filename || "").replace(/\\/g, "/").split("/").pop() || "";

// 말풍선 글: "파일명(용량) 다운로드가 시작!" — 여러 개면 "파일명(용량) 외 2개 다운로드가 시작!"
export function bubbleText(entries) {
    const list = Array.isArray(entries) ? entries.filter((entry) => entry?.name) : [];
    if (!list.length) return "";
    const last = list[list.length - 1];
    const head = last.size ? `${last.name}(${last.size})` : last.name;
    return list.length > 1 ? `${head} 외 ${list.length - 1}개 다운로드가 시작!` : `${head} 다운로드가 시작!`;
}

// 말풍선이 누르면 열 BongExtend 탭: 다운로드 → 다운로더, 메일 → 메일.
export const BUBBLE_TABS = {download: "download", mail: "gmail"};

/**
 * 아이콘 아래 말풍선 띄우기(다운로드·메일이 같이 써요).
 * @param {object} deps
 * @param {typeof chrome} [deps.api]
 * @param {string} [deps.defaultPopup]
 * @param {() => number} [deps.now]
 */
export function createBubbleOpener({api = chrome, defaultPopup = "popup.html", now = Date.now} = {}) {
    let opening = Promise.resolve();
    const popupOpen = async () => {
        try {
            const contexts = await api.runtime.getContexts?.({contextTypes: ["POPUP"]});
            return (contexts || []).map((context) => String(context.documentUrl || ""));
        } catch { return []; }
    };
    const open = async (bubble) => {
        const urls = await popupOpen();
        // 말풍선이 이미 떠 있으면 저장된 글이 바뀌는 것을 보고 스스로 고쳐 써요.
        if (urls.some((url) => url.includes(BUBBLE_PAGE))) return "updated";
        // BongExtend 창을 열어 둔 상태면 그 창 안에 말풍선을 띄워요.
        if (urls.length) { await api.runtime.sendMessage({type: "download-start-bubble", text: bubble.text, kind: bubble.kind}).catch(() => {}); return "in-popup"; }
        const win = await api.windows.getLastFocused({windowTypes: ["normal"]}).catch(() => null);
        if (!win?.id || !win.focused || win.state === "minimized") return "no-window";
        try {
            await api.action.setPopup({popup: BUBBLE_PAGE});
            await api.action.openPopup({windowId: win.id});
            return "opened";
        } catch { return "failed"; }
        finally { await api.action.setPopup({popup: defaultPopup}).catch(() => {}); }
    };
    return async ({kind = "download", text} = {}) => {
        if (!text) return "skip";
        const bubble = {kind: BUBBLE_TABS[kind] ? kind : "download", text: String(text).slice(0, 300), at: now()};
        await api.storage.session.set({[BUBBLE_KEY]: bubble}).catch(() => {});
        // 열기는 한 번에 하나씩 해요(창 화면 바꾸기가 겹치지 않게).
        const result = opening.then(() => open(bubble));
        opening = result.catch(() => {});
        return result;
    };
}

/**
 * @param {object} deps
 * @param {typeof chrome} [deps.api]
 * @param {() => Promise<{moduleOn: boolean, startBubble: boolean, startSound?: string}>} deps.readSettings
 * @param {(id: number) => boolean} [deps.isQuiet] 알리지 않을 다운로드(쇼핑 사진 묶음 받기)
 * @param {(bubble: {kind: string, text: string}) => Promise<string>} [deps.showBubble]
 * @param {(sound: {name: string, volume: number}) => Promise<unknown>} [deps.playSound] 시작 소리
 * @param {() => number} [deps.now]
 */
export function createStartBubble({api = chrome, readSettings, isQuiet = () => false, now = Date.now, defaultPopup = "popup.html", retryMs = [1500, 5000], showBubble, playSound = async () => false} = {}) {
    const waiting = new Map(); // 이름이 아직 안 정해진 다운로드 id → 시작 시각
    const shown = new Set();
    let entries = [];
    let lastAt = 0;
    const bubbleOut = showBubble || createBubbleOpener({api, defaultPopup, now});

    const show = async (item) => {
        if (!item || shown.has(item.id) || isQuiet(item.id)) return "skip";
        const name = bubbleName(item);
        if (!name) return "no-name";
        waiting.delete(item.id);
        shown.add(item.id);
        if (shown.size > 200) shown.delete(shown.values().next().value);
        const settings = await readSettings().catch(() => null);
        if (!settings?.moduleOn || !settings.startBubble) return "off";
        const at = now();
        if (at - lastAt > BUBBLE_GROUP_MS) entries = [];
        lastAt = at;
        entries = [...entries, {name, size: bubbleSize(item.totalBytes)}].slice(-20);
        if (settings.startSound) void Promise.resolve(playSound({name: settings.startSound, volume: 0.6})).catch(() => {});
        return bubbleOut({kind: "download", text: bubbleText(entries)});
    };

    const recent = (item) => {
        // 배경에 함께 도는 메일 엔진이 Date.parse 를 바꿔 놔서 getTime() 으로 읽어요.
        const start = new Date(item?.startTime || "").getTime();
        return !Number.isFinite(start) || now() - start <= NAME_WAIT_MS;
    };
    // 이름이 정해졌는지 다운로드 목록에서 직접 다시 봐요(크롬 신호가 빠지거나 순서가 바뀌어도 알리려고).
    const check = async (id) => {
        if (shown.has(id)) return "skip";
        const [item] = await api.downloads.search({id}).catch(() => []);
        if (!item || item.state === "interrupted" || !recent(item)) { waiting.delete(id); return "skip"; }
        return bubbleName(item) ? show(item) : "wait";
    };

    return {
        // 새 다운로드: 이름이 벌써 있으면 바로, 없으면 이름이 정해질 때 알려요.
        onCreated(item) {
            if (!item || !Number.isInteger(item.id) || item.state === "interrupted") return Promise.resolve("skip");
            if (bubbleName(item)) return show(item);
            waiting.set(item.id, now());
            // 이름 신호가 안 와도 잠깐 뒤 한 번 더 봐요.
            for (const ms of retryMs) setTimeout(() => { if (waiting.has(item.id)) void check(item.id).catch(() => {}); }, ms);
            return Promise.resolve("wait");
        },
        async onChanged(delta) {
            if (!delta?.filename?.current || !Number.isInteger(delta.id) || shown.has(delta.id)) return "skip";
            const [item] = await api.downloads.search({id: delta.id}).catch(() => []);
            if (!item || item.state === "interrupted" || !recent(item)) { waiting.delete(delta.id); return "skip"; }
            return show({...item, filename: delta.filename.current});
        }
    };
}

// 새 메일 말풍선 글: "새 메일: 보낸 사람 - 제목" (여러 통이면 "새 메일 3통: …")
export function mailBubbleText(mails) {
    const list = Array.isArray(mails) ? mails.filter(Boolean) : [];
    if (!list.length) return "";
    const first = list[0];
    const from = String(first.from || "").trim(), subject = String(first.subject || "").trim() || "(제목 없음)";
    const head = list.length > 1 ? `새 메일 ${list.length}통` : "새 메일";
    return `${head}: ${from ? `${from} - ` : ""}${subject}`;
}

export const MAIL_BUBBLE_KEY = "core.mailBubble";

/**
 * 새 메일이 오면 아이콘 아래 말풍선을 띄워요. 누르면 메일 탭이 열려요.
 * @param {object} deps
 * @param {() => Promise<boolean>} deps.enabled
 * @param {(bubble: {kind: string, text: string}) => Promise<string>} deps.showBubble
 */
export function createMailBubble({enabled, showBubble}) {
    const seen = new Set();
    return async (mails) => {
        const fresh = (Array.isArray(mails) ? mails : []).filter((mail) => mail && !seen.has(mail.id || `${mail.from}|${mail.subject}`));
        for (const mail of fresh) seen.add(mail.id || `${mail.from}|${mail.subject}`);
        while (seen.size > 300) seen.delete(seen.values().next().value);
        if (!fresh.length) return "skip";
        if (!(await enabled().catch(() => false))) return "off";
        return showBubble({kind: "mail", text: mailBubbleText(fresh)});
    };
}
