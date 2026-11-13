import {YOUTUBE_MATCHES, YOUTUBE_SCRIPT_FILE, YOUTUBE_SCRIPT_ID} from "./hold.js";

const KEY = "core.youtubeHold";
const STARTUP_KEY = "youtubeStartupAt";
const STARTUP_WINDOW_MS = 90000;

export function startYoutubeHold(chromeApi = chrome) {
    const enabled = async () => (await chromeApi.storage.local.get(KEY))[KEY] !== false;
    const granted = async () => {
        try {
            return await chromeApi.permissions.contains({origins: ["https://*/*"]}) || await chromeApi.permissions.contains({origins: YOUTUBE_MATCHES});
        } catch { return false; }
    };
    const sync = async () => {
        try {
            const on = await enabled() && await granted();
            const registered = await chromeApi.scripting.getRegisteredContentScripts({ids: [YOUTUBE_SCRIPT_ID]});
            if (!on) { if (registered.length) await chromeApi.scripting.unregisterContentScripts({ids: [YOUTUBE_SCRIPT_ID]}); return; }
            if (!registered.length) {
                await chromeApi.scripting.registerContentScripts([{id: YOUTUBE_SCRIPT_ID, matches: YOUTUBE_MATCHES, js: [YOUTUBE_SCRIPT_FILE], runAt: "document_start", persistAcrossSessions: true}]);
            }
        } catch (error) { console.warn("유튜브 자동 재생 막기 등록을 갱신하지 못했어요.", error); }
    };
    void sync();
    chromeApi.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes[KEY]) void sync(); });
    chromeApi.permissions.onAdded.addListener(() => void sync());
    chromeApi.permissions.onRemoved.addListener(() => void sync());
    chromeApi.runtime.onStartup.addListener(() => { void chromeApi.storage.session?.set({[STARTUP_KEY]: Date.now()}); });
    chromeApi.runtime.onMessage.addListener((message, sender, reply) => {
        if (message?.type !== "bongextend-youtube-hold-state" || sender.id !== chromeApi.runtime.id) return undefined;
        (async () => {
            const session = await chromeApi.storage.session?.get(STARTUP_KEY);
            const at = Number(session?.[STARTUP_KEY]) || 0;
            reply({on: await enabled(), startupRecent: at > 0 && Date.now() - at < STARTUP_WINDOW_MS});
        })().catch(() => reply({on: true, startupRecent: false}));
        return true;
    });
}
