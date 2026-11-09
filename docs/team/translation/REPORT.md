# 번역 담당 준비 보고

- 역할: Gemini 번역, 프리즘 애니메이션, 번역 캐시·설정, 항상 번역 권한과 번역 전용 화면을 총괄의 명시 배정 범위에서 담당해요.
- 기준: `main`, HEAD `ae2dfd6`, `package.json` 앱 버전 `1.2.49`을 확인했어요.
- 실제 Git 루트: `C:/Users/Revaptor_FX/Documents/Codex/2026-11-04/https-github-com-baegovda-bongextend-https/work/BongExtend`이에요.
- 주요 진입점: `src/modules/trans/background.js`, `content/content.js`, `lib/gemini.js`, `lib/translator.js`예요.
- 관련 범위: `lib/{settings,settings-store,prompt,chunk,errors,cache,cache-policy,origin-permission,toggle-state,badge}.js`, `toolbar-progress.js`, `popup/`, `options/`, `test/`예요.
- 공유 의존: `src/entrypoints/background.ts`, 전체 팝업 셸, `wxt.config.ts`, 권한·등록, `package.json`, `CHANGELOG.md`는 총괄 소유이며 직접 수정하지 않아요.
- 계약 주의: 콘텐츠 스크립트는 비모듈 IIFE이고 본문은 `nodeValue`, 툴팁은 `title`만 사용해요. Gemini 키와 `GET_PREFS` 허용 필드도 기존 계약을 유지해요.
- 데이터·권한 주의: `trans.*` local 저장소와 `page-translator` IndexedDB를 보존하고, 항상 번역은 대상 사이트의 선택 권한만 요청해요.
- 이번 초기 배정에서는 앱 소스를 수정하지 않았고, 앱 시험·빌드·커밋·푸시·릴리스도 실행하지 않았어요.
- 기존 작업 트리에 총괄/다른 담당의 준비 문서 변경이 있어 보존했어요.
- 다음 총괄의 구체적 목표와 편집 허용 파일 배정을 기다려요.
