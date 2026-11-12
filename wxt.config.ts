import {defineConfig} from "wxt";
import {readdirSync, statSync} from "node:fs";
import {join, relative, resolve} from "node:path";

// 치지직·번역 모듈은 빌드 없이 쓰는 순수 JS라서
// src/modules/{chzzk,trans,theme} 파일을 그대로 결과물 chzzk/, trans/, theme/ 폴더에 복사한다. theme/theme.css = 공통 테마. (테스트·배경 스크립트 제외)
const MODULE_ROOT = resolve(__dirname, "src/modules");
const STATIC_MODULES: Record<string, (rel: string) => boolean> = {
    chzzk: (rel) => !rel.startsWith("test/"),
    theme: (rel) => rel.endsWith(".css"),
    trans: (rel) => !rel.startsWith("test/") && rel !== "background.js"
};
const listFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
});
export const staticModuleFiles = () => Object.entries(STATIC_MODULES).flatMap(([name, keep]) => {
    const base = join(MODULE_ROOT, name);
    return listFiles(base)
        .map((full) => ({full, rel: relative(base, full).split("\\").join("/")}))
        .filter(({rel}) => keep(rel))
        .map(({full, rel}) => ({absoluteSrc: full, relativeDest: `${name}/${rel}`}));
});

export default defineConfig({
    srcDir: "src",
    // 기본 정규식 스캐너는 `(ip) =>` 같은 화살표 함수 매개변수를 utils/ip.ts 자동 import로 본다.
    // ipIsp.ts → ip.ts → ipIsp.ts 순환이 생기고, 배경 스크립트는 검증 함수가 생기기 전에 표를 읽어 바로 죽는다.
    imports: {
        parser: "oxc"
    },
    webExt: {
        startUrls: ["https://chzzk.naver.com", "https://gall.dcinside.com"]
    },
    hooks: {
        "build:publicAssets": (_wxt, files) => {
            files.push(...staticModuleFiles());
        }
    },
    modules: [
        "@wxt-dev/auto-icons",
        "@wxt-dev/webextension-polyfill",
        "@wxt-dev/module-vue"
    ],
    manifest: {
        name: "BongExtend",
        homepage_url: "https://github.com/Baegovda/BongExtend",
        content_security_policy: {
            extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
        },
        description: "치지직·디시인사이드 개선, Gemini 번역, 다크 모드, 다운로드 관리 기능을 담은 확장 프로그램",
        minimum_chrome_version: "109",
        default_locale: "en",
        oauth2: {
            client_id: "450788627700-b4u9la88b9jii904fet8l7p20c0iotv5.apps.googleusercontent.com",
            scopes: ["https://www.googleapis.com/auth/gmail.modify"]
        },
        storage: {managed_schema: "checkerplus-schema.json"},
        action: {
            default_title: "BongExtend"
        },
        commands: {
            "toggle-translation": {
                suggested_key: {default: "Ctrl+Shift+Y"},
                description: "현재 페이지 번역 켜기/끄기"
            }
        },
        permissions: [
            "activeTab",
            "alarms",
            "contextMenus",
            "declarativeNetRequest",
            "downloads",
            "notifications",
            "offscreen",
            "idle",
            "storage",
            "scripting",
            "tabs",
            "windows",
            "unlimitedStorage",
            "clipboardWrite",
            "nativeMessaging"
        ],
        host_permissions: [
            "https://*.dcinside.com/*",
            "https://chzzk.naver.com/*",
            "https://api.chzzk.naver.com/*",
            "https://generativelanguage.googleapis.com/*",
            "https://api.github.com/*",
            "https://github.com/*",
            "https://objects.githubusercontent.com/*",
            "https://release-assets.githubusercontent.com/*",
            "https://mail.google.com/*",
            "https://latest.currency-api.pages.dev/*",
            "https://scanner.tradingview.com/*",
            "wss://data.tradingview.com/*"
        ],
        // 항상 번역을 켤 때 그 사이트만 요청한다. host_permissions 에 <all_urls> 를 넣지 않는다.
        optional_host_permissions: [
            "https://*/*",
            "http://*/*",
            "https://www.googleapis.com/*",
            "https://gmail.googleapis.com/*",
            "https://*.googleusercontent.com/*"
        ],
        optional_permissions: [
            "webRequest", "clipboardRead", "downloads.open", "downloads.ui",
            "identity", "cookies", "gcm", "system.display"
        ],
        content_scripts: [
            {
                matches: ["https://mail.google.com/mail/mu/mp/*"],
                include_globs: ["https://mail.google.com/mail/mu/*mui=checkerPlusForGmail*"],
                js: ["js/tabletView.js"],
                run_at: "document_start",
                all_frames: true
            },
            {
                matches: ["https://mail.google.com/mail/mu/mp/*"],
                include_globs: ["https://mail.google.com/mail/mu/*mui=checkerPlusForGmail*"],
                js: ["js/tabletViewScript.js"],
                run_at: "document_start",
                all_frames: true,
                world: "MAIN"
            }
        ],
        web_accessible_resources: [
            {
                resources: ["assets/*.webp"],
                matches: ["<all_urls>"]
            },
            {
                resources: [
                    "chzzk/noop.js",
                    "chzzk/ima-stub.js",
                    "chzzk/empty-ad-schedule.json",
                    "chzzk/empty-ad-waterfall.json",
                    "chzzk/empty-ad-poll.json"
                ],
                matches: ["https://chzzk.naver.com/*"]
            },
            {
                resources: ["checkerplus-options.html", "contribute.html"],
                matches: ["https://jasonsavard.com/*", "https://checkout.stripe.com/*", "https://www.paypal.com/*", "https://nowpayments.io/*"]
            },
            {
                resources: ["css/tabletView.css"],
                matches: ["https://mail.google.com/*"]
            }
        ],
        browser_specific_settings: {
            gecko: {
                data_collection_permissions: {
                    required: ["none"]
                }
            }
        }
    }
});
