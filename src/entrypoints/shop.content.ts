// @ts-ignore plain JS shared with the popup and the worker
import {SITE_NAMES, chartPath, formatPrice, originalProductImage, parsePriceText, parseProductUrl, priceStats} from "@/modules/shop/shop.js";
// @ts-ignore plain JS shared with the worker
import {readProductPage} from "@/modules/shop/read-page.js";

// 알리익스프레스 · 타오바오 상품 페이지 오른쪽 아래의 가격 기록 창.
// 가격 기록 그래프 · 관심 상품(가격 내리면 알림) · 깨끗한 링크 복사 · 상품 사진 한 번에 받기.
// 닫힌 Shadow DOM 안에만 그려서 사이트 스타일과 서로 영향을 주지 않아요. 기록은 이 PC에만 저장돼요.
type Product = {site: string; title: string; image: string; url: string; currency: string; points: [number, number][]; watch: boolean; watchPrice: number};
type PageInfo = {title: string; image: string; images: string[]; priceText: string; currency: string};

export default defineContentScript({
    // 빌드용 값이에요(필수 권한에 쇼핑몰 주소가 들어가지 않게 이미 있는 주소만 적어요). 실제 범위는 사용자가 허용한 뒤 백그라운드가 등록해요.
    matches: ["https://mail.google.com/*"],
    registration: "runtime",
    runAt: "document_idle",
    main() {
        const scope = globalThis as unknown as Record<string, boolean | undefined>;
        if (scope.__bongextendShop || window !== window.top) return;
        scope.__bongextendShop = true;

        const send = <T>(message: Record<string, unknown>) => chrome.runtime.sendMessage(message) as Promise<T>;
        const stale = () => !chrome.runtime?.id;

        const host = document.createElement("bongextend-shop");
        host.style.cssText = "all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483600;";
        const root = host.attachShadow({mode: "closed"});
        root.innerHTML = `<style>
:host{all:initial}
*{box-sizing:border-box;font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif}
.wrap{color:#E9ECF5;font-size:13px;line-height:1.45}
.pill{display:flex;align-items:center;gap:8px;height:40px;padding:0 14px 0 10px;border-radius:20px;cursor:pointer;
 background:linear-gradient(180deg,rgba(30,34,46,.94),rgba(18,21,30,.94));border:1px solid rgba(255,255,255,.14);
 box-shadow:0 10px 30px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.10);color:#E9ECF5;font-size:13px;font-weight:600;transition:transform .15s ease-out,box-shadow .15s ease-out}
.pill:hover{transform:translateY(-1px);box-shadow:0 14px 34px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.14)}
.pill:focus-visible,button:focus-visible{outline:2px solid #8FB2FF;outline-offset:2px}
.dot{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:linear-gradient(135deg,#4C8AFE,#A98BFF)}
.dot svg{width:14px;height:14px}
.trend{font-size:11px;font-weight:600;padding:1px 6px;border-radius:8px;background:rgba(255,255,255,.08)}
.trend.down{color:#5FE0A6}.trend.up{color:#FF9C8A}
.card{width:332px;border-radius:14px;padding:14px 14px 12px;
 background:linear-gradient(180deg,rgba(32,36,50,.96),rgba(15,18,26,.97));border:1px solid rgba(255,255,255,.13);
 box-shadow:0 18px 48px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.10);backdrop-filter:blur(18px)}
.head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.label{font-size:11.5px;color:#A9B1C7;letter-spacing:.01em;flex:1}
.icon{all:unset;cursor:pointer;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;color:#A9B1C7}
.icon:hover{background:rgba(255,255,255,.08);color:#fff}
.icon svg{width:15px;height:15px}
.title{font-size:12.5px;color:#C9D0E2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}
.now{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.price{font-size:24px;font-weight:700;letter-spacing:-.01em;color:#fff}
.badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:9px;color:#0B0D12;background:linear-gradient(135deg,#7DE3B6,#8FB2FF)}
.range{font-size:12px;color:#A9B1C7;margin-top:2px}
.range b{color:#E9ECF5;font-weight:600}
svg.chart{display:block;width:100%;height:96px;margin:10px 0 4px;border-radius:10px;background:rgba(255,255,255,.035)}
.foot{font-size:11px;color:#8A93AB;margin-bottom:10px}
.actions{display:flex;gap:6px;flex-wrap:wrap}
button.btn{all:unset;cursor:pointer;flex:1 1 auto;text-align:center;font-size:12.5px;font-weight:600;padding:8px 10px;border-radius:10px;
 background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#E9ECF5;transition:background .15s ease-out}
button.btn:hover{background:rgba(255,255,255,.12)}
button.btn.on{background:linear-gradient(135deg,#3D6EE0,#7A5AD6);border-color:transparent;color:#fff}
button.btn.wide{flex-basis:100%}
.status{min-height:16px;font-size:11.5px;color:#A9B1C7;margin-top:8px}
@media (prefers-reduced-motion:reduce){.pill,button.btn{transition:none}.pill:hover{transform:none}}
</style><div class="wrap"></div>`;
        const wrap = root.querySelector(".wrap") as HTMLDivElement;

        let key = "";
        let product: Product | null = null;
        let page: PageInfo | null = null;
        let open = false;
        let status = "";

        const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", textValue = "") => {
            const node = document.createElement(tag);
            if (cls) node.className = cls;
            if (textValue) node.textContent = textValue;
            return node;
        };
        const svgIcon = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
        const day = (t: number) => new Date(t).toLocaleDateString("ko-KR", {month: "numeric", day: "numeric"});
        const fullDay = (t: number) => new Date(t).toLocaleDateString("ko-KR");
        // 같은 사진의 크기만 다른 주소(썸네일·큰 사진)는 한 장으로 세요.
        const uniqueImages = (images: string[]) => [...new Set(images.map((src) => originalProductImage(src) as string).filter(Boolean))];

        const chart = (points: [number, number][]) => {
            const ns = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(ns, "svg");
            svg.setAttribute("class", "chart");
            svg.setAttribute("viewBox", "0 0 304 96");
            svg.setAttribute("preserveAspectRatio", "none");
            svg.setAttribute("role", "img");
            const path = chartPath(points, 304, 96);
            svg.setAttribute("aria-label", `가격 기록 그래프: 최저 ${formatPrice(path.min, product?.currency)}, 최고 ${formatPrice(path.max, product?.currency)}`);
            svg.innerHTML = `<defs><linearGradient id="l" gradientUnits="userSpaceOnUse" x1="0" x2="304" y1="0" y2="0"><stop offset="0" stop-color="#4C8AFE"/><stop offset="1" stop-color="#A98BFF"/></linearGradient>
<linearGradient id="a" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7E8CFF" stop-opacity=".32"/><stop offset="1" stop-color="#7E8CFF" stop-opacity="0"/></linearGradient></defs>`;
            const area = document.createElementNS(ns, "path"); area.setAttribute("d", path.area); area.setAttribute("fill", "url(#a)");
            const line = document.createElementNS(ns, "path"); line.setAttribute("d", path.line); line.setAttribute("fill", "none"); line.setAttribute("stroke", "url(#l)"); line.setAttribute("stroke-width", "2"); line.setAttribute("vector-effect", "non-scaling-stroke");
            svg.append(area, line);
            for (const dot of path.dots) {
                const circle = document.createElementNS(ns, "circle");
                circle.setAttribute("cx", String(dot.x)); circle.setAttribute("cy", String(dot.y)); circle.setAttribute("r", "2.6");
                circle.setAttribute("fill", "#fff"); circle.setAttribute("vector-effect", "non-scaling-stroke");
                const tip = document.createElementNS(ns, "title"); tip.textContent = `${fullDay(dot.at)} · ${formatPrice(dot.price, product?.currency)}`;
                circle.append(tip);
                svg.append(circle);
            }
            return svg;
        };

        const render = () => {
            wrap.replaceChildren();
            if (!product || !product.points.length) return;
            const stats = priceStats(product.points)!;
            const currency = product.currency;
            const previous = product.points.length > 1 ? product.points[product.points.length - 2][1] : 0;
            if (!open) {
                const pill = el("button", "pill");
                pill.setAttribute("aria-label", `가격 기록 열기: 지금 ${formatPrice(stats.current, currency)}`);
                pill.innerHTML = `<span class="dot">${svgIcon('<path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>')}</span>`;
                pill.append(el("span", "", formatPrice(stats.current, currency)));
                if (previous && previous !== stats.current) pill.append(el("span", `trend ${stats.current < previous ? "down" : "up"}`, stats.current < previous ? "▼" : "▲"));
                pill.addEventListener("click", () => setOpen(true));
                wrap.append(pill);
                return;
            }
            const card = el("div", "card");
            card.setAttribute("role", "dialog");
            card.setAttribute("aria-label", "가격 기록");
            const head = el("div", "head");
            head.append(el("span", "label", `${SITE_NAMES[product.site] || "쇼핑"} · 가격 기록`));
            const settings = el("button", "icon"); settings.title = "쇼핑 설정"; settings.setAttribute("aria-label", "쇼핑 설정 열기");
            settings.innerHTML = svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>');
            settings.addEventListener("click", () => { void send({type: "bongextend-shop-settings"}).catch(() => {}); });
            const close = el("button", "icon"); close.title = "접기"; close.setAttribute("aria-label", "가격 기록 접기");
            close.innerHTML = svgIcon('<path d="M6 9l6 6 6-6"/>');
            close.addEventListener("click", () => setOpen(false));
            head.append(settings, close);
            const title = el("div", "title", product.title);
            const now = el("div", "now");
            now.append(el("span", "price", formatPrice(stats.current, currency)));
            if (stats.count > 1 && stats.current <= stats.low) now.append(el("span", "badge", "기록 중 최저가"));
            const range = el("div", "range");
            if (stats.count > 1) {
                range.innerHTML = `최저 <b></b> (${day(stats.lowAt)}) · 최고 <b></b> (${day(stats.highAt)})`;
                const bold = range.querySelectorAll("b");
                bold[0].textContent = formatPrice(stats.low, currency);
                bold[1].textContent = formatPrice(stats.high, currency);
            } else range.textContent = "처음 기록했어요. 다시 볼 때마다, 관심 상품이면 6시간마다 가격이 쌓여요.";
            const foot = el("div", "foot", `${fullDay(stats.first)}부터 · 기록 ${stats.count}개 · 이 PC에만 저장돼요`);
            const actions = el("div", "actions");
            const watch = el("button", `btn wide${product.watch ? " on" : ""}`, product.watch ? "★ 관심 상품 · 가격 내리면 알려줘요" : "☆ 관심 상품에 넣기");
            watch.setAttribute("aria-pressed", String(product.watch));
            watch.addEventListener("click", async () => {
                try {
                    const reply = await send<{ok: boolean; product: Product | null}>({type: "bongextend-shop-watch", key, watch: !product?.watch});
                    if (reply?.product) product = reply.product;
                    status = product?.watch ? "관심 상품에 넣었어요. 가격이 내리면 알림을 보내요." : "관심 상품에서 뺐어요.";
                } catch { status = stale() ? "확장 프로그램이 업데이트됐어요. 이 페이지를 새로고침해 주세요." : "저장하지 못했어요."; }
                render();
            });
            const copy = el("button", "btn", "링크 복사");
            copy.addEventListener("click", async () => {
                const url = product?.url || location.href;
                try { await navigator.clipboard.writeText(url); status = "추적 꼬리를 뗀 상품 링크를 복사했어요."; }
                catch { status = "복사하지 못했어요."; }
                render();
            });
            const count = uniqueImages(page?.images || []).length;
            const photos = el("button", "btn", count ? `사진 ${count}장 받기` : "사진 받기");
            photos.addEventListener("click", async () => {
                const fresh = readProductPage() as PageInfo;
                const images = uniqueImages(fresh.images.length ? fresh.images : page?.images || []);
                if (!images.length) { status = "받을 사진을 찾지 못했어요."; render(); return; }
                status = "사진을 받는 중이에요…"; render();
                try {
                    const reply = await send<{ok: boolean; count: number; total: number}>({type: "bongextend-shop-images", title: product?.title || fresh.title, images});
                    status = reply?.ok ? `사진 ${reply.count}장을 "BongExtend 상품 사진" 폴더에 받았어요.` : "사진을 받지 못했어요.";
                } catch { status = stale() ? "확장 프로그램이 업데이트됐어요. 이 페이지를 새로고침해 주세요." : "사진을 받지 못했어요."; }
                render();
            });
            actions.append(watch, copy, photos);
            const statusLine = el("div", "status", status);
            statusLine.setAttribute("role", "status");
            card.append(head, title, now, range, chart(product.points), foot, actions, statusLine);
            wrap.append(card);
        };

        const setOpen = (value: boolean) => {
            open = value;
            status = "";
            render();
            void send({type: "bongextend-shop-panel", open: value}).catch(() => {});
        };

        // 가격이 그려질 때까지 기다렸다가 기록해요. 옵션을 바꿔 주소(skuId)가 바뀌면 다시 읽어요.
        let reading = 0;
        const readAndRecord = async () => {
            const parsed = parseProductUrl(location.href);
            const run = ++reading;
            if (!parsed) { key = ""; product = null; render(); return; }
            for (let attempt = 0; attempt < 20 && run === reading; attempt++) {
                const info = readProductPage() as PageInfo;
                if (parsePriceText(info.priceText, info.currency)) {
                    page = info;
                    try {
                        const reply = await send<{ok: boolean; key: string; product: Product | null; settings: {open: boolean}}>({type: "bongextend-shop-seen", info});
                        if (run !== reading || !reply?.ok || !reply.product) return;
                        key = reply.key;
                        product = reply.product;
                        open = reply.settings?.open === true;
                        if (!host.isConnected) document.documentElement.append(host);
                        render();
                    } catch { /* 쇼핑 기능이 꺼졌거나 확장이 업데이트됐어요. */ }
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        };

        let lastUrl = location.href;
        void readAndRecord();
        setInterval(() => {
            if (stale()) return;
            if (location.href === lastUrl) return;
            lastUrl = location.href;
            void readAndRecord();
        }, 1500);
        // 다른 탭에서 관심 상품을 바꾸면 따라가요.
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local" || !key || !changes["shop.products"]) return;
            const next = (changes["shop.products"].newValue as Record<string, Product> | undefined)?.[key];
            if (next && product && next.watch !== product.watch) { product = {...product, watch: next.watch}; render(); }
        });
    }
});
