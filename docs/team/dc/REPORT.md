# 디시 담당 준비 보고

- 역할: 총괄이 배정하는 디시 게시글·댓글·필터·메모·설정 문제의 지정 파일만 처리해요.
- 기준: `main`의 `ae2dfd6`, `package.json` 앱 버전 `1.2.49`를 확인했어요.
- 진입점: `src/entrypoints/dc/`, `src/entrypoints/options/`, `src/entrypoints/content/`, `src/entrypoints/grecaptcha.content.ts`예요.
- 인접 경로: 데이터 로직은 `src/core/`, 저장소 경계는 `src/storage/namespace.ts`예요.
- 보존 사항: 디시 데이터는 local `refresher:*`와 `refresher:popup:lastTab`만 사용하며, 출처·GPL 표기를 유지해요.
- 공유 의존: `src/entrypoints/background.ts`, 팝업 공통 셸, `wxt.config.ts`, 권한·등록, `package.json`, `CHANGELOG.md`는 총괄 소유라 직접 수정하지 않아요.
- 이번 준비 단계에서는 앱 소스 수정, 테스트, 빌드, 커밋, 푸시, 릴리스를 수행하지 않았어요.
- 다음 총괄의 구체적인 증상·파일 범위·완료 조건 배정을 기다려요.
