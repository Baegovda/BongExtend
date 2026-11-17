// 쇼핑 탭: 상품 페이지 가격 기록 창 켜기 · 연결 허용 · 관심 상품 목록과 가격 내림 알림.
// @ts-ignore plain JS shared with the content script and the worker
import {SHOP_ORIGINS, SHOP_PRODUCTS_KEY, SHOP_SETTINGS_KEY, SITE_NAMES, formatPrice, normalizeShopSettings, watchedList} from "@/modules/shop/shop.js";

type Watched = {key: string; site: string; title: string; image: string; url: string; currency: string; watchPrice: number; checkedAt: number;
    stats: {current: number; low: number; high: number; count: number} | null};

export function setupShop() {
    const status = document.getElementById("shopStatus")!;
    const panelToggle = document.getElementById("shop-panel") as HTMLInputElement;
    const alertToggle = document.getElementById("shop-alerts") as HTMLInputElement;
    const permissionState = document.getElementById("shopPermissionState")!;
    const permissionButton = document.getElementById("shopPermission") as HTMLButtonElement;
    const list = document.getElementById("shopWatchList")!;
    const checkNow = document.getElementById("shopCheckNow") as HTMLButtonElement;

    const rawSettings = async () => ((await chrome.storage.local.get(SHOP_SETTINGS_KEY))[SHOP_SETTINGS_KEY] || {}) as Record<string, unknown>;
    const patchSettings = async (patch: Record<string, unknown>) => chrome.storage.local.set({[SHOP_SETTINGS_KEY]: {...(await rawSettings()), ...patch}});
    const isGranted = async () => { try { return await chrome.permissions.contains({origins: SHOP_ORIGINS}); } catch { return false; } };

    const paintPermission = async () => {
        const granted = await isGranted();
        permissionButton.hidden = granted;
        permissionState.textContent = granted
            ? "연결돼 있어요. 이미 열려 있던 상품 페이지는 새로고침하면 가격 기록 창이 나와요."
            : "알리익스프레스 · 타오바오 상품 페이지에서 가격을 읽으려면 연결 허용이 필요해요. 허용하기 전에는 아무것도 기록하지 않아요.";
        alertToggle.disabled = !granted;
        checkNow.disabled = !granted;
    };

    const paintList = async () => {
        const items = watchedList((await chrome.storage.local.get(SHOP_PRODUCTS_KEY))[SHOP_PRODUCTS_KEY]) as Watched[];
        list.replaceChildren();
        if (!items.length) {
            const empty = document.createElement("p");
            empty.className = "shop-empty";
            empty.textContent = "아직 관심 상품이 없어요. 상품 페이지의 가격 기록 창에서 ☆ 관심 상품에 넣기를 눌러요.";
            list.append(empty);
            return;
        }
        for (const item of items) {
            const row = document.createElement("div");
            row.className = "shop-item";
            const img = document.createElement("img");
            img.alt = "";
            img.loading = "lazy";
            img.referrerPolicy = "no-referrer";
            if (item.image) img.src = item.image;
            const main = document.createElement("div");
            main.className = "shop-item-main";
            const link = document.createElement("a");
            link.className = "shop-item-title";
            link.href = item.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = item.title || item.url;
            link.title = item.title;
            const price = document.createElement("div");
            price.className = "shop-item-price";
            const current = item.stats?.current || 0;
            price.textContent = current ? formatPrice(current, item.currency) : "가격 모름";
            if (current && item.watchPrice && current !== item.watchPrice) {
                const change = document.createElement("span");
                const percent = Math.round((Math.abs(current - item.watchPrice) / item.watchPrice) * 100);
                change.className = current < item.watchPrice ? "down" : "up";
                change.textContent = `${current < item.watchPrice ? "▼" : "▲"} ${percent}% (넣을 때 ${formatPrice(item.watchPrice, item.currency)})`;
                price.append(change);
            }
            const meta = document.createElement("div");
            meta.className = "shop-item-meta";
            const checked = item.checkedAt ? new Date(item.checkedAt).toLocaleString("ko-KR", {month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit"}) : "";
            meta.textContent = [SITE_NAMES[item.site], item.stats && item.stats.count > 1 ? `최저 ${formatPrice(item.stats.low, item.currency)}` : "", checked ? `${checked} 확인` : ""].filter(Boolean).join(" · ");
            main.append(link, price, meta);
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "빼기";
            remove.setAttribute("aria-label", `${item.title || "상품"} 관심 상품에서 빼기`);
            remove.addEventListener("click", async () => {
                remove.disabled = true;
                try {
                    await chrome.runtime.sendMessage({type: "bongextend-shop-watch", key: item.key, watch: false});
                    status.textContent = "관심 상품에서 뺐어요. 가격 기록은 남아 있어요.";
                } catch { status.textContent = "빼지 못했어요."; remove.disabled = false; }
            });
            row.append(img, main, remove);
            list.append(row);
        }
    };

    const paint = async () => {
        const settings = normalizeShopSettings(await rawSettings());
        panelToggle.checked = settings.panel;
        alertToggle.checked = settings.alerts;
        await paintPermission();
        await paintList();
    };

    panelToggle.addEventListener("change", async () => {
        const wanted = panelToggle.checked;
        await patchSettings({panel: wanted});
        status.textContent = wanted ? "가격 기록 창을 켰어요." : "가격 기록 창을 껐어요. 상품 페이지에서 가격도 기록하지 않아요.";
    });
    alertToggle.addEventListener("change", async () => {
        const wanted = alertToggle.checked;
        await patchSettings({alerts: wanted});
        status.textContent = wanted ? "관심 상품 가격이 내리면 알려줘요." : "가격 내림 알림을 껐어요.";
    });
    permissionButton.addEventListener("click", async () => {
        try {
            const granted = await chrome.permissions.request({origins: SHOP_ORIGINS});
            status.textContent = granted ? "연결했어요. 상품 페이지를 새로고침하면 가격 기록 창이 나와요." : "허용하지 않았어요.";
        } catch { status.textContent = "권한을 요청하지 못했어요."; }
        await paintPermission();
    });
    checkNow.addEventListener("click", async () => {
        try {
            await chrome.runtime.sendMessage({type: "bongextend-shop-check-now"});
            status.textContent = "관심 상품 가격을 확인하고 있어요. 뒤쪽 탭이 잠깐 열렸다 닫혀요.";
        } catch { status.textContent = "확인을 시작하지 못했어요."; }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[SHOP_PRODUCTS_KEY]) void paintList();
    });
    chrome.permissions.onAdded?.addListener(() => void paintPermission());
    chrome.permissions.onRemoved?.addListener(() => void paintPermission());
    return {show: () => { status.textContent = ""; return paint(); }};
}
