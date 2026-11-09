# 다운로더 담당 준비 보고

- 상태: 준비 완료, 다음 명시 배정을 기다려요.
- 기준: `main`, `ae2dfd6`, 앱 버전 `1.2.49` (`package.json` 확인).
- 실제 Git 루트: `C:/Users/Revaptor_FX/Documents/Codex/2026-11-04/https-github-com-baegovda-bongextend-https/work/BongExtend`.
- 역할: 다운로더 목록, Chrono 연결, 저장 규칙, 영상 받기와 PC 영상 보조 프로그램을 배정된 범위에서만 맡아요.

## 확인한 담당 진입점

- `src/modules/downloads/`, `src/entrypoints/downloads/`, `src/modules/chrono-register.ts`
- `public/recent-downloads.{html,css,js}`, `public/download-module.{css,js}`, `public/video-downloader.{html,css,js}`
- `public/chrono-worker.js`, `public/js/chrono-action-bridge.js`, Chrono 원본 관리자·설정 파일
- `native/video/host.py`, `native/video/Launcher.cs`, `scripts/package-video-helper.ps1`

## 공유 경계와 상태

- 공유 파일 `src/entrypoints/background.ts`, 팝업 공통 셸, manifest·권한, `wxt.config.ts`, 버전·변경 기록은 총괄과 조정해요.
- `core.video:history`, `core.video:status`와 Chrono 출처·라이선스 표시는 보존해요.
- 사용자 실제 확장 ID 등록·네이티브 호스트 연결·영상 저장 성공은 아직 미검증으로 유지해요.
- 이번 초기 배정에서는 앱 코드 수정, 테스트, 빌드, 커밋, 푸시, 릴리스를 하지 않았어요.
- 작업 시작 전 상태에서 다른 작업자의 변경(`AGENTS.md`, `.cursor/agents/`, `.cursor/rules/module-team.mdc`, `docs/team/`)을 보존했어요.
