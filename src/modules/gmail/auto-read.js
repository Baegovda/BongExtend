// 알리익스프레스 메일은 Windows 알림이 실제로 뜬 뒤에 자동으로 읽음 처리해요.
// 알림이 뜨지 않았거나(방해 금지, 알림 꺼짐, 시작 때 확인 등) 인증번호 메일이면 읽음으로 바꾸지 않아요.
// 메일 내용은 읽지 않고 보낸 사람 주소와 메일 번호만 메모리에서 써요. 저장하거나 밖으로 보내지 않아요.

const ALI_DOMAINS = ["aliexpress.com"];
// Firefox Relay가 전달한 메일은 실제 보낸 주소가 이 도메인이고, 원래 보낸 사람이 표시 이름에 'transaction@notice.aliexpress.com [via Relay]'처럼 들어와요.
const RELAY_DOMAINS = ["mozmail.com", "relay.firefox.com"];
// 알리익스프레스의 알림 발신 이름이 잘린 앞부분. Relay로 온 메일에서만 써요.
const ALI_TRUNCATED_NAMES = [/^transaction@notice(\.|$)/i, /^(promotion|marketing|newsletter|service|order|aliexpress)@(notice|mail|mkt|promotion|service|aliexpr)/i];
const KEEP = 400;

const addressOf = (value) => {
    const text = String(value || "").trim().toLowerCase();
    const match = text.match(/<([^<>\s]+@[^<>\s]+)>/) || text.match(/([^\s<>"']+@[^\s<>"']+)/);
    return match ? match[1] : "";
};

export const senderDomain = (address) => {
    const email = addressOf(address);
    const at = email.lastIndexOf("@");
    return at < 1 ? "" : email.slice(at + 1).replace(/\.+$/, "");
};

const inDomains = (domain, roots) => roots.some((root) => domain === root || domain.endsWith(`.${root}`));

// 표시 이름은 누구나 바꿀 수 있어서 보내는 주소의 도메인만 봐요. 'evilaliexpress.com' 같은 비슷한 도메인은 제외해요.
export function isAliExpressSender(address) {
    const domain = senderDomain(address);
    return Boolean(domain) && inDomains(domain, ALI_DOMAINS);
}

// 실제 보낸 주소가 알리익스프레스이거나, Firefox Relay가 전달한 메일이고 원래 보낸 사람이 알리익스프레스일 때만 알리 메일로 봐요.
export function isAliExpressMail(mail) {
    if (isAliExpressSender(mail?.authorMail)) return true;
    const domain = senderDomain(mail?.authorMail);
    if (!domain || !inDomains(domain, RELAY_DOMAINS)) return false;
    // Relay는 표시 이름을 원래 보낸 사람으로 바꿔 와요. 주소 모양이 아니어도 'aliexpress'가 들어 있으면 알리로 봐요.
    const name = String(mail?.authorName || "").trim();
    // 지메일은 긴 이름을 20자쯤에서 잘라 보내요('transaction@notice..'). 잘려서 'aliexpress'가 없어도 알리의 발신 형태로 알아봐요.
    return isAliExpressSender(name) || /ali\s*express/i.test(name) || ALI_TRUNCATED_NAMES.some((pattern) => pattern.test(name));
}

export const mailKey = (mail) => (mail && mail.id ? `${mail.account?.id}:${mail.id}` : "");

const remember = (set, key) => {
    set.add(key);
    while (set.size > KEEP) set.delete(set.values().next().value);
};

export function createMailAutoRead({log = () => {}, notify = null, isEnabled = async () => true, retryDelayMs = 4000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))} = {}) {
    const shown = new Set();
    const done = new Set();
    let queue = Promise.resolve();

    // 알림이 실제로 만들어진 메일만 기록해요.
    const noteShown = (mails) => {
        for (const mail of mails || []) {
            const key = mailKey(mail);
            if (key) remember(shown, key);
        }
    };

    const markOne = async (mail) => {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                await mail.markAsRead();
                return true;
            } catch {
                if (attempt === 0) await sleep(retryDelayMs);
            }
        }
        return false;
    };

    // settled: 알림 표시가 끝나길 기다리는 Promise. 알림이 먼저 떠야 하므로 그 뒤에 읽음 처리해요.
    const process = (mails, {settled = Promise.resolve(), skip = [], backlog = []} = {}) => {
        const run = async () => {
            try { await settled; } catch { /* 알림이 실패하면 shown에 없어서 읽음 처리하지 않아요. */ }
            const note = (mail, reason) => {
                try {
                    const domain = senderDomain(mail?.authorMail);
                    const entry = {domain, reason};
                    // Relay로 온 메일이 알리로 인식되지 않으면 이유를 찾을 수 있게 표시 이름 앞부분을 기록해요(이 PC 안에만 저장돼요).
                    if (reason === "not-ali" && inDomains(domain, RELAY_DOMAINS)) entry.name = String(mail?.authorName || "").slice(0, 48);
                    log(entry);
                } catch { /* 기록 실패는 무시해요. */ }
            };
            if (!(await isEnabled())) { log({domain: "", reason: "disabled"}); return []; }
            const skipped = new Set(skip);
            const marked = [];
            for (const mail of mails || []) {
                const key = mailKey(mail);
                if (!key) continue;
                if (done.has(key)) continue;
                if (!isAliExpressMail(mail)) { note(mail, "not-ali"); continue; }
                if (skipped.has(key)) { note(mail, "otp"); continue; }
                if (typeof mail.markAsRead !== "function") { note(mail, "no-method"); continue; }
                // Checker Plus가 알림을 안 띄웠어도(알림 설정·상태 때문에) 알리 메일은 우리가 직접 Windows 알림을 띄워요.
                let announced = shown.has(key);
                if (!announced && notify) {
                    try { announced = Boolean(await notify(mail)); } catch { announced = false; }
                    if (announced) note(mail, "notified");
                }
                if (!announced) { note(mail, "no-notification"); continue; }
                if (await markOne(mail)) {
                    remember(done, key);
                    shown.delete(key);
                    marked.push(key);
                    note(mail, "read");
                } else {
                    note(mail, "failed");
                }
            }
            // 이미 쌓여 있던 읽지 않은 알리 메일은 알림 없이 조용히 읽음으로 정리해요(한 번에 최대 20통).
            let swept = 0;
            for (const mail of backlog || []) {
                if (swept >= 20) break;
                const key = mailKey(mail);
                if (!key || done.has(key) || skipped.has(key) || typeof mail.markAsRead !== "function" || !isAliExpressMail(mail)) continue;
                swept++;
                if (await markOne(mail)) { remember(done, key); marked.push(key); note(mail, "backlog-read"); }
                else note(mail, "failed");
            }
            return marked;
        };
        const result = queue.then(run, run);
        queue = result.catch(() => {});
        return result;
    };

    return {noteShown, process};
}
