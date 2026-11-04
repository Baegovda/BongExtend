// 환율 탭 배지용 시세. 이미 허용된 주소만 쓰고, 실패하면 저장값을 유지한다.

import {isModuleEnabled} from "../core-modules.js";
import {FX_BADGE_REFRESH_MS} from "./convert.js";
import {refreshStoredRates} from "./refresh.js";

const ALARM = "fx-rates";

export function startFxBackground() {
    const minutes = Math.max(1, Math.round(FX_BADGE_REFRESH_MS / 60000));
    const tick = async () => {
        try {
            if (!(await isModuleEnabled("fx"))) return;
            await refreshStoredRates({
                storage: chrome.storage.local,
                fetchImpl: globalThis.fetch.bind(globalThis)
            });
        } catch (error) {
            console.error("환율표를 다시 받지 못했어요.", error);
        }
    };
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === ALARM) void tick();
    });
    void chrome.alarms.create(ALARM, {periodInMinutes: minutes, delayInMinutes: minutes});
    void tick();
}
