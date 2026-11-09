// @ts-ignore MIT-licensed upstream proxy, kept in sync by scripts/sync-darkreader-proxy.cjs
import {injectProxy} from "@/modules/dark/proxy.js";

export default defineContentScript({
    matches: ["https://mail.google.com/*"],
    registration: "runtime",
    world: "MAIN",
    runAt: "document_start",
    main() {
        const scope = globalThis as unknown as Record<string, unknown>;
        if (scope.__bongextendDarkProxy) return;
        scope.__bongextendDarkProxy = true;
        let cleanup: (() => void) | undefined;
        const start = (detail: string | null) => {
            try {
                const options = JSON.parse(detail || "null");
                if (typeof options?.enableStyleSheetsProxy !== "boolean" ||
                    typeof options?.enableCustomElementRegistryProxy !== "boolean") return;
                cleanup?.();
                cleanup = injectProxy(options.enableStyleSheetsProxy, options.enableCustomElementRegistryProxy);
            } catch { /* Ignore malformed page events; no extension privileges are exposed here. */ }
        };
        const onStart = (event: Event) => start((event as CustomEvent<string>).detail);
        document.addEventListener("__bongextend_dark_proxy_start", onStart);
        let root = document.documentElement;
        new MutationObserver(() => {
            if (document.documentElement === root) return;
            root = document.documentElement;
            cleanup?.();
            cleanup = undefined;
            // document.open removes document listeners while retaining this JS world.
            document.removeEventListener("__bongextend_dark_proxy_start", onStart);
            document.addEventListener("__bongextend_dark_proxy_start", onStart);
            start(root?.getAttribute("data-bong-dark-proxy") || null);
        }).observe(document, {childList: true});
        // Handles runtime injection after the isolated script has already enabled the theme.
        start(document.documentElement?.getAttribute("data-bong-dark-proxy") || null);
    }
});
