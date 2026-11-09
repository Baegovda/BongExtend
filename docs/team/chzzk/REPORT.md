# 치지직 담당 준비 보고

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
