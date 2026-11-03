# 기여

오너는 개발자가 아니에요. 화면 글, README, CHANGELOG, 보고는 한국어로 쉽게 써요.

시작은 `AGENTS.md`, 그다음 `HANDOVER.md`예요. 설치와 사용은 `README.md`, 사용자에게 보이는 변경은 `CHANGELOG.md`예요.

## 고칠 때

- 권한, manifest `key`, `webNavigation`, `host_permissions`의 `<all_urls>`는 넣지 마세요. 꼭 필요하면 멈추고 이유를 적어요.
- 사용자 저장값은 지우지 마세요. `chrome.storage.*.clear()`도 쓰지 마세요.
- `.github/FUNDING.yml`은 고치지 마세요.
- 시험은 가짜로 해요. 진짜 Gmail, Gemini, 치지직, 디시에 요청하지 마세요.
- 단축키는 번역 켜기/끄기 하나만 두세요.
- `wxt.config.ts`의 `imports.parser: "oxc"`는 빼지 마세요.
- 서비스 워커에서 `eval`이나 `Function` 생성자를 쓰지 마세요.

## 확인

`bun install` 다음 `bun run test`, 그다음 `bun run build`예요. 빌드 결과는 `bun scripts/check-no-eval.ts .output/chrome-mv3`로 봐요.

## 반영

작업 브랜치에서 PR을 열어요. CI가 초록이면 스쿼시로 합치고, 합친 브랜치는 지워요. 버전을 올릴 때만 `package.json`과 `CHANGELOG.md`를 같이 바꾸고, 오너가 확인한 뒤에 태그 `vX.Y.Z`를 푸시해요. 문서만 바꾼 경우에는 태그와 릴리스가 필요 없어요.
