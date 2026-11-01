# BongExtend 인수인계 (1.0.15)

이 메모를 쓴 시점: 2026-11-01. main은 `ab16fe9`, 버전은 `package.json`의 **1.0.15**예요. 최신 GitHub 릴리스도 v1.0.15예요. 숫자가 다르면 `package.json`과 [Releases](https://github.com/Baegovda/BongExtend/releases)를 다시 보세요.

## 이 프로젝트가 뭐예요

BongExtend는 크롬 확장(MV3) 하나예요. 예전에 따로 쓰던 확장 세 개를 합쳤어요.

- **치지직**: 예전 BongChzzk
- **번역**: 예전 BongTrans (Gemini)
- **디시**: 예전 BongDC (green1052/DCRefresher-Reborn 포크)

라이선스는 GPL-3.0이에요. 저장소는 [Baegovda/BongExtend](https://github.com/Baegovda/BongExtend)예요. 화면 글과 안내 문서는 한국어 해요체로 써요. 오너는 개발자가 아니에요.

꼭 지킬 규칙(저장 키, 단축키, 권한, `wxt.config.ts`의 `imports.parser`)은 `AGENTS.md`에 있어요. 이 파일은 지금 상태와 남은 일만 적어요.

## 처음 읽을 순서

1. `AGENTS.md`
2. 이 파일 (`MERGE_NOTES.md`)

`CLAUDE.md`, `.cursor/rules/handoff.mdc`, `.github/copilot-instructions.md`도 이 두 파일만 가리켜요. `docs/HANDOFF.md`라는 파일은 없어요. 옛 BongDC 인수인계는 `docs/legacy/BongDC-HANDOFF.md`예요.

그다음이 필요하면 `README.md`(설치·사용), `CHANGELOG.md`(사용자에게 보이는 변경)를 보세요. `docs/legacy/`는 합치기 전 기록이라 지금 규칙이 아니에요.

## 빌드, 테스트, 릴리스

- `bun install`
- `bun run test` — 디시·공통(`bun test`) + 치지직·번역(`node --test`) + 타입 검사(`test:types`, `tsc --noEmit`)
- `bun run build` → `.output/chrome-mv3/`
- `bun run zip` → `.output/bongextend-X.Y.Z-chrome.zip`. 그다음 `bun scripts/verify-release-zip.ts X.Y.Z`

버전 숫자는 `package.json` 하나예요. 사용자용 변경은 `CHANGELOG.md`의 `## [X.Y.Z]`에 적어요. 태그 `vX.Y.Z`를 푸시하면 `.github/workflows/release.yml`이 테스트, 태그=버전 확인, zip, zip 검사, 릴리스 노트를 해요. 푸시·태그·릴리스는 오너가 확인한 뒤에만 해요.

PR을 열거나 main이 아닌 일반 push에는 테스트를 돌리는 GitHub Actions가 없어요. 자동 테스트는 태그 릴리스와 수동 실행뿐이에요.

## 이미 된 일

- 이름 바꾼 저장소에 남아 있던 옛 BongChzzk GitHub **릴리스** v1.1.0–v1.6.2는 지웠어요. **태그** v1.1.0–v1.6.2는 그대로예요. 그래서 업데이트가 "1.6.2로 올리자"고 하던 문제는 없어요. 최신 릴리스는 BongExtend 1.0.15예요.
- 디시 통신사 표는 `Baegovda/BongExtend`의 `main`, 파일 `src/data/ip-isp.json`에서 받아요 (`src/utils/ipIsp.ts`). 예전처럼 `Baegovda/BongDC`의 develop을 보지 않아요.
- 타입 검사는 `bun run test` 안에 있어요 (`test:types`). 빼지 마세요.

## 아직 남은 일

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
- 옛 BongTrans·BongDC 내보내기 파일로 설정을 실제로 가져오기 (자동 테스트만 있어요)
- 번역을 치지직·디시 페이지에서 켰을 때 서로 안 부딪히는지

### 그 밖에

- 아이콘은 아직 옛 BongDC 그림이에요.
- 작업을 main에 바로 넣을지, PR로 넣을지는 아직 정하지 않았어요.

## 헷갈리기 쉬운 옛 파일

`scripts/bootstrap.sh`와 `scripts/bootstrap.ps1`는 옛 BongDC용이에요. `bongdc-*.zip`을 찾고, 없는 `docs/HANDOFF.md`를 가리켜요. BongExtend에서는 쓰지 마세요. 명령은 위의 빌드·테스트 절을 따르면 돼요.
