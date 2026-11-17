// 쇼핑 백그라운드: 상품 페이지 스크립트 등록, 가격 기록 저장, 관심 상품 가격 확인과 알림, 상품 사진 받기.
// 사용자가 팝업에서 '쇼핑몰 연결 허용'을 눌러 알리익스프레스 · 타오바오 주소를 허용했을 때만 동작해요.
import {CHECK_EVERY, SHOP_MATCHES, SHOP_ORIGINS, SHOP_PRODUCTS_KEY, SHOP_SCRIPT_FILE, SHOP_SCRIPT_ID, SHOP_SETTINGS_KEY, SITE_NAMES, dueForCheck, formatPrice, normalizeProducts, normalizeShopSettings, originalProductImage, parsePriceText, parseProductUrl, recordPrice, removeProduct, safeFolderName, setWatch} from "./shop.js";
import {readProductPage} from "./read-page.js";

const MODULES_KEY = "core.modules";
const ALARM = "bongextend-shop-check";
const NOTIFY_PREFIX = "bongextend-shop:";
const MAX_CHECKS_PER_RUN = 5;
const OVERDUE = 24 * 60 * 60 * 1000;

// 상품 사진은 한 번에 여러 장이라 다운로드 완료 알림을 장마다 띄우지 않아요.
const quietDownloads = new Set();
export const takeQuietShopDownload = (id) => quietDownloads.delete(id);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startShopBackground(chromeApi = chrome) {
    // 저장은 한 줄로 세워서 해요(여러 탭이 동시에 기록해도 서로 덮어쓰지 않게).
    let queue = Promise.resolve();
    const exclusive = (task) => { const run = queue.then(task, task); queue = run.catch(() => {}); return run; };

    const state = async () => {
        const stored = await chromeApi.storage.local.get([SHOP_SETTINGS_KEY, MODULES_KEY]);
        return {on: stored[MODULES_KEY]?.shop !== false, settings: normalizeShopSettings(stored[SHOP_SETTINGS_KEY])};
    };
    const granted = async () => { try { return await chromeApi.permissions.contains({origins: SHOP_ORIGINS}); } catch { return false; } };

    const sync = async () => {
        try {
            const {on, settings} = await state();
            const allowed = await granted();
            const registered = await chromeApi.scripting.getRegisteredContentScripts({ids: [SHOP_SCRIPT_ID]});
            if (!(on && allowed && settings.panel)) {
                if (registered.length) await chromeApi.scripting.unregisterContentScripts({ids: [SHOP_SCRIPT_ID]});
            } else if (!registered.length) {
                await chromeApi.scripting.registerContentScripts([{id: SHOP_SCRIPT_ID, matches: SHOP_MATCHES, js: [SHOP_SCRIPT_FILE], runAt: "document_idle", persistAcrossSessions: true}]);
            }
            const alarm = await chromeApi.alarms.get(ALARM);
            if (on && allowed && settings.alerts) { if (!alarm) await chromeApi.alarms.create(ALARM, {delayInMinutes: 5, periodInMinutes: 60}); }
            else if (alarm) await chromeApi.alarms.clear(ALARM);
        } catch (error) {
            console.warn("쇼핑 기능 등록을 갱신하지 못했어요.", error);
        }
    };

    const readProducts = async () => normalizeProducts((await chromeApi.storage.local.get(SHOP_PRODUCTS_KEY))[SHOP_PRODUCTS_KEY]);

    const record = (info) => exclusive(async () => {
        const price = parsePriceText(info.priceText, info.currency);
        if (!price) return {product: null};
        const result = recordPrice(await readProducts(), {url: info.url, title: info.title, image: info.image, price: price.amount, currency: price.currency || info.currency});
        if (result.product) await chromeApi.storage.local.set({[SHOP_PRODUCTS_KEY]: result.products});
        return result;
    });

    const notifyDrop = async (key, product, before) => {
        const now = product.points.at(-1)?.[1];
        if (!now || !(before > now)) return;
        const lowest = Math.min(...product.points.map((p) => p[1]));
        await chromeApi.notifications.create(`${NOTIFY_PREFIX}${key}`, {
            type: "basic",
            iconUrl: chromeApi.runtime.getURL("icons/128.png"),
            title: now <= lowest ? "가격이 내렸어요 · 기록 중 최저가" : "가격이 내렸어요",
            message: `${product.title || "관심 상품"}\n${formatPrice(before, product.currency)} → ${formatPrice(now, product.currency)}`,
            contextMessage: SITE_NAMES[product.site] || ""
        }).catch(() => {});
    };

    // 보이지 않게 뒤쪽 탭에서 상품 페이지를 열어 가격을 읽고 닫아요(페이지 주소만 받아오면 가격이 비어 있어요).
    const readInBackgroundTab = async (url) => {
        let windowId;
        try { windowId = (await chromeApi.windows.getLastFocused({windowTypes: ["normal"]})).id; } catch { return null; }
        if (windowId == null) return null;
        const tab = await chromeApi.tabs.create({url, active: false, windowId, index: 9999}).catch(() => null);
        if (!tab?.id) return null;
        try {
            chromeApi.tabs.update(tab.id, {muted: true}).catch(() => {});
            const end = Date.now() + 40000;
            while (Date.now() < end) {
                await sleep(2000);
                const current = await chromeApi.tabs.get(tab.id).catch(() => null);
                if (!current) return null;
                if (current.status !== "complete") continue;
                const [result] = await chromeApi.scripting.executeScript({target: {tabId: tab.id}, func: readProductPage}).catch(() => []);
                const info = result?.result;
                if (info && parsePriceText(info.priceText, info.currency)) return {...info, url: current.url || url};
            }
            return null;
        } finally {
            chromeApi.tabs.remove(tab.id).catch(() => {});
        }
    };

    let checking = false;
    const checkWatched = async () => {
        if (checking) return;
        checking = true;
        try {
            const {on, settings} = await state();
            if (!on || !settings.alerts || !(await granted())) return;
            const now = Date.now();
            let due = dueForCheck(await readProducts(), now, CHECK_EVERY);
            if (!due.length) return;
            // 컴퓨터를 쓰는 중이면 탭이 잠깐 생기는 게 거슬릴 수 있어서, 하루 넘게 확인 못 한 것만 해요.
            let idle = "active";
            try { idle = await chromeApi.idle.queryState(300); } catch { /* 모르면 쓰는 중으로 봐요. */ }
            if (idle === "active") due = due.filter((item) => now - item.checkedAt >= OVERDUE);
            for (const item of due.slice(0, MAX_CHECKS_PER_RUN)) {
                const before = (await readProducts())[item.key]?.points.at(-1)?.[1] || 0;
                const info = await readInBackgroundTab(item.url);
                const parsed = info && parseProductUrl(info.url);
                if (info && parsed?.key === item.key) {
                    const result = await record(info);
                    if (result.product?.watch) await notifyDrop(item.key, result.product, before);
                } else {
                    // 읽지 못했어도(로그인 필요·품절·페이지 바뀜) 다음 간격까지는 다시 열지 않아요.
                    await exclusive(async () => {
                        const products = await readProducts();
                        if (!products[item.key]) return;
                        products[item.key].checkedAt = Date.now();
                        await chromeApi.storage.local.set({[SHOP_PRODUCTS_KEY]: products});
                    });
                }
            }
        } catch (error) {
            console.warn("관심 상품 가격을 확인하지 못했어요.", error);
        } finally {
            checking = false;
        }
    };

    const downloadImages = async (title, images) => {
        const folder = `BongExtend 상품 사진/${safeFolderName(title)}`;
        const urls = [...new Set((Array.isArray(images) ? images : []).map(originalProductImage).filter(Boolean))].slice(0, 40);
        let started = 0;
        for (const [index, url] of urls.entries()) {
            const ext = (new URL(url).pathname.match(/\.(jpe?g|png|webp|gif)$/i)?.[1] || "jpg").toLowerCase().replace("jpeg", "jpg");
            try {
                const id = await chromeApi.downloads.download({url, filename: `${folder}/${String(index + 1).padStart(2, "0")}.${ext}`, conflictAction: "uniquify"});
                if (Number.isInteger(id)) { quietDownloads.add(id); started++; }
            } catch { /* 한 장이 안 돼도 나머지는 받아요. */ }
        }
        return {ok: started > 0, count: started, total: urls.length};
    };

    void sync();
    chromeApi.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes[SHOP_SETTINGS_KEY] || changes[MODULES_KEY])) void sync();
    });
    chromeApi.permissions.onAdded.addListener(() => void sync());
    chromeApi.permissions.onRemoved.addListener(() => void sync());
    chromeApi.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM) void checkWatched(); });
    chromeApi.notifications.onClicked.addListener((id) => {
        if (!id.startsWith(NOTIFY_PREFIX)) return;
        chromeApi.notifications.clear(id);
        void readProducts().then((products) => {
            const url = products[id.slice(NOTIFY_PREFIX.length)]?.url;
            if (url) return chromeApi.tabs.create({url});
        }).catch(() => {});
    });

    chromeApi.runtime.onMessage.addListener((message, sender, reply) => {
        const type = message?.type;
        if (typeof type !== "string" || !type.startsWith("bongextend-shop-")) return undefined;
        const fromExtensionPage = sender.id === chromeApi.runtime.id && String(sender.url || "").startsWith(chromeApi.runtime.getURL(""));
        const fromProductPage = sender.id === chromeApi.runtime.id && Number.isInteger(sender.tab?.id) && Boolean(parseProductUrl(sender.url));
        (async () => {
            const {on, settings} = await state();
            if (!on) { reply({ok: false, error: "쇼핑 기능이 꺼져 있어요."}); return; }
            if (type === "bongextend-shop-seen" && fromProductPage) {
                // 탭 주소를 기준으로 기록해요(페이지가 다른 상품 주소를 보내도 섞이지 않게).
                const result = await record({...message.info, url: sender.url});
                reply({ok: Boolean(result.product), key: parseProductUrl(sender.url)?.key, product: result.product, settings});
            } else if (type === "bongextend-shop-watch" && (fromProductPage || fromExtensionPage)) {
                const products = await exclusive(async () => {
                    const next = setWatch(await readProducts(), String(message.key || ""), message.watch === true);
                    await chromeApi.storage.local.set({[SHOP_PRODUCTS_KEY]: next});
                    return next;
                });
                reply({ok: true, product: products[message.key] || null});
            } else if (type === "bongextend-shop-remove" && fromExtensionPage) {
                await exclusive(async () => chromeApi.storage.local.set({[SHOP_PRODUCTS_KEY]: removeProduct(await readProducts(), String(message.key || ""))}));
                reply({ok: true});
            } else if (type === "bongextend-shop-images" && fromProductPage) {
                reply(await downloadImages(message.title, message.images));
            } else if (type === "bongextend-shop-panel" && fromProductPage) {
                const stored = (await chromeApi.storage.local.get(SHOP_SETTINGS_KEY))[SHOP_SETTINGS_KEY] || {};
                await chromeApi.storage.local.set({[SHOP_SETTINGS_KEY]: {...stored, open: message.open === true}});
                reply({ok: true});
            } else if (type === "bongextend-shop-check-now" && fromExtensionPage) {
                // 팝업의 '지금 확인': 쓰는 중이어도 기다리지 않고 바로 확인해요.
                const products = await readProducts();
                await exclusive(async () => {
                    for (const product of Object.values(products)) if (product.watch) product.checkedAt = 0;
                    await chromeApi.storage.local.set({[SHOP_PRODUCTS_KEY]: products});
                });
                void (async () => {
                    const due = dueForCheck(await readProducts());
                    for (const item of due.slice(0, MAX_CHECKS_PER_RUN)) {
                        const before = (await readProducts())[item.key]?.points.at(-1)?.[1] || 0;
                        const info = await readInBackgroundTab(item.url);
                        if (info && parseProductUrl(info.url)?.key === item.key) {
                            const result = await record(info);
                            if (result.product?.watch && settings.alerts) await notifyDrop(item.key, result.product, before);
                        }
                    }
                })();
                reply({ok: true});
            } else if (type === "bongextend-shop-settings" && fromProductPage) {
                await chromeApi.storage.local.set({"core.popupTab": "shop"});
                await chromeApi.windows.create({url: chromeApi.runtime.getURL("popup.html?window=1"), type: "popup", width: 840, height: 640});
                reply({ok: true});
            } else reply({ok: false});
        })().catch((error) => reply({ok: false, error: String(error?.message || error)}));
        return true;
    });
}
