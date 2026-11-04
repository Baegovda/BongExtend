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
// @ts-ignore 페이지에 복사되는 순수 JS라 export 를 쓰지 않는다.
import "@/modules/chzzk/lib/ads.js";
// @ts-ignore 순수 JS
import {startGmailBackground} from "@/modules/gmail/background.js";
// @ts-ignore 순수 JS
import {startFxBackground} from "@/modules/fx/background.js";
// @ts-ignore 순수 JS
import {startRightClickBackground} from "@/modules/rightclick/background.js";
// @ts-ignore settings are plain JS shared with the dark-mode popup and content script
import {DARK_SCRIPT_FILE, DARK_SCRIPT_ID, DARK_SETTINGS_KEY, darkSiteEnabled, darkSitePattern, normalizeDarkSettings} from "@/modules/dark/settings.js";
// @ts-ignore download helpers are plain JS shared with the manager page
import {DOWNLOAD_SETTINGS_KEY, cleanSuggestedFilename, makeDownloadFilename, normalizeDownloadSettings} from "@/modules/downloads/settings.js";

export default defineBackground(() => {
    // ===== 번역 모듈 처리기 =====
    startTransBackground();
    // ===== 메일: 로그인된 Gmail 세션으로 받은편지함을 맞춘다 =====
    startGmailBackground();
    startFxBackground();
    startRightClickBackground();

    // 다크 모드: 사용자가 권한을 허용한 사이트에만 런타임 콘텐츠 스크립트를 등록한다.
    const syncDarkReaderScript = async () => {
        try {
            const stored = await browser.storage.local.get([DARK_SETTINGS_KEY, MODULES_KEY]);
            const settings = normalizeDarkSettings(stored[DARK_SETTINGS_KEY]);
            const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
            const matches: string[] = [];
            if (modules.dark !== false) {
                if (settings.enabledByDefault) {
                    const allOrigins = ["https://*/*", "http://*/*"];
                    if (await browser.permissions.contains({origins: allOrigins})) matches.push(...allOrigins);
                } else {
                    const hosts = new Set<string>(settings.enabledSites);
                    if (settings.siteListMode === "only") for (const host of settings.siteList) hosts.add(host);
                    for (const host of hosts) {
                        if (!darkSiteEnabled({...settings, enabledByDefault: false}, host)) continue;
                        for (const pattern of darkSitePattern(host)) {
                            if (await browser.permissions.contains({origins: [pattern]})) matches.push(pattern);
                        }
                    }
                }
            }
            const registered = await browser.scripting.getRegisteredContentScripts({ids: [DARK_SCRIPT_ID]});
            if (registered.length) await browser.scripting.unregisterContentScripts({ids: [DARK_SCRIPT_ID]});
            if (matches.length) {
                await browser.scripting.registerContentScripts([{
                    id: DARK_SCRIPT_ID,
                    matches: [...new Set(matches)],
                    js: [DARK_SCRIPT_FILE],
                    runAt: "document_start",
                    persistAcrossSessions: true
                }]);
            }
        } catch (error) {
            console.warn("다크 모드 자동 적용 설정을 갱신하지 못했어요.", error);
        }
    };
    void syncDarkReaderScript();
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes[DARK_SETTINGS_KEY] || changes[MODULES_KEY])) void syncDarkReaderScript();
    });

    // 다운로드 관리: Chrome 자체 다운로드 API를 사용하며 저장 경로는 다운로드 폴더 아래로 제한한다.
    const syncDownloadUi = async () => {
        try {
            const stored = await browser.storage.local.get([DOWNLOAD_SETTINGS_KEY, MODULES_KEY]);
            const settings = normalizeDownloadSettings(stored[DOWNLOAD_SETTINGS_KEY]);
            const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
            await browser.downloads.setUiOptions({enabled: modules.download === false || !settings.replaceChromeUi});
        } catch (error) {
            console.warn("Chrome 다운로드 표시 설정을 바꾸지 못했어요.", error);
        }
    };
    void syncDownloadUi();
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes[DOWNLOAD_SETTINGS_KEY] || changes[MODULES_KEY])) void syncDownloadUi();
    });
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
        void (async () => {
            try {
                const nameHint = takeDownloadNameHint(item.url);
                const stored = await chrome.storage.local.get([DOWNLOAD_SETTINGS_KEY, MODULES_KEY]);
                const settings = normalizeDownloadSettings(stored[DOWNLOAD_SETTINGS_KEY]);
                const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
                if (modules.download === false || (!settings.filenameMask && !settings.folder && !settings.routeByType && !settings.rules.length)) {
                    if (nameHint) suggest({filename: nameHint, conflictAction: "uniquify"});
                    else suggest();
                    return;
                }
                suggest({filename: makeDownloadFilename(item, settings, new Date(), nameHint), conflictAction: "uniquify"});
            } catch {
                suggest();
            }
        })();
        return true;
    });
    chrome.downloads.onChanged.addListener((delta) => {
        if (delta.state?.current !== "complete" || delta.state.previous === "complete") return;
        void (async () => {
            const stored = await chrome.storage.local.get([DOWNLOAD_SETTINGS_KEY, MODULES_KEY]);
            const settings = normalizeDownloadSettings(stored[DOWNLOAD_SETTINGS_KEY]);
            const modules = (stored[MODULES_KEY] && typeof stored[MODULES_KEY] === "object" ? stored[MODULES_KEY] : {}) as Record<string, unknown>;
            if (modules.download === false || !settings.notifications) return;
            const item = await chrome.downloads.search({id: delta.id});
            const name = item[0]?.filename?.replace(/\\/g, "/").split("/").pop() || "파일";
            await chrome.notifications.create(`bongextend-download-${delta.id}`, {
                type: "basic",
                iconUrl: browser.runtime.getURL("/icons/128.png"),
                title: "다운로드 완료",
                message: name
            });
        })().catch((error) => console.warn("다운로드 알림을 표시하지 못했어요.", error));
    });
    const downloadNameHints = new Map<string, {name: string; createdAt: number}[]>();
    const takeDownloadNameHint = (url: string) => {
        const queue = downloadNameHints.get(url);
        if (!queue) return "";
        const now = Date.now();
        while (queue.length && now - queue[0].createdAt > 30_000) queue.shift();
        const hint = queue.shift()?.name || "";
        if (!queue.length) downloadNameHints.delete(url);
        return hint;
    };
    const removeDownloadNameHint = (url: string, name: string) => {
        const queue = downloadNameHints.get(url);
        if (!queue) return;
        const index = queue.findIndex((entry) => entry.name === name);
        if (index >= 0) queue.splice(index, 1);
        if (!queue.length) downloadNameHints.delete(url);
    };
    const startDownloadWithName = async (rawUrl: string, rawName: string) => {
        const url = new URL(rawUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("http 또는 https 주소만 받을 수 있어요.");
        const name = cleanSuggestedFilename(rawName);
        if (name) {
            const queue = downloadNameHints.get(url.href) || [];
            queue.push({name, createdAt: Date.now()});
            downloadNameHints.set(url.href, queue);
        }
        try {
            return await browser.downloads.download({url: url.href, conflictAction: "uniquify"});
        } catch (error) {
            if (name) removeDownloadNameHint(url.href, name);
            throw error;
        }
    };
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.type !== "bongextend-download") return;
        let senderIsExtensionPage = false;
        try { senderIsExtensionPage = sender.id === browser.runtime.id && new URL(sender.url || "").protocol === "chrome-extension:"; }
        catch { senderIsExtensionPage = false; }
        if (!senderIsExtensionPage || typeof message.url !== "string") {
            sendResponse({ok: false, error: "확장 프로그램 화면에서만 시작할 수 있어요."});
            return;
        }
        startDownloadWithName(message.url, typeof message.filename === "string" ? message.filename : "").then(
            (id) => sendResponse({ok: true, id}),
            (error) => sendResponse({ok: false, error: error?.message || "다운로드를 시작하지 못했어요."})
        );
        return true;
    });

    // ===== 치지직 모듈 콘텐츠 스크립트 등록 =====
    // 모듈 스위치를 끄면 등록을 풀어서 치지직 페이지에 아예 붙지 않게 한다.
    type ChzzkAdApi = {
        CHZZK_AD_RULE_IDS: number[];
        chzzkAdRules: () => chrome.declarativeNetRequest.Rule[];
    };
    const chzzkAdApi = () => (globalThis as unknown as {BongAds?: ChzzkAdApi}).BongAds;
    const syncChzzkAdRules = async () => {
        const api = chzzkAdApi();
        const dnr = browser.declarativeNetRequest;
        if (!api || !dnr?.updateDynamicRules) return;
        try {
            const stored = await browser.storage.sync.get("chzzk.adBlock");
            const modules = await getModules();
            const on = stored["chzzk.adBlock"] !== false && modules.chzzk !== false;
            const update: chrome.declarativeNetRequest.UpdateRuleOptions = {removeRuleIds: api.CHZZK_AD_RULE_IDS};
            const rules = on ? api.chzzkAdRules() : [];
            // 빈 목록을 addRules 로 넣으면 크롬이 규칙 갱신을 거절할 수 있다.
            if (rules.length) update.addRules = rules;
            await dnr.updateDynamicRules(update);
        } catch (error) {
            console.error("치지직 광고 차단 규칙을 적용하지 못했어요.", error);
        }
    };
    void syncChzzkScripts(getModules);
    void syncChzzkAdRules();
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[MODULES_KEY]) {
            void syncChzzkScripts(getModules);
            void syncChzzkAdRules();
        }
        if (area === "sync" && changes["chzzk.adBlock"]) void syncChzzkAdRules();
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
        },
        {
            id: "bongDownloadLink",
            title: "BongExtend로 링크 다운로드",
            contexts: ["link"]
        },
        {
            id: "bongDownloadImage",
            title: "BongExtend로 이미지 다운로드",
            contexts: ["image"]
        },
        {
            id: "bongDownloadMedia",
            title: "BongExtend로 미디어 다운로드",
            contexts: ["audio", "video"]
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
            case "bongDownloadLink":
            case "bongDownloadImage":
            case "bongDownloadMedia": {
                void getModules().then((modules: Record<string, boolean | undefined>) => {
                    if (modules.download === false) return;
                    const rawUrl = info.menuItemId === "bongDownloadLink" ? info.linkUrl : info.srcUrl;
                    if (!rawUrl) return;
                    try {
                        const url = new URL(rawUrl);
                        if (url.protocol !== "http:" && url.protocol !== "https:") return;
                        const fallbackName = url.pathname.split("/").pop() || tab.title || "";
                        const name = cleanSuggestedFilename(fallbackName);
                        const extension = url.pathname.split("/").pop()?.match(/\.[a-z0-9]{1,8}$/i)?.[0] || "";
                        const filename = name && !/\.[a-z0-9]{1,8}$/i.test(name) ? `${name}${extension}` : name;
                        void startDownloadWithName(url.href, filename);
                    } catch { /* 주소가 올바르지 않으면 건너뛴다 */ }
                });
                break;
            }
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
