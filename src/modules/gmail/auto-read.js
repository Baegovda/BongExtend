// 알리익스프레스 메일은 Windows 알림이 실제로 뜬 뒤에 자동으로 읽음 처리해요.
// 알림이 뜨지 않았거나(방해 금지, 알림 꺼짐, 시작 때 확인 등) 인증번호 메일이면 읽음으로 바꾸지 않아요.
// 메일 내용은 읽지 않고 보낸 사람 주소와 메일 번호만 메모리에서 써요. 저장하거나 밖으로 보내지 않아요.

const ALI_DOMAINS = ["aliexpress.com"];
const KEEP = 400;

const addressOf = (value) => {
    const text = String(value || "").trim().toLowerCase();
    const match = text.match(/<([^<>\s]+@[^<>\s]+)>/) || text.match(/([^\s<>"']+@[^\s<>"']+)/);
    return match ? match[1] : "";
};

// 표시 이름은 누구나 바꿀 수 있어서 보내는 주소의 도메인만 봐요. 'evilaliexpress.com' 같은 비슷한 도메인은 제외해요.
export function isAliExpressSender(address) {
    const email = addressOf(address);
    const at = email.lastIndexOf("@");
    if (at < 1) return false;
    const domain = email.slice(at + 1).replace(/\.+$/, "");
    return ALI_DOMAINS.some((root) => domain === root || domain.endsWith(`.${root}`));
}

export const mailKey = (mail) => (mail && mail.id ? `${mail.account?.id}:${mail.id}` : "");

const remember = (set, key) => {
    set.add(key);
    while (set.size > KEEP) set.delete(set.values().next().value);
};

export function createMailAutoRead({isEnabled = async () => true, retryDelayMs = 4000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))} = {}) {
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
    const process = (mails, {settled = Promise.resolve(), skip = []} = {}) => {
        const run = async () => {
            try { await settled; } catch { /* 알림이 실패하면 shown에 없어서 읽음 처리하지 않아요. */ }
            if (!(await isEnabled())) return [];
            const skipped = new Set(skip);
            const marked = [];
            for (const mail of mails || []) {
                const key = mailKey(mail);
                if (!key || skipped.has(key) || done.has(key) || !shown.has(key)) continue;
                if (typeof mail.markAsRead !== "function" || !isAliExpressSender(mail.authorMail)) continue;
                if (await markOne(mail)) {
                    remember(done, key);
                    shown.delete(key);
                    marked.push(key);
                }
            }
            return marked;
        };
        const result = queue.then(run, run);
        queue = result.catch(() => {});
        return result;
    };

    return {noteShown, process};
}
