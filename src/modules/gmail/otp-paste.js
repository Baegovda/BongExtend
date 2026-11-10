// 원본 메일과 번호는 저장하지 않고 현재 워커 메모리에만 보관해요.
// 실제 붙여넣기와 번호 일치는 호출자가 검증한 후 consume을 호출해요.
export function createOtpPasteTracker({now = Date.now} = {}) {
    const ttl = 10 * 60_000;
    let pending = null;
    function live() {
        if (pending && now() >= pending.expires) pending = null;
        return pending;
    }
    function clear() { pending = null; }
    return {
        arm(mail, code) {
            clear();
            if (!mail || typeof mail.markAsRead !== "function" || typeof code !== "string" || !code) return null;
            const token = globalThis.crypto.randomUUID();
            pending = {mail, code, token, expires: now() + ttl, consuming: false};
            return token;
        },
        current() {
            const entry = live();
            return entry ? {token: entry.token, code: entry.code} : null;
        },
        async consume(token) {
            const entry = live();
            if (!entry || entry.token !== token || entry.consuming) return false;
            entry.consuming = true;
            try {
                await entry.mail.markAsRead();
                if (pending === entry) clear();
                return true;
            } catch (error) {
                entry.consuming = false;
                throw error;
            }
        },
        invalidate: clear,
        clear,
    };
}
