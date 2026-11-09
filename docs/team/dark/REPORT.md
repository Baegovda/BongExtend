# 다크 모드 담당 준비 보고서

- 역할: 웹페이지 다크 모드와 Dark Reader CSP·CSSOM·프레임 문제를, 총괄의 명시 배정 범위에서만 맡아요.
- 기준: `main`, `ae2dfd6`, 앱 버전 `1.2.49` (`package.json` 확인)이에요.
- 담당 진입점: `src/entrypoints/dark.content.ts`(ISOLATED 테마), `src/entrypoints/dark-proxy.content.ts`(MAIN 프록시)예요.
- 핵심 경로: `src/modules/dark/`, `patches/darkreader@4.9.134.patch`, `scripts/sync-darkreader-proxy.cjs`예요.
- 검증 후보: `src/modules/dark/test/`, `scripts/verify-dark-csp.cjs` 및 관련 다크 브라우저 검사예요.
- 공유 의존: `src/entrypoints/background.ts`의 등록·즉시 주입·CSS 자원 중계, 팝업 셸, `wxt.config.ts`, manifest·권한·패키지·릴리스 문서는 총괄 영역이에요.
- 현재 확인: 담당 경로에는 미커밋 변경이 없고, 작업 트리의 기존 문서/팀 설정 변경은 보존해요.
- 이번 초기 배정에서는 앱 코드를 수정하지 않았고, 앱 시험·빌드·커밋·푸시·릴리스를 실행하지 않았어요.
- 다음 상태: 총괄의 구체적 증상·편집 허용 파일·검증 범위 배정을 기다려요.
