// 상품 페이지에서 이름 · 대표 사진 · 사진 목록 · 가격 글자를 읽어요.
// 콘텐츠 스크립트와 백그라운드의 가격 확인(scripting.executeScript)이 함께 써서, 바깥 값을 쓰지 않는 한 함수로 둬요.
// 가격 글자는 그대로 돌려주고 숫자로 바꾸는 일은 shop.js의 parsePriceText가 해요.
export function readProductPage() {
    const text = (el) => (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
    const visible = (el) => el && el.getClientRects().length > 0;
    const host = location.hostname;
    const out = {title: "", image: "", images: [], priceText: "", currency: ""};
    const addImage = (src) => {
        const value = String(src || "").trim();
        if (!value || value.startsWith("data:") || out.images.includes(value) || out.images.length >= 40) return;
        out.images.push(value.startsWith("//") ? `https:${value}` : value);
    };
    if (/(^|\.)aliexpress\.com$/.test(host)) {
        for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
            let data;
            try { data = JSON.parse(script.textContent || ""); } catch { continue; }
            for (const item of Array.isArray(data) ? data : [data]) {
                if (!item || item["@type"] !== "Product") continue;
                out.title = out.title || String(item.name || "");
                for (const src of [].concat(item.image || [])) addImage(src);
                const offer = [].concat(item.offers || [])[0];
                const price = offer?.lowPrice ?? offer?.price;
                if (price != null && !out.priceText) { out.priceText = String(price); out.currency = String(offer.priceCurrency || ""); }
            }
        }
        // 화면에 보이는 할인가가 구조화 데이터보다 최신일 수 있어요(옵션을 고른 경우).
        const shown = Array.from(document.querySelectorAll('[class*="price-kr--current"], [class*="price--current"], [class*="price-default--current"]')).find(visible);
        if (shown && /\d/.test(text(shown))) out.priceText = text(shown);
        for (const img of document.querySelectorAll('[class*="slider--img"] img, [class*="image-view"] img')) addImage(img.currentSrc || img.src);
        out.title = out.title || document.querySelector('meta[property="og:title"]')?.content || text(document.querySelector("h1"));
        out.image = document.querySelector('meta[property="og:image"]')?.content || out.images[0] || "";
    } else {
        // 타오바오: 쿠폰·할인 뒤 가격(강조 가격)을 먼저 봐요.
        const price = ['[class*="highlightPrice"]', '[class*="normalPrice"]', '[class*="Price--priceText"]', '[class*="priceText"]']
            .map((selector) => Array.from(document.querySelectorAll(selector)).find((el) => visible(el) && /\d/.test(text(el))))
            .find(Boolean);
        if (price) {
            out.priceText = text(price);
            out.currency = "CNY";
        }
        const title = document.querySelector('[class*="mainTitle"], [class*="ItemTitle"] h1, [class*="itemTitle"]');
        out.title = text(title) || document.title.replace(/[-–|].*(taobao|淘宝).*$/i, "").trim();
        for (const img of document.querySelectorAll('[class*="picGallery"] img, [class*="PicGallery"] img')) addImage(img.currentSrc || img.src);
        if (!out.images.length) for (const img of document.querySelectorAll('[class*="thumbnail"] img, [class*="mainPic"] img')) addImage(img.currentSrc || img.src);
        out.image = out.images[0] || "";
    }
    out.title = String(out.title || "").replace(/\s+/g, " ").trim().slice(0, 200);
    return out;
}
