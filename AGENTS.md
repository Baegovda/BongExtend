# BongExtend — 에이전트 안내

## 모듈 담당 팀

사용자는 ForgeLens처럼 총괄과 모듈별 실제 독립 채팅을 나누도록 요청했어요. 팀 작업 시 [조정 문서](docs/team/COORDINATION.md)에서 기존 채팅과 파일 소유권을 확인하고 재사용하세요. 역할 지침은 `.cursor/agents/bong-*.md`, 공통 협업 규칙은 `.cursor/rules/module-team.mdc`예요. 담당자가 없는 새 과제는 총괄이 배정하며, 새 작업 없이 자체 백로그를 만들지 않아요.

팀원은 사용자에게 따로 진행·질문·완료 메시지나 알림을 보내지 않고, 작업 결과·근거·막힘을 담당 REPORT.md 또는 가능한 내부 경로로 총괄에게만 보고해요. 사용자 소통과 최종 보고는 총괄이 모아서 맡아요. 사용자 소유 채팅의 UI 자체가 숨겨진다고 주장하지 않아요.

과하지 않게 필요한 팀만 배정하고 기본 추론은 medium 이하로 해요. **Astra는 정말 어려운 문제나 서로 다른 합리적인 접근을 수차례 시도해도 해결되지 않는 문제에만** 예외로 사용해요. 일반 오류·첫 실패·단순 지연을 이유로 올리지 말고, 예외 투입의 근거와 이유를 짧게 알려요.

## Primary execution policy — act first, report after

최우선 작업 기조는 **토큰 낭비를 최소화하면서 효율적이고 꼼꼼하고 빠르게 끝내기**예요. 기존 근거를 재사용하고 검색·출력 범위를 좁히며, 독립 작업만 묶어서 병렬 처리해요. 팀은 꼭 필요한 담당만 호출하고 변경 위험에 맞는 검증으로 마무리해요. 중복 조사·통과한 검사 반복·과도한 지시 왕복·불필요한 설명은 줄이되, 필수 검증·데이터 보호·실제 화면 확인·미검증 한계 보고는 생략하지 않아요.

This is the owner's primary working agreement for this project, within higher-priority instructions and actual tool permissions.

- Complete authorized work end to end, including an already authorized release. Do not stop at a plan, partial fix, routine obstacle, or permission already granted.
- Chain remaining agreed work without waiting for a new prompt. If one task is blocked, immediately advance independent remaining work, then report the unresolved dependency precisely.
- Diagnose failures, use permitted alternatives, and continue useful work. Ask only for indispensable input after completing independent work. Never hide a blocker or claim unperformed work succeeded.
- Optimize speed, stability, completeness, and token cost together. Use available PC resources and safe independent parallel operations when useful; avoid resource saturation, redundant exploration, and unchanged retries.
- Run required and risk-relevant checks. Repeat passing checks only when relevant changes, failures, stale evidence, or unresolved risks justify it. Documentation-only edits do not require application tests or a new release.
- Open the actual UI or a suitable viewer for visual work. Inspect representative states, fix observed usability and performance problems, and recheck changed behavior. Clearly distinguish live observations from simulations.
- For Windows inspection, follow `.cursor/rules/windows-inspection.mdc`: use read-only process data, GetWindowRect, and captures of already visible windows. Do not activate, restore, move, resize, or drive the GUI just to inspect it. Never use alternative capture methods to bypass a policy block.
- Proactively make clear, low-risk improvements within the task's scope. Preserve BongExtend's identity and existing workflows. Avoid cosmetic churn and endless self-assigned work after completion.
- Preserve active objectives and existing changes across interruptions and compaction. Report briefly in easy Korean 해요체: concrete changes, evidence, limitations, and any necessary user action.

BongExtend는 치지직, Gemini 번역, 디시인사이드(green1052/DCRefresher-Reborn 포크)를 합친 크롬 MV3 확장. 라이선스 GPL-3.0.
오너(Guilliman / GitHub Baegovda)는 개발자가 아님. 화면 글, README, CHANGELOG, 보고는 한국어로 쉽게.

완료 보고는 구현·작업 항목마다 독립된 한 줄의 목록으로 쓰고, 항목 문장 전체를 굵게 표시해요. 예: `- **메일 계정 순서 변경 구현 완료**`. 길게 합치거나 중첩 목록으로 쓰지 않아요. 실제 끝낸 것만 완료로 쓰고, 검증 결과·미검증·남은 문제·사용자 조치는 아래 별도 문장으로 짧게 적어요.

사용자가 지적한 UI 문제는 해당 사이트를 재현 사례로 삼은 **공통 규칙 요청**으로 해석해요. 사이트마다 센스 있게 지원하는 느낌을 목표로, 도메인 목록을 계속 늘리는 방식보다 페이지 구조·계산된 대비·기존 의미색을 로컬에서 분석해 조건에 맞는 사이트에 자동 적용하는 공통 엔진으로 구현해요. 특정 사이트 패치만 추가해서 이 요청을 완료했다고 하지 않아요. 사진·브랜드·숨김·비활성 상태를 보존하고 성능 상한과 해제 복원을 검증해요. 안전하게 판단할 수 없는 경우의 기술적 한계는 숨기지 않고 보고해요. 외부 AI로 페이지 내용·계정 정보를 임의 전송하지 않아요.

다크 모드는 사진·캐릭터·배너를 단순 명암 비율만으로 아이콘이라 판단해 통째로 반전하거나 숨기지 않아요. 원본 이미지 색을 기본 보존하고, 작은 투명 조작 이미지의 중립색 글자처럼 안전하게 판별한 부분만 보정해요. 그림이 포함된 CSS 그라데이션의 테마 처리와 이미지 원색 보존을 함께 검증해요.

다크 모드의 제품 목표는 **수석 웹디자이너가 그 사이트를 분석하고 직접 다크 테마로 다시 설계한 것처럼 자연스러운 결과**예요. 단순한 전체 흑색화·일괄 반전·최소 대비 통과만으로 완성이라고 판단하지 않아요. 페이지 고유의 정체성과 의미색을 살리면서 배경/카드/떠 있는 메뉴의 깊이, 선택·hover·focus 상태, 제목/본문/보조 글자의 위계, 표·차트 분류, 사진·로고 원색을 구조와 실제 합성 색에 따라 공통적으로 분석해요. 사이트별 하드코딩 목록보다 재사용 가능한 의미·구조·대비 규칙을 우선하고, 여러 형태의 실제 화면과 예외 상태를 직접 검수해 품질을 판단해요. 이 목표는 모든 사이트의 완벽한 처리나 경쟁 제품보다 우월함이 이미 입증됐다는 주장이 아니에요.

2026-11-10 사용자 디자인 기준: **세련됨, 고급스러움, 유리 질감, 그라데이션, 정의하기 힘든 오묘한 색상, 애플 느낌의 감성**이에요. BongExtend 전체 UI를 이 방향으로 리메이크하도록 승인했어요. 공통 토큰을 기준으로 절제된 반투명 면·빛나는 얇은 경계·깊이·진주빛 청색/보라/청록의 색감을 쓰고, 과한 광택·상시 움직임·내용 위 장식을 피하세요. 밝은/어두운 테마, 읽기 대비, 키보드 focus, 작은 창, reduced motion과 불투명 fallback을 함께 검수해요. 기존 기능·데이터·발신자 HTML·브랜드·라이선스는 보존해요.

최신 팔레트 수정: **남색 기운을 줄이고 기존 Google/Chrome 테마에 어울리는 중립 차콜·흑연색 / 밝은 회색을 바탕**으로 써요. 오묘한 진주빛·유리 질감·절제된 그라데이션은 경계와 강조 영역으로 살리고 전체 화면을 푸르게 물들이지 않아요. Chrome의 개인 테마 색을 실제로 읽지 않았다면 자동으로 정확히 동기화했다고 주장하지 않아요. 사용자친화적 리메이크는 상태→주요 동작→세부 설정 흐름, 쉬운 명칭과 빈 상태의 다음 행동, 모듈 간 같은 크기의 탭, 한 줄로 비교할 수 있는 다운로드 정보가 기준이에요.

최신 메일 요청(2026-11-10): Gmail·네이버 본문도 **앱 다크 테마에 맞춰 자동 다크**로 표시해요. 웹 다크 모드와 같은 upstream 색 변환을 본문 범위에만 쓰고 사진·로고·구조·동작은 보존해요. 기존 ‘발신자 본문 색 보존’은 **원본 색 모드에서 정확히 복원**하는 기준이며 새 요청의 자동 다크를 막는 근거로 쓰지 않아요. 본문 테마는 자동/다크/원본 선택(core.mailBodyTheme), 다크 모듈 OFF는 원본 복원이에요. Ctrl+휠은 본문 배율50~200%, 일반 휠은 스크롤을 유지해요. 큰 메일은 무리하게 일부만 테마하지 않고 전체 원본을 보존해요.

최신 다크 스타일 요청(2026-11-10): **스타일 연결은 사이트마다 반복 승인하지 않고 한 번 허용하면 자동 적용**해요. 사용자가 명시적으로 누르는 ‘스타일 자동 연결 한 번 허용’은 기존 optional `https://*/*`를 Chrome에 요청하고, 실제 grant를 기준으로 이후 안내를 생략해요. 새 필수 권한이나 자동 grant는 넣지 않아요. 다크 적용 사이트 선택·제외·모듈 OFF는 그대로 따르고 권한 추가/회수 시 열린 허용 사이트에도 다시 적용해요. 이전의 사이트별 CSS 권한 요청 방식보다 이 지시가 우선해요.

## 꼭 지킬 것
- `wxt.config.ts`의 `imports.parser: "oxc"`는 빼지 말 것 (기본 스캐너가 순환 import를 만들어 배경 스크립트가 죽음).
- 단축키(`commands`)는 오너 요청으로 번역 켜기/끄기(`toggle-translation`) 하나만 허용. 다른 단축키는 따로 요청받기 전까지 추가하지 말 것.
- manifest `key` 넣지 말 것 (새 확장 ID로 시작하기로 함).
- 권한에 `webNavigation`을 넣지 말 것. `host_permissions`에 `<all_urls>`도 넣지 말 것. 지금 호스트 권한은 `https://*.dcinside.com/*`, `https://chzzk.naver.com/*`, `https://api.chzzk.naver.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.github.com/*`, `https://github.com/*`, `https://objects.githubusercontent.com/*`, `https://release-assets.githubusercontent.com/*`, `https://mail.google.com/*`, `https://latest.currency-api.pages.dev/*`, `https://scanner.tradingview.com/*`, `wss://data.tradingview.com/*`예요. 항상 번역용 `optional_host_permissions`는 `https://*/*`, `http://*/*`예요. 사이트를 켤 때 그 주소만 요청해요. WAR `assets/*.webp`의 `matches: <all_urls>`는 디시 모듈 그대로예요.
- 지금 `permissions`는 `activeTab`, `alarms`, `contextMenus`, `declarativeNetRequest`, `downloads`, `notifications`, `offscreen`, `idle`, `storage`, `scripting`, `tabs`, `windows`, `unlimitedStorage`, `clipboardWrite`, `nativeMessaging`예요. `nativeMessaging`은 사용자가 선택한 PC 로컬 영상 다운로드 보조 프로그램 연결용이에요. 치지직 넓은 화면은 `chrome.windows`로 F11과 같은 전체화면을 켜고, 소유한 변경만 이전 창 상태로 복구해요. Ctrl+Shift+L 자동 입력은 제거됐어요. 치지직 광고 차단 규칙은 이 권한의 동적 규칙이고, 요청을 보낸 쪽이 `chzzk.naver.com`일 때만 적용해요.
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
- 태그 `vX.Y.Z` 푸시 → `.github/workflows/release.yml`(테스트, 태그=버전 확인, `bun run zip`, zip 검사, 빌드 결과의 eval 검사, 노트, gh release). 크롬 zip과 Windows 영상 보조 프로그램 zip을 올려요. 보조 프로그램은 별도 Windows 작업에서 컴파일해요. 같은 워크플로의 수동 실행은 테스트와 zip 검사만 하고 릴리스는 만들지 않아요. main 푸시와 PR은 `.github/workflows/ci.yml`이 `bun install`, `bun run test`, `bun run build`, `bun scripts/check-no-eval.ts`를 해요. 릴리스는 만들지 않아요. 서비스 워커에서 `Function()`을 쓰지 말 것. MV3가 막아서 등록이 실패해요.
