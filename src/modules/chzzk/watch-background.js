// 치지직 관심 스트리머가 방송을 켜면 새 탭으로 그 방송을 열어요.
// 치지직 탭이 하나도 없어도 동작하도록 백그라운드가 30초마다 확인하고,
// 치지직 탭이 열려 있으면 그 탭의 확인 스크립트가 더 빨리 알려 줘요(같은 열기 요청으로 모여요).
const ALARM = "bongextend-chzzk-watch";
const API = "https://api.chzzk.naver.com";
const HEX32 = /^[0-9a-f]{32}$/i;

// 이전 상태 → 현재 상태에서 '꺼짐 → 켜짐'으로 바뀐 채널 ID들. 이전 기록이 없으면 전환이 아니에요.
export function newlyLive(prev, now) {
    const out = [];
    for (const id of Object.keys(now || {})) {
        const p = prev ? prev[id] : undefined;
        if (p !== undefined && p !== null && p !== "OPEN" && now[id] === "OPEN") out.push(id);
    }
    return out;
}

export const liveUrl = (id) => `https://chzzk.naver.com/live/${id}`;

export function startChzzkWatch(chromeApi = chrome) {
    const settings = async () => {
        const stored = await chromeApi.storage.sync.get({watchEnabled: true, watchList: []});
        const modules = (await chromeApi.storage.local.get("core.modules"))["core.modules"];
        const list = (Array.isArray(stored.watchList) ? stored.watchList : []).filter((x) => x && HEX32.test(String(x.id || "")));
        return {on: stored.watchEnabled !== false && modules?.chzzk !== false && list.length > 0, list};
    };
    const statusOf = async (id) => {
        const response = await fetch(`${API}/polling/v3.1/channels/${id}/live-status`, {credentials: "include", cache: "no-store"});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json())?.content?.status === "OPEN" ? "OPEN" : "CLOSE";
    };
    // 이미 그 방송이 열려 있으면 새로 열지 않고 그 탭을 앞으로 가져와요.
    const openLive = async (id) => {
        const tabs = await chromeApi.tabs.query({url: `${liveUrl(id)}*`});
        const existing = tabs.find((tab) => typeof tab.id === "number");
        if (existing) {
            await chromeApi.tabs.update(existing.id, {active: true});
            if (typeof existing.windowId === "number") await chromeApi.windows.update(existing.windowId, {focused: true});
            return;
        }
        await chromeApi.tabs.create({url: liveUrl(id), active: true});
    };
    let busy = false;
    const check = async () => {
        if (busy) return;
        busy = true;
        try {
            const {on, list} = await settings();
            if (!on) return;
            const prev = (await chromeApi.storage.local.get({watchStatus: {}})).watchStatus || {};
            const now = {};
            for (const entry of list) {
                try { now[entry.id] = await statusOf(entry.id); } catch { /* 이번엔 건너뛰고 다음에 다시 확인해요. */ }
            }
            await chromeApi.storage.local.set({watchStatus: {...prev, ...now}});
            const first = list.map((x) => x.id).find((id) => newlyLive(prev, now).includes(id));
            if (first) await openLive(first);
        } catch (error) {
            console.warn("치지직 관심 스트리머 확인에 실패했어요.", error);
        } finally { busy = false; }
    };
    const ensureAlarm = () => { try { chromeApi.alarms.create(ALARM, {delayInMinutes: 0.5, periodInMinutes: 0.5}); } catch { /* 알람을 못 만들면 열린 치지직 탭이 대신 확인해요. */ } };
    ensureAlarm();
    chromeApi.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM) void check(); });
    chromeApi.runtime.onStartup.addListener(() => { ensureAlarm(); void check(); });
    chromeApi.storage.onChanged.addListener((changes, area) => { if (area === "sync" && (changes.watchEnabled || changes.watchList)) void check(); });
    // 치지직 탭의 확인 스크립트가 방송 시작을 먼저 발견했을 때
    chromeApi.runtime.onMessage.addListener((message, sender, reply) => {
        if (message?.type !== "bongextend-chzzk-open-live" || sender.id !== chromeApi.runtime.id) return undefined;
        const id = String(message.id || "");
        if (!HEX32.test(id)) { reply({ok: false}); return undefined; }
        openLive(id.toLowerCase()).then(() => reply({ok: true}), () => reply({ok: false}));
        return true;
    });
}
