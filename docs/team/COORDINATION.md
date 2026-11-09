# BongExtend 모듈 담당 팀

2026-11-09 사용자 요청으로 ForgeLens의 실제 독립 채팅·공통 조정 문서·담당 보고서 방식을 참고했어요. ForgeLens 자체의 작업이나 정책을 가져오는 문서는 아니에요.

## 기준과 총괄

- 앱 기준: 1.2.49, `ae2dfd6`, main. 최신 상태는 항상 실제 Git과 package.json을 다시 확인해요.
- 실제 Git 루트: `C:/Users/Revaptor_FX/Documents/Codex/2026-11-04/https-github-com-baegovda-bongextend-https/work/BongExtend`.
- 저장된 BongExtend 프로젝트 폴더 `C:/Users/Revaptor_FX/Documents/BongExtend`는 배포 폴더이므로 그곳을 소스 체크아웃으로 오인하지 않아요.
- 총괄 채팅 **BongExtend 총괄팀**: `01a1bb89-9992-7853-86aa-786939c62cff`, host `local`. 공통 코드, 파일 배정, 결과 통합, 검수, 커밋·푸시·릴리스 소유자예요.
- 각 담당의 세션 ID는 아래 명단에 기록해요. 채팅이 완료됐다는 표시는 해당 배정이 끝났다는 뜻이며 계속 실행 중이라는 뜻은 아니에요.

## 초기 배정

현재 새 기능이나 오류 수정 과제는 없어요. 각 팀은 AGENTS.md → MERGE_NOTES.md → HANDOVER.md → 자기 역할 지침을 읽고, 최신 앱 기준과 담당 진입점을 확인해 자기 REPORT.md에 준비 완료를 남겨요. 오래된 인계 버전보다 실제 package.json·커밋과 최신 사용자 지시를 우선해요.

앱 소스는 읽기 전용이에요. 로그인·유료 API·사용자 브라우저 접근, 전체 회귀 시험, 임의 버그 찾기, 앱 수정, 커밋·배포는 초기 과제에 포함되지 않아요. 별도 브랜치나 worktree도 만들지 않아요.

## 파일 소유권과 작업 흐름

1. 사용자는 총괄에 요청해요. 총괄은 기존 모듈 채팅에 목적·편집 허용 파일·완료 조건·검증 범위를 전달해요.
2. 담당은 자기 파일만 바꿔요. 공유 코드가 필요하면 변경안을 총괄에 보고해요. 작업이 겹치면 총괄이 순서나 소유자를 정해요.
3. 담당은 REPORT.md에 기준 커밋, 변경 파일, 결과와 증거, 미검증 사항, 총괄에 필요한 요청을 남기고 배정을 마쳐요.
4. 총괄은 보고서와 실제 diff를 읽고 필요한 통합 변경·검증·승인된 배포를 수행해요. 앱 개선 작업이 없으면 새 버전을 발행하지 않아요.

기본 공유 파일: `src/entrypoints/background.ts`, 팝업 공통 셸, `wxt.config.ts`, 권한/등록, `package.json`, `CHANGELOG.md`, 정식 인계 문서. 모듈별 경로 전체를 무조건 독점하는 것이 아니라 배정된 파일 단위로 소유해요. Chrome fixture는 폐기용 프로필만 사용하며 실계정 동작을 입증했다고 쓰지 않아요.

별도 채팅은 사용자에게 보이고 같은 파일 시스템을 공유해요. 총괄은 진행 확인에 compact `wait_threads`를 우선하고, 이 문서의 상태보다 도구로 확인한 실제 상태를 우선해요. 모든 세션은 사용 한도를 공유하며 할 일이 끝나면 추가 실행하지 않아요.

## 난이도에 따른 모델·추론 강도

사용자는 총괄이 매 작업의 난이도를 판단해 담당 팀의 모델과 추론 강도를 조절하도록 승인했어요. 매번 다시 승인을 묻지 않고, 실제 도구와 해당 호스트가 지원하는 모델·강도 범위에서 다음 배정이나 재시도에 적용해요. 실행 중인 턴이 즉시 전환됐다고 말하지 않아요.

- 일반적인 모듈 수정은 GPT-6.1 Sol / medium부터 시작해요. 단순 문서·작은 정리는 low를 고려해요.
- 여러 파일의 상태·비동기·권한·회귀 영향을 추적하는 진단과 통합 검토는 Sol / high를 고려해요.
- 화면을 보고 범위가 좁은 UI를 수정하는 업무에는 GPT-6.1 Terra / medium을 고려해요.
- 근거를 좁혀도 해결되지 않는 어려운 원인 분석은 GPT-6 Astra / high를 고려해요. xhigh·max는 추가 품질이 실제로 필요한 경우에만 선택해요.
- 위 조합은 고정 규칙이나 성능 보장이 아닌 출발점이에요. 작업 범위·실패 원인·검증 결과·시간과 사용량을 보고 올리거나 낮춰요. 같은 실패를 강도만 높여 반복하지 않아요.
- 배정 시 선택한 모델·강도와 짧은 이유를 전달해요. 사용자가 특정 설정을 지정하면 그 지시가 우선해요. 현재 대기 팀에는 설정 변경만을 위한 무의미한 턴을 시작하지 않아요.

## 담당 명단

8개 채팅 모두 최초 준비 배정을 마쳤고, 담당 REPORT.md를 총괄이 읽었어요. 현재 다음 명시 배정을 기다리며, 상시 자동 실행은 없어요. 역할/보고서 문서만 추가했으며 앱 변경·새 릴리스는 없어요.

- 메일: `01a1c01c-c05e-7651-b093-30893dbb571b`, host `local`; 역할 `.cursor/agents/bong-mail.md`; 보고서 `docs/team/mail/REPORT.md`.
- 번역: `01a1c01c-c1a6-7141-a0af-29d140d9a134`, host `local`; 역할 `.cursor/agents/bong-translation.md`; 보고서 `docs/team/translation/REPORT.md`.
- 다크 모드: `01a1c01c-c2f0-76d0-82e2-def58d8be43c`, host `local`; 역할 `.cursor/agents/bong-dark.md`; 보고서 `docs/team/dark/REPORT.md`.
- 치지직: `01a1c01c-c4a8-76f1-808e-27925bd3e714`, host `local`; 역할 `.cursor/agents/bong-chzzk.md`; 보고서 `docs/team/chzzk/REPORT.md`.
- 다운로더: `01a1c01c-c622-7883-b2a0-930a8e2b748b`, host `local`; 역할 `.cursor/agents/bong-downloader.md`; 보고서 `docs/team/downloader/REPORT.md`.
- 디시: `01a1c01c-c749-7091-98c6-32ae53aab03a`, host `local`; 역할 `.cursor/agents/bong-dc.md`; 보고서 `docs/team/dc/REPORT.md`.
- 환율: `01a1c01c-c8a1-70e1-82ec-98e9c7e20d67`, host `local`; 역할 `.cursor/agents/bong-fx.md`; 보고서 `docs/team/fx/REPORT.md`.
- 우클릭팀 (**BongExtend 우클릭팀**): `01a1c01c-ca13-70c1-ab40-b7d280388d35`, host `local`; 역할 `.cursor/agents/bong-rightclick.md`; 보고서 `docs/team/rightclick/REPORT.md`.
