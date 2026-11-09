# 환율 모듈 준비 보고

- 역할: 환율 계산, 통화 선택, 저장 환율표 갱신의 명시 배정 작업을 담당해요.
- 기준: `main`, HEAD `ae2dfd6`, 앱 버전 `1.2.49` (`package.json` 확인).
- 시작 상태: 기존 작업 트리에 `AGENTS.md`, `.cursor/agents/`, `.cursor/rules/module-team.mdc`, `docs/team/` 변경이 있으며 보존했어요.

## 담당 진입점

- `src/modules/fx/convert.js`: 계산, 선택, 환율표 병합과 저장 키예요.
- `src/modules/fx/refresh.js`: 저장표 갱신과 실패 시 대체 동작이에요.
- `src/modules/fx/tradingview.js`: 주요 시세 조회와 교차 환산이에요.
- `src/modules/fx/background.js`, `currency-names.js`, 필요한 `src/modules/fx/test/`가 인접 범위예요.

## 경계와 의존

- 공유 의존은 `src/entrypoints/popup/fx-picker.ts`, `main.ts`, 공통 배경·팝업 셸이에요. 공유 파일 변경은 총괄에 제안만 해요.
- 선택·순서·입력값과 `fx.favorites`, `fx.table`, `fx.dailyTable`을 보존해요.
- `fx.dailyTable`의 비주요 통화와 갱신 실패 시 저장표 유지 동작을 지켜요.

이번 초기 배정에서는 앱 소스를 수정하지 않았고, 테스트·빌드·릴리스도 실행하지 않았어요.
다음 총괄의 구체적인 문제·파일 범위·완료 조건 배정을 기다려요.
