# BongExtend — 에이전트 안내

BongExtend는 치지직, Gemini 번역, 디시인사이드(green1052/DCRefresher-Reborn 포크)를 합친 크롬 MV3 확장. 라이선스 GPL-3.0.
오너(Guilliman / GitHub Baegovda)는 개발자가 아님. 화면 글, README, CHANGELOG, 보고는 한국어로 쉽게.

## 꼭 지킬 것
- `wxt.config.ts`의 `imports.parser: "oxc"`는 빼지 말 것 (기본 스캐너가 순환 import를 만들어 배경 스크립트가 죽음).
- 단축키(`commands`)는 오너 요청으로 번역 켜기/끄기(`toggle-translation`) 하나만 허용. 다른 단축키는 따로 요청받기 전까지 추가하지 말 것.
- manifest `key` 넣지 말 것 (새 확장 ID로 시작하기로 함).
- 권한에 `webNavigation`을 넣지 말 것. `host_permissions`에 `<all_urls>`도 넣지 말 것. 지금 호스트 권한은 `https://*.dcinside.com/*`, `https://chzzk.naver.com/*`, `https://api.chzzk.naver.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.github.com/*`, `https://github.com/*`, `https://objects.githubusercontent.com/*`, `https://release-assets.githubusercontent.com/*`, `https://mail.google.com/*`예요. 항상 번역용 `optional_host_permissions`는 `https://*/*`, `http://*/*`예요. 사이트를 켤 때 그 주소만 요청해요. WAR `assets/*.webp`의 `matches: <all_urls>`는 디시 모듈 그대로예요.
- 지금 `permissions`는 `activeTab`, `alarms`, `contextMenus`, `downloads`, `notifications`, `idle`, `storage`, `scripting`, `tabs`, `windows`, `unlimitedStorage`, `clipboardWrite`예요.
- Gemini API 키는 서비스 워커와 확장 페이지에서만. 콘텐츠 스크립트에 보내지 말 것. `GET_PREFS`가 보내는 값은 `prioritizeCursor`, `revealAnimation`, `targetLanguage`뿐이에요.
- 번역 `content.js`는 비모듈 IIFE예요. 본문 글은 `nodeValue`로만 쓰고, 툴팁은 `title` 속성으로 바꿔요 (`innerHTML` 금지). `executeScript`에 넘기는 함수는 클로저 없이 자체 완결.
- 저장소 구역: 디시 `refresher:*`(옛 키 그대로, local), 치지직 `chzzk.*`(sync/local, `src/modules/chzzk/lib/ns.js`가 접두사를 붙임), 번역 `trans.*`(local. 예: `trans.settings`, `trans.cacheStats`, `trans.alwaysOrigins`), 공통 `core.*`(local. 예: `core.modules`, `core.popupTab`, `core.popupTabOrder`, `core.update:*`). 디시 안쪽 탭 위치는 `refresher:popup:lastTab`이에요. 디시 데이터 작업(가져오기/초기화/백업)은 `src/storage/namespace.ts`로 다른 구역을 건드리지 않아요. `chrome.storage.*.clear()` 쓰지 말 것. 번역 캐시 IndexedDB 이름은 `page-translator`, 업데이트 폴더 핸들 IndexedDB 이름은 `bongextend-install`이에요.
- 치지직 콘텐츠 스크립트는 배경에서 `chrome.scripting.registerContentScripts`로 등록 (`src/modules/chzzk-register.ts`). 파일 순서 바꾸지 말 것.

## 구조
- `src/entrypoints/` WXT 진입점: `background.ts`(서비스 워커 하나), `popup/`(탭 셸. 치지직·번역·디시는 iframe, 업데이트·설정은 이 페이지 안), `dc/`(디시 Vue 팝업 → `dc.html`), `options/`(디시 전체 설정 → `options.html`), `update/`(원클릭 업데이트 → `update.html`), `content/` + `grecaptcha.content.ts`(디시).
- 팝업 iframe 주소: `/chzzk/popup.html`, `/trans/popup/popup.html`, `/dc.html`.
- `src/modules/chzzk/` 치지직 순수 JS (빌드 때 그대로 `chzzk/`로 복사. 테스트 폴더는 제외).
- `src/modules/trans/` 번역 순수 JS. `background.js`는 `startTransBackground()`로 배경에 붙고 복사하지 않아요. 테스트 폴더도 제외하고 나머지는 `trans/`로 복사해요.
- `src/modules/theme/`는 빌드 때 `theme/`로 복사해요. 공통 테마는 `theme/theme.css`예요.
- `src/modules/core-modules.js` 모듈 스위치(`core.modules`), `src/modules/settings-io.ts` 설정 내보내기·가져오기. 파일 종류는 `bongextend-settings`(전체), `page-translator-settings`(예전 번역 설정), `refresher:*` JSON(예전 디시 설정), 치지직 설정 키만 있는 객체예요.
- 확장 아이콘 원본은 `src/assets/icon.png`예요. `@wxt-dev/auto-icons`가 크기를 만들어요. 디시 버튼 그림은 `src/assets/icons/*.webp`예요.
- 그 밖의 `src/*`(core, storage, utils, components, …)는 디시 모듈 코드. 경로 그대로 둠. 디시 모듈 라이선스 표시(green1052/DCRefresher-Reborn)는 빼지 말 것.

## 명령
- `bun install`
- `bun run dev` — 크롬 개발 서버. `bun run dev:firefox`는 로컬 파이어폭스용이에요.
- `bun run test` = `test:dc` + `test:js` + `test:types`
  - `test:dc`: `bun test src/core src/modules/settings-io.test.ts src/storage/update-keys.test.ts src/utils/sanitizeHtml.test.ts src/entrypoints/dc/composables/popupTabs.test.ts`
  - `test:js`: `node --test src/modules/chzzk/test/*.test.js src/modules/trans/test/*.test.js`
  - `test:types`: `tsc --noEmit -p tsconfig.json`
- `bun run build` → `.output/chrome-mv3/`. `bun run build:firefox`는 로컬용이에요.
- `bun run zip` → `.output/bongextend-X.Y.Z-chrome.zip`. 확인은 `bun run verify`예요. 버전을 안 적으면 `package.json`을 쓰고, 크롬 zip만 봐요. `bun scripts/verify-release-zip.ts X.Y.Z`와 같아요.
- `bun run zip:firefox`는 로컬용이에요. 릴리스 워크플로는 쓰지 않아요.

## 릴리스
- 버전은 `package.json` 하나. `CHANGELOG.md`에 `## [X.Y.Z]` 섹션.
- 태그 `vX.Y.Z` 푸시 → `.github/workflows/release.yml`(테스트, 태그=버전 확인, `bun run zip`, zip 검사, 빌드 결과의 eval 검사, 노트, gh release). 크롬 zip만 올려요. 같은 워크플로의 수동 실행은 테스트와 zip 검사만 하고 릴리스는 만들지 않아요. main 푸시와 PR은 `.github/workflows/ci.yml`이 `bun install`, `bun run test`, `bun run build`, `bun scripts/check-no-eval.ts`를 해요. 릴리스는 만들지 않아요. 서비스 워커에서 `Function()`을 쓰지 말 것. MV3가 막아서 등록이 실패해요.
- 푸시·태그·릴리스는 오너가 확인한 뒤에만.
