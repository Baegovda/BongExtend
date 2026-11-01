export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*",
        "https://gallog.dcinside.com/*"
    ],
    world: "MAIN",
    runAt: "document_end",
    main() {
        // 토큰은 페이지로 보내지 않는다. 배경 스크립트가 이 페이지의 grecaptcha 를 직접 호출한다.
        const script = document.createElement("script");
        script.src = "https://www.google.com/recaptcha/api.js?render=6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
        script.async = true;
        document.head.appendChild(script);
    }
});
