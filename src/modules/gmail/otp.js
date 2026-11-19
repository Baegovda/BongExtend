import {coreCallText} from "../core-wasm.js";
// 인증번호는 외부 서비스로 보내거나 저장하지 않고 메모리에서만 처리해요.
const CONTEXT = /인증\s*(?:번호|코드)|확인\s*(?:번호|코드)|일회용\s*(?:번호|코드|비밀번호)|보안\s*(?:번호|코드)|verification\s*code|security\s*code|confirmation\s*code|login\s*code|sign[ -]?in\s*code|one[ -]?time\s*(?:code|password|passcode)|passcode|\botp\b|验证码|驗證碼|認証コード/gi;
const CANDIDATE = /(?<![A-Z0-9])(?:[0-9]{3}[ \t][0-9]{3}|[A-Z0-9]{3}-[A-Z0-9]{3}|[0-9]{4,8}|[A-Z0-9]{6,8})(?![A-Z0-9])/giu;
// 문맥 단어가 하나라도 있는지만 빠르게 봐요(전역 검색이 아니라 첫 맞음에서 멈춰요).
const HAS_CONTEXT = new RegExp(CONTEXT.source, "i");
// 이보다 짧은 글은 Rust로 건너가는 비용이 계산보다 커서 자바스크립트가 그대로 처리해요(재 본 값).
const RUST_FROM = 1500;

// 무거운 부분(후보 찾기·순위)은 Rust(native/core-wasm)가 해요. 결과가 같은지는 test/otp-rust.test.js 가 비교해요.
// - 문맥 단어가 아예 없으면(대부분의 메일) 바로 null — 예전 길도 이때는 null 이에요.
// - 짧은 글, 준비 전, Rust가 "예전 길로"라고 하면 아래 자바스크립트 길을 써요.
export function extractMailOtp(subject, body = "") {
    // String(x || "") 와 같게: 거짓 값은 빈 글자, 글자가 아닌 값은 예전 길로.
    const plain = (value) => (typeof value === "string" ? value : value ? null : "");
    const s = plain(subject), b = plain(body);
    if (s !== null && b !== null && s.length + b.length >= RUST_FROM) {
        if (!HAS_CONTEXT.test(s) && !HAS_CONTEXT.test(b.slice(0, 200000))) return null;
        const fast = coreCallText("gmail.extractOtp", [s, b]);
        if (fast && "value" in fast) return fast.value;
    }
    return extractMailOtpJs(subject, body);
}

export function extractMailOtpJs(subject, body = "") {
    for (const text of [String(subject || ""), String(body || "").slice(0, 200000)]) {
        const contexts = [...text.matchAll(CONTEXT)];
        if (!contexts.length) continue;
        const candidates = [...text.matchAll(CANDIDATE)].filter(match => /[0-9]/.test(match[0]));
        const ranked = candidates.map(match => ({code: match[0].replace(/[ \t]/g, ""), distance: Math.min(...contexts.map(context => Math.max(0, match.index - context.index - context[0].length, context.index - match.index - match[0].length)))}))
            .filter(candidate => candidate.distance <= 80).sort((a, b) => a.distance - b.distance);
        if (ranked.length && !(ranked[1] && ranked[0].distance === ranked[1].distance && ranked[0].code !== ranked[1].code)) return ranked[0].code;
    }
    return null;
}

export function createMailOtpHandler({load, save, copy, notify, now = Date.now}) {
    let queue = Promise.resolve();
    return (mails, {baseline = false} = {}) => {
        const run = async () => {
            const state = await load();
            if (state.enabled === false) return [];
            const seen = new Map((state.seen || []).map(entry => [entry.key, entry.otp]));
            const handled = [];
            if (baseline) {
                for (const mail of mails) if (mail.id) seen.set(`${mail.account?.id}:${mail.id}`, false);
                await save([...seen].slice(-256).map(([key, otp]) => ({key, otp})));
                return handled;
            }

            // 여러 메일이 함께 도착하면 가장 최신 번호가 클립보드에 남아요.
            const ordered = [...mails].sort((a, b) => new Date(a.issued) - new Date(b.issued));
            for (const mail of ordered) {
                const key = `${mail.account?.id}:${mail.id}`;
                if (!mail.id) continue;
                if (seen.has(key)) { if (seen.get(key)) handled.push(key); continue; }
                const issued = new Date(mail.issued).getTime();
                if (!Number.isFinite(issued) || issued < now() - 10 * 60_000 || issued > now() + 120_000) continue;
                try {
                    const thread = typeof mail.getThread === "function" ? await mail.getThread() : mail;
                    const body = await (thread || mail).getLastMessageText({htmlToText: true});
                    const code = extractMailOtp(mail.title, body);
                    if (code) {
                        // 복사가 실패해도 인증번호 알림은 표시하고 다음 수신 확인 때 복사를 재시도해요.
                        let copied = false;
                        try { await copy(code, mail); copied = true; } catch { /* 알림은 계속 표시해요. */ }
                        await notify(key, code);
                        handled.push(key);
                        if (!copied) continue;
                    }
                    seen.set(key, Boolean(code));
                    await save([...seen].slice(-256).map(([key, otp]) => ({key, otp})));
                } catch { /* 한 메일 오류로 다른 메일의 인증번호 처리를 막지 않아요. */ }
            }
            return handled;
        };
        const result = queue.then(run, run);
        queue = result.catch(() => {});
        return result;
    };
}
