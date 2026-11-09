# 치지직 담당 보고

## 최신 배정 — 넓은 화면 Chrome 전체화면 요청 유실

- 기준: 2026-11-10, HEAD `9179f8c`, 앱 `1.2.55`와 총괄의 진행 중 변경을 보존했어요.
- 사용자 증상: 넓은 화면에서 Chrome F11 전체화면이 켜지지 않아요.
- 기존 disposable Chrome fixture의 정상 진입/복구는 수정 전에도 통과했어요. 실제 사용자 방송/설정/프로필의 증상은 확인하지 않았어요.
- 확인한 결함: `content-wide.js`가 요청 전에 lastWide를 갱신하고 응답을 버려요. 첫 요청이 inactive/unavailable 또는 전송 오류여도 같은 레이아웃이면 재요청하지 않아요.
- 새 집중 시험에서 최초 inactive 응답 후 추가 요청이 0회인 현상을 수정 전 재현했어요(기대 2회, 실제 1회).
- 수정: `src/modules/chzzk/content-wide.js`에서 응답 확인 후 완료로 기억하고, 미확인/실패는 기존 1초 감시에서 1.2초×시도 횟수 대기 후 최초 포함 최대 4회 시도해요.
- 이미 성공한 상태와 manual-exit, disabled 응답은 반복하지 않아요. 레이아웃/명시 refresh가 바뀌면 새 세대로 처리하며 이전 요청 응답은 무시해요.
- 변경: `src/modules/chzzk/test/content-wide.test.js` 추가, `scripts/verify-chzzk-wide-browser.cjs` 개선, 이 보고서예요. background/공통 파일과 창 복구 소유권 코드는 변경하지 않았어요.
- 집중 단위 시험: content-wide 3개 + wide-fullscreen 기존 9개, 총 12개 통과. 일시 거절 재시도·영구 실패 상한·수동 해제/설정 꺼짐 보존과 기존 복구 규칙을 확인했어요.
- Chrome: 임시 프로필/합성 치지직 DOM에서 첫 fullscreen API 거절을 주입한 뒤 실제 chrome.windows 재시도로 fullscreen 진입 확인. normal 위치/크기·maximized 복구, 기존 fullscreen 보존, manual exit, 탭 이동/복귀, 페이지 이동 및 설정 확인 통과했어요.
- Chrome 증거: `C:/Users/Revaptor_FX/AppData/Local/Temp/be-chzzk-wide-OpcAPE/wide-fullscreen.png`, `wide-setting.png`예요. 실제 로그인 방송이 아닌 fixture예요.
- 브라우저 검사 스크립트는 기존 통합 output을 임시 폴더로 복사하고 담당 source 두 파일만 덮어써요. 원본 .output·사용자 프로필은 변경하지 않았어요.
- 미확인: 사용자 환경의 실제 거절 원인·현 설치 버전·실제 치지직 DOM. 이번 결함 보완만으로 사용자 증상 해결을 확정하지 않아요.
- 전체 빌드·전체 검사·버전·커밋·배포는 총괄 담당이며 실행하지 않았어요. 통합 후 실제 사용자 넓은 화면 전환의 재확인이 필요해요.

## 이전 초기 준비

- 상태: 준비 완료, 다음 명시 배정을 대기해요.
- 기준: `main`, 커밋 `ae2dfd6`, `package.json` 앱 버전 `1.2.49`.
- 실제 Git 루트: `C:/Users/Revaptor_FX/Documents/Codex/2026-11-04/https-github-com-baegovda-bongextend-https/work/BongExtend`.
- 역할: 치지직 광고·재생·시청 정보·통나무 파워·넓은 화면의 배정된 문제만 다뤄요.

## 확인한 핵심 경로

- `src/modules/chzzk/`: 팝업, 콘텐츠 스크립트, 라이브러리, 광고 응답 자료예요.
- `src/modules/chzzk-register.ts`: 동적 콘텐츠 스크립트 등록과 파일 순서예요.
- `src/modules/chzzk/wide-fullscreen.js`, `content-wide.js`: 넓은 화면과 창 상태예요.
- `src/modules/chzzk/content-log-power.js`, `test/log-power.test.js`: 통나무 파워 수령이에요.
- `src/modules/chzzk/test/`, `scripts/verify-chzzk-*.cjs`: 관련 집중 검증 경로예요.

## 공유 의존과 경계

- `src/entrypoints/background.ts`, 팝업 공통 셸, `wxt.config.ts`, 권한·등록, 버전·변경 기록은 총괄 소유예요.
- `chzzk.wideFullscreen`(sync)과 `core.chzzkWideFullscreen`(session)을 구분하고 `chzzk.*` 접두사와 등록 순서를 유지해요.
- F11 연동은 `chrome.windows`만 사용하며 Ctrl+Shift+L·네이티브 단축키·세로 탭 보조 기능은 재도입하지 않아요.
- 실제 로그인 방송과 개인 브라우저는 접근하지 않으며, 필요 시 폐기용 fixture 검증과 실제 방송 검증을 구분해요.

## 이번 초기 배정

- 앱 소스는 수정하지 않았고, 앱 테스트·브라우저 테스트·빌드·커밋·푸시·릴리스도 실행하지 않았어요.
- 기존 작업 트리 변경(`AGENTS.md`, `.cursor/`, `docs/team/`)은 건드리지 않고 이 보고서만 추가했어요.
- 총괄의 다음 구체적 목적·편집 허용 파일·완료 조건·검증 범위를 기다려요.
