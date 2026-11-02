# BongExtend 인수인계 (1.1.1)

코드 버전은 `package.json`의 **1.1.1**예요. 최신 GitHub 릴리스도 v1.1.1이고, 설치 파일은 `bongextend-1.1.1-chrome.zip`이에요. 숫자가 다르면 `package.json`과 [Releases](https://github.com/Baegovda/BongExtend/releases)를 다시 보세요.

## 이 프로젝트가 뭐예요

BongExtend는 크롬 확장(MV3) 하나예요. 예전에 따로 쓰던 확장 세 개를 합쳤어요.

- **치지직**
- **번역**: Gemini
- **디시**: green1052/DCRefresher-Reborn 포크

라이선스는 GPL-3.0이에요. 저장소는 [Baegovda/BongExtend](https://github.com/Baegovda/BongExtend)예요. 화면 글과 안내 문서는 한국어 해요체로 써요. 오너는 개발자가 아니에요.

꼭 지킬 규칙(저장 키, 단축키, 권한, `wxt.config.ts`의 `imports.parser`)은 `AGENTS.md`에 있어요. 이 파일은 지금 상태와 남은 일만 적어요.

## 처음 읽을 순서

1. `AGENTS.md`
2. 이 파일 (`MERGE_NOTES.md`)

`CLAUDE.md`, `.cursor/rules/handoff.mdc`, `.github/copilot-instructions.md`도 이 두 파일만 가리켜요. `docs/HANDOFF.md`라는 파일은 없어요.

그다음이 필요하면 `README.md`(설치·사용), `CHANGELOG.md`(사용자에게 보이는 변경)를 보세요.

## 빌드, 테스트, 릴리스

- `bun install`
- `bun run test` — 세 단계를 이어서 해요.
  - `test:dc`: `bun test src/core src/modules/settings-io.test.ts src/storage/update-keys.test.ts src/utils/sanitizeHtml.test.ts src/entrypoints/dc/composables/popupTabs.test.ts`
  - `test:js`: `node --test`로 치지직·번역 테스트
  - `test:types`: `tsc --noEmit -p tsconfig.json`
- `bun run build` → `.output/chrome-mv3/`
- `bun run zip` → `.output/bongextend-X.Y.Z-chrome.zip`. 확인은 `bun run verify`예요. 버전을 안 적으면 `package.json`을 쓰고, 크롬 zip만 봐요. `bun scripts/verify-release-zip.ts X.Y.Z`와 같아요.

`package.json`의 `dev:firefox`, `build:firefox`, `zip:firefox`는 로컬에서 파이어폭스 산출물을 만들 때 쓰는 스크립트예요. 릴리스 워크플로는 크롬 zip만 만들어요. 업데이트도 크롬 zip(`*-chrome.zip`)만 받아요. `*-firefox.zip`은 찾지 않아요.

버전 숫자는 `package.json` 하나예요. 사용자용 변경은 `CHANGELOG.md`의 `## [X.Y.Z]`에 적어요. 태그 `vX.Y.Z`를 푸시하면 `.github/workflows/release.yml`이 테스트, 태그=버전 확인, zip, zip 검사, 빌드 결과의 eval 검사, 릴리스 노트를 해요. 같은 파일을 수동으로 실행하면 테스트와 zip 검사만 하고 릴리스는 만들지 않아요. main 푸시와 PR은 `.github/workflows/ci.yml`이 `bun install`, `bun run test`, `bun run build`, `bun scripts/check-no-eval.ts`를 해요. 푸시·태그·릴리스는 오너가 확인한 뒤에만 해요.

## 이미 된 일

- 이름 바꾸기 전 저장소의 GitHub 릴리스는 지웠어요. 태그 v1.1.0, v1.1.1, v1.2.0, v1.3.0, v1.3.1, v1.4.0, v1.5.0, v1.5.1, v1.6.0, v1.6.1, v1.6.2도 지웠어요. 최신 릴리스는 BongExtend 1.1.1예요.
- 치지직 광고 차단은 기본으로 켜져 있어요. 광고 일정과 배너 응답을 비우고, 건너뛴 뒤에는 이전 소리를 되돌려요. 로그인된 방송에서 직접 본 기록은 아직 없어요.
- 디시 통신사 표는 `Baegovda/BongExtend`의 `main`, 파일 `src/data/ip-isp.json`에서 받아요 (`src/utils/ipIsp.ts`의 `IP_ISP_REF`는 `main`).
- 타입 검사는 `bun run test` 안에 있어요 (`test:types`). 빼지 마세요.
- 확장 아이콘 원본은 `src/assets/icon.png`이고, 청록에서 보라로 이어지는 BongExtend 로고예요. `@wxt-dev/auto-icons`가 빌드 때 크기별 아이콘을 만들어요. 팝업과 업데이트 화면은 그 로고를 써요. 번역 설정의 `src/modules/trans/icons/`도 같은 로고예요. 디시 화면 안 작은 그림(`src/assets/icons/*.webp`, 추천·차단 같은 버튼)은 기능 그림이에요.

## 아직 남은 일

### 메일 알림 지연

로그인된 Gmail 세션의 Atom 피드만 봐요. Google Cloud OAuth는 없어요. Gmail 탭이 없어도 오프스크린 문서가 `mail.google.com/mail/u/0`부터 로그인된 계정을 모두, 기본 8초마다 피드만 확인해요. 알림 제목과 목록에 어느 계정인지 나와요. 계정마다 끌 수 있고, 끈 계정은 주소를 안 뒤에는 다시 받지 않아요. 다른 계정은 Gmail 프로필의 계정 추가로 로그인하면 목록에 나타나요. 자리를 비우면 1분, 화면이 잠기면 2분, 오프라인이면 요청을 쉬어요. 알림을 끄면 그 문서를 닫아요. Gmail 탭 제목이 바뀌면 즉시 한 번 더 확인해요.

### 실제 기기에서 확인할 것

코드는 들어갔지만, 로그인된 실제 크롬에서 본 기록은 아직 없어요. [PR #1](https://github.com/Baegovda/BongExtend/pull/1)에서 특히 아래를 봐 주세요.

- **항상 번역**: 번역 탭에서 이 사이트를 항상 번역하면, 그 사이트만 권한 창이 뜨는지. 허용하면 그 사이트를 새 탭으로 열어도 자동으로 번역되는지. 거절하면 스위치가 다시 꺼지는지. 스위치를 끄면 다음 방문에는 자동 번역이 안 되는지.
- **복구 소리**: 치지직에서 버퍼링 복구 뒤 소리가 유지되는지. 복구 중에 직접 음소거하면 그 상태가 그대로인지.
- **디시 미리보기**: 글 미리보기와 댓글이 예전처럼 보이는지.

같이 아직인 것:

- 치지직 라이브를 보면서 기능이 모두 도는지
- Gemini 키로 페이지가 실제로 번역되는지
- 로그인한 디시 기능
- 우클릭 메뉴를 눌렀을 때
- 예전 번역 설정 파일(`page-translator-settings`)과 예전 디시 설정(`refresher:*`)으로 설정을 실제로 가져오기 (자동 테스트만 있어요)
- 번역을 치지직·디시 페이지에서 켰을 때 서로 안 부딪히는지

### 그 밖에

- 코드와 릴리스는 오너가 확인한 뒤에 반영해요.

## 새 기기 점검

`scripts/bootstrap.sh`와 `scripts/bootstrap.ps1`는 새 기기 점검용이에요. `bun run test`(치지직·번역 테스트와 타입 검사 포함), 빌드, zip 뒤에 `bongextend-*-chrome.zip`만 확인해요. 파이어폭스 zip은 보지 않아요. 안내 문서는 `AGENTS.md`와 이 파일이에요.
