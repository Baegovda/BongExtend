# 우클릭팀 준비 보고

- 역할: 사용자 선택 사이트의 우클릭·복사·선택 복구만 담당해요.
- 기준: `main`, HEAD `ae2dfd6`, 앱 버전 `1.2.49` (`package.json`)이에요.
- 확인 순서: `AGENTS.md` → `MERGE_NOTES.md` → `HANDOVER.md` → 공통 조정 문서 → 역할 지침을 읽었어요.
- 핵심 경로: `src/modules/rightclick/background.js`, `origin.js`, `inject.js`, `test/rightclick.test.js`예요.
- 참고 경로: 권한 요청·토글 연결은 `src/entrypoints/popup/main.ts`에서 필요한 범위만 읽어요.
- 공유 의존: 팝업 공통 셸, `src/entrypoints/background.ts`, `wxt.config.ts`, 권한/등록, `package.json`, `CHANGELOG.md`, 정식 인계 문서는 총괄 소유예요.
- 이번 준비 배정에서는 앱 코드·공유 파일을 수정하지 않았어요.
- 이번 준비 배정에서는 시험, 빌드, 커밋, 푸시, 릴리스, 사용자 브라우저 접근을 하지 않았어요.
- 기존 작업 트리 변경은 보존했고, 이 보고서만 추가했어요.
- 다음 총괄의 구체적 목적·편집 허용 파일·완료 조건·검증 범위 배정을 기다려요.
