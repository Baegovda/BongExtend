import {onMessage, sendMessage, sendToContentTab} from "@/http/messaging";
import {migrateLocalStorageData} from "@/storage/migration";
import {databaseStorage, moduleSchemaStorage} from "@/storage/wxtStorage";
import {isDcContentScriptUrl} from "@/utils/dcinsideTab";
import {fetchRemoteIpIsp, isIpIspDatabase} from "@/utils/ipIsp";
import {
    applyExtensionUpdate,
    checkExtensionUpdate,
    getExtensionUpdateStatus,
    scheduleUpdateChecks,
    setUpdateAutoCheck
} from "@/core/updateCheck";
import {refreshUpdateStateAfterInstall} from "@/core/updateCheck";

// @ts-ignore 번역 모듈은 순수 JS를 그대로 쓴다.
import {createTransMenus, startTransBackground} from "@/modules/trans/background.js";
// @ts-ignore 공통 모듈 스위치(순수 JS)
import {MODULES_KEY, getModules} from "@/modules/core-modules.js";
import {syncChzzkScripts} from "@/modules/chzzk-register";

export default defineBackground(() => {
    // ===== 번역 모듈 처리기 =====
    startTransBackground();

    // ===== 치지직 모듈 콘텐츠 스크립트 등록 =====
    // 모듈 스위치를 끄면 등록을 풀어서 치지직 페이지에 아예 붙지 않게 한다.
    void syncChzzkScripts(getModules);
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[MODULES_KEY]) void syncChzzkScripts(getModules);
    });

    const RECAPTCHA_SITE_KEY = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
    // 페이지에 postMessage 하지 않는다. 서비스 워커가 디시 탭의 메인 세상에서만 토큰을 받는다.
    // 문자열로 함수를 만들지 않는다. MV3 CSP가 막아서, 시작하자마자 호출하면
    // 서비스 워커 등록이 Status code 15로 실패하고 업데이트 확인이 끝나지 않는다.
    // executeScript는 이 함수 본문만 페이지로 넘긴다. 바깥 변수는 캡처하지 않는다.
    const recaptchaInPage = (siteKey: string, action: string): Promise<string> => {
        const page = window as Window & {
            grecaptcha?: {
                ready: (callback: () => void) => void;
                execute: (key: string, options: {action: string}) => Promise<string>;
            };
        };
        if (typeof action !== "string" || !action) return Promise.resolve("");
        return new Promise((resolve) => {
            const start = Date.now();
            const finish = (token: unknown) => {
                resolve(typeof token === "string" ? token : "");
            };
            const run = () => {
                const widget = page.grecaptcha;
                if (!widget) {
                    if (Date.now() - start > 2500) return finish("");
                    setTimeout(run, 50);
                    return;
                }
                try {
                    widget.ready(() => {
                        const current = page.grecaptcha;
                        if (!current) return finish("");
                        current.execute(siteKey, {action}).then(finish, () => finish(""));
                    });
                } catch {
                    finish("");
                }
            };
            run();
        });
    };

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.type !== "refresherGrecaptcha") return;
        const tabId = sender.tab?.id;
        const action = typeof message.action === "string" ? message.action : "";
        if (tabId == null || !action || sender.id !== browser.runtime.id) {
            sendResponse({ok: false, token: ""});
            return;
        }
        const target: {tabId: number; frameIds?: number[]} = {tabId};
        if (typeof sender.frameId === "number") target.frameIds = [sender.frameId];
        browser.scripting.executeScript({
            target,
            world: "MAIN",
            func: recaptchaInPage,
            args: [RECAPTCHA_SITE_KEY, action]
        }).then(
            (results) => sendResponse({ok: true, token: results?.[0]?.result || ""}),
            () => sendResponse({ok: false, token: ""})
        );
        return true;
    });

    // ===== Broadcast: popup/content → background → 모든 탭 =====
    onMessage("broadcast", async ({data}) => {
        const {type, data: payload} = data;

        try {
            const tabs = await browser.tabs.query({});
            const targets = tabs.filter((tab) => tab.id && isDcContentScriptUrl(tab.url));
            const delivered = await Promise.all(targets.map(async (tab) => {
                try {
                    await sendToContentTab(type, payload, tab.id!);
                    return true;
                } catch {
                    return false;
                }
            }));

            return {success: true, sentTo: delivered.filter(Boolean).length};
        } catch (e) {
            return {success: false, error: e};
        }
    });

    // 콘텐츠 스크립트가 없는 탭이면 팝업이 여기로 물어본다. 마지막에 저장해 둔 목록을 돌려준다.
    onMessage("getSchema", async () => {
        return await moduleSchemaStorage.getValue();
    });

    // ===== Context Menus =====
    const contextMenuItems: Browser.contextMenus.CreateProperties[] = [
        {
            id: "blockSelected",
            title: "오른쪽 클릭한 유저 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "memoSelected",
            title: "오른쪽 클릭한 유저 메모",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "dcconSelected",
            title: "오른쪽 클릭한 디시콘 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "dcconAllSelected",
            title: "오른쪽 클릭한 디시콘 전체 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "searchSauceNao",
            title: "SauceNao 검색",
            contexts: ["image"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        }
    ];

    let contextMenuSetup: Promise<void> | null = null;

    const createContextMenus = (): Promise<void> => {
        if (contextMenuSetup) return contextMenuSetup;

        contextMenuSetup = (async () => {
            await browser.contextMenus.removeAll();

            for (const item of contextMenuItems) {
                if (item.id) {
                    await browser.contextMenus.remove(item.id).catch(() => {});
                }

                await browser.contextMenus.create(item as chrome.contextMenus.CreateProperties);
            }

            // 번역 모듈 메뉴 (removeAll 뒤에 같이 만든다)
            try {
                createTransMenus();
            } catch (error) {
                console.warn("번역 메뉴를 만들지 못했어요.", error);
            }
        })();

        return contextMenuSetup;
    };

    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (!tab?.id) return;
        // 타입 안전 메시징: 활성 탭에 전달
        switch (info.menuItemId) {
            case "blockSelected":
                sendMessage("blockSelected", undefined, tab.id).catch(() => {});
                break;
            case "memoSelected":
                sendMessage("memoSelected", undefined, tab.id).catch(() => {});
                break;
            case "dcconSelected":
                sendMessage("dcconSelected", undefined, tab.id).catch(() => {});
                break;
            case "dcconAllSelected":
                sendMessage("dcconAllSelected", undefined, tab.id).catch(() => {});
                break;
            case "searchSauceNao":
                sendMessage("searchSauceNao", undefined, tab.id).catch(() => {});
                break;
        }
    });

    void createContextMenus();

    void (async () => {
        try {
            await migrateLocalStorageData();
        } catch (error) {
            console.error("Storage migration error:", error);
        }
        scheduleUpdateChecks();
    })();

    onMessage("getUpdateStatus", () => getExtensionUpdateStatus());
    onMessage("checkForUpdate", ({data}) => checkExtensionUpdate(Boolean(data?.force)));
    onMessage("applyUpdate", () => applyExtensionUpdate());
    onMessage("setUpdateAutoCheck", ({data}) => setUpdateAutoCheck(data.enabled));

    // <a href="chrome://..."> 는 브라우저가 막는다. tabs.create 만 chrome://extensions 와 about:addons 를 연다.
    onMessage("openExtensionsPage", async () => {
        const url = import.meta.env.FIREFOX
            ? "about:addons"
            : `chrome://extensions/?id=${browser.runtime.id}`;

        try {
            await browser.tabs.create({url});
            return {ok: true};
        } catch (error) {
            console.error("확장 프로그램 관리 페이지를 열지 못했어요.", error);

            if (import.meta.env.FIREFOX) {
                return {ok: false, error: "확장 프로그램 관리 페이지를 열지 못했어요."};
            }

            try {
                await browser.tabs.create({url: "chrome://extensions"});
                return {ok: true};
            } catch (fallbackError) {
                console.error("확장 프로그램 관리 페이지를 열지 못했어요.", fallbackError);
                return {ok: false, error: "확장 프로그램 관리 페이지를 열지 못했어요."};
            }
        }
    });

    browser.runtime.onStartup.addListener(() => {
        void createContextMenus();
    });

    // 단축키는 번역 켜기/끄기(toggle-translation)만 둔다. 다른 단축키는 따로 요청받기 전에는 넣지 않는다.

    // dcrefresher.green1052.com/data 는 404다. 차단 목록을 받던 요청은 서비스 워커 오류만 남기므로 하지 않는다.
    // 이미 저장한 차단 목록은 storage에 그대로 둔다. 통신사 표만 Baegovda/BongExtend의 main에서 따로 확인한다.
    const IP_UPDATE_INTERVAL = 604800000;

    const refreshIpDatabase = async (): Promise<void> => {
        try {
            const remoteIp = await fetchRemoteIpIsp();
            if (remoteIp) {
                const current: unknown = await databaseStorage.ip.getValue();
                const currentGenerated = isIpIspDatabase(current) ? current.generated : "";
                if (remoteIp.generated > currentGenerated) {
                    await databaseStorage.ip.setValue(remoteIp);
                }
            }
            await databaseStorage.ipCheckedAt.setValue(Date.now());
        } catch {
            // 네트워크가 끊기면 다음 시작에 다시 시도한다. 콘솔에는 남기지 않는다.
        }
    };

    // ===== Lifecycle =====
    browser.runtime.onInstalled.addListener(async (details) => {
        if (details?.reason === "install" || details?.reason === "update") {
            void refreshUpdateStateAfterInstall(true);
        }
        await createContextMenus();
        if (import.meta.env.PROD) {
            await refreshIpDatabase();
        }
    });

    if (import.meta.env.PROD) {
        void (async () => {
            const checkedAt = await databaseStorage.ipCheckedAt.getValue();
            if (!checkedAt || Date.now() - checkedAt > IP_UPDATE_INTERVAL) {
                await refreshIpDatabase();
            }
        })();
    }
});
