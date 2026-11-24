// 다운로드 완료 알림과 완료 소리.
// 크롬이 '완료' 신호(downloads.onChanged)를 가끔 빠뜨려요(서비스 워커가 잠들었다 깨는 사이 등).
// 그래서 신호로 한 번, 그리고 배경이 깨어날 때·다운로드 소식이 올 때 "방금 끝났는데 아직 안 알린 것"을 찾아 한 번 더 봐요.
// 같은 다운로드는 한 번만 알려요(크롬을 켜 둔 동안 storage.session 에 기억).
// 진단용으로 마지막 결과만 core.download:lastNotice 에 남겨요(다운로드 번호·시각·성공 여부만, 파일 이름·주소는 안 남겨요).

export const NOTICE_SESSION_KEY = "core.download:noticed";
export const LAST_NOTICE_KEY = "core.download:lastNotice";
export const COMPLETE_SOUND = {name: "pop", volume: 0.6};
// 이보다 오래전에 끝난 것은 늦게 알려 봐야 헷갈려서 놓친 것으로 치지 않아요.
export const MISSED_WINDOW_MS = 10 * 60 * 1000;
const REMEMBER = 100;

// 놓친 완료 다운로드 고르기: 기록을 시작한 뒤(since)에, 최근(window) 끝났고, 아직 안 알린 것.
export function pickMissed(items, record, now, windowMs = MISSED_WINDOW_MS) {
    const since = Number(record?.since) || now;
    const seen = new Set(Array.isArray(record?.ids) ? record.ids : []);
    return (items || []).filter((item) => {
        if (!item || item.state !== "complete" || !Number.isInteger(item.id) || seen.has(item.id)) return false;
        // 배경에 함께 도는 메일 엔진(public/js/common.js)이 Date.parse 를 날짜 객체를 돌려주게 바꿔 놔서 getTime() 으로 읽어요.
        const end = new Date(item.endTime || "").getTime();
        return Number.isFinite(end) && end >= since && end <= now + 5000 && now - end <= windowMs;
    }).map((item) => item.id);
}

export const rememberNoticed = (record, id, now) => ({
    since: Number(record?.since) || now,
    ids: [...(Array.isArray(record?.ids) ? record.ids : []).filter((value) => value !== id), id].slice(-REMEMBER)
});

const fileName = (item) => item?.filename?.replace(/\\/g, "/").split("/").pop() || "파일";

/**
 * @param {object} deps
 * @param {typeof chrome} [deps.api]
 * @param {() => Promise<{notifications: boolean, completeSound: boolean, moduleOn: boolean}>} deps.readSettings
 * @param {(id: number) => boolean} [deps.isQuiet] 알리지 않을 다운로드(쇼핑 사진 묶음 받기)
 * @param {(sound: {name: string, volume: number}) => Promise<boolean>} [deps.playSound]
 * @param {() => number} [deps.now]
 */
export function createCompleteNotifier({api = chrome, readSettings, isQuiet = () => false, playSound = async () => false, now = Date.now} = {}) {
    const session = api.storage?.session;
    let memory = null; // storage.session 이 없을 때(시험 등) 대신 쓰는 기억
    let queue = Promise.resolve();
    const exclusive = (task) => (queue = queue.then(task, task));
    const readRecord = async () => {
        if (!session?.get) return memory;
        try { return (await session.get(NOTICE_SESSION_KEY))[NOTICE_SESSION_KEY] || null; } catch { return memory; }
    };
    const writeRecord = async (record) => {
        memory = record;
        if (session?.set) { try { await session.set({[NOTICE_SESSION_KEY]: record}); } catch { /* 기억 못 해도 알림은 보내요. */ } }
    };
    const note = (entry) => api.storage?.local?.set?.({[LAST_NOTICE_KEY]: {at: now(), ...entry}})?.catch?.(() => {});

    // 처음 깨어났을 때 기록 시작 시각을 정해요. 그 전에 끝난 다운로드는 다시 알리지 않아요.
    const ready = exclusive(async () => {
        const record = await readRecord();
        if (!record?.since) await writeRecord({since: now(), ids: []});
    });

    async function announce(id, via) {
        const record = await readRecord();
        if (record?.ids?.includes(id)) return false;
        await writeRecord(rememberNoticed(record, id, now()));
        if (isQuiet(id)) return false;
        let settings;
        try { settings = await readSettings(); } catch { return false; }
        if (!settings.moduleOn || (!settings.notifications && !settings.completeSound)) return false;
        let item = null;
        try { [item] = await api.downloads.search({id}); } catch { /* 이름 없이 알려요. */ }
        // 알림을 띄울 때는 윈도우 알림 소리(또로로롱)를 그대로 써요. 우리 소리는 알림을 끈 때나 알림이 막혔을 때만 내요.
        const ourSound = async () => {
            if (!settings.completeSound) return false;
            try { return Boolean(await playSound(COMPLETE_SOUND)); } catch { return false; }
        };
        if (!settings.notifications) {
            const sounded = await ourSound();
            void note({id, via, ok: sounded, sound: sounded, notification: "off"});
            return sounded;
        }
        try {
            await api.notifications.create(`bongextend-download-${id}`, {
                type: "basic",
                iconUrl: api.runtime.getURL("/icons/128.png"),
                title: "다운로드 완료",
                message: fileName(item),
                // '완료 소리'를 끄면 윈도우 알림 소리도 내지 않아요.
                silent: !settings.completeSound
            });
            void note({id, via, ok: true, sound: false});
            return true;
        } catch (error) {
            const sounded = await ourSound();
            void note({id, via, ok: false, sound: sounded, error: String(error?.message || error).slice(0, 200)});
            return sounded;
        }
    }

    // 완료 신호를 받았을 때.
    const onComplete = (id, via = "event") => exclusive(async () => { await ready; return announce(id, via); });

    // 놓친 것 찾기(깨어날 때, 다운로드 소식이 올 때).
    const sweep = (via = "sweep") => exclusive(async () => {
        await ready;
        let items = [];
        try { items = await api.downloads.search({state: "complete", orderBy: ["-endTime"], limit: 10}); } catch { return 0; }
        const missed = pickMissed(items, await readRecord(), now());
        let count = 0;
        for (const id of missed.reverse()) if (await announce(id, via)) count++;
        return count;
    });

    return {onComplete, sweep, ready};
}
