# BongExtend 인수인계

코드 버전은 `package.json`의 **1.2.8**예요. 설치 파일은 [Releases](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.8)의 `bongextend-1.2.8-chrome.zip`이에요. 숫자가 다르면 `package.json`과 Releases를 다시 보세요.

오너(Guilliman / GitHub Baegovda)는 개발자가 아니에요. 화면 글, README, CHANGELOG, 보고는 한국어로 쉽게 써요.

꼭 지킬 짧은 규칙은 `AGENTS.md`예요. 이 파일은 구조, 저장, 시험, 릴리스, 화면, 남은 일을 한곳에 모은 거예요.

## 이 프로젝트가 뭐예요

BongExtend는 크롬 확장(MV3) 하나예요. 예전에 따로 쓰던 기능을 합쳤어요. 라이선스는 GPL-3.0이에요. 저장소는 [Baegovda/BongExtend](https://github.com/Baegovda/BongExtend)예요.

- **메일**: 로그인된 Gmail의 읽지 않은 메일을 계정마다 보여요. Google Cloud 로그인은 없어요. Gmail이 이미 로그인된 브라우저의 받은편지함 피드만 봐요.
- **번역**: Gemini로 지금 보는 페이지의 글을 번역해요.
- **치지직**: 라이브 시청을 돕는 기능과 광고 가리기예요.
- **디시**: 디시인사이드 글 목록 새로고침·미리보기·차단이에요. 코드 폴더는 `dc`이고, 저장 키는 예전 이름 `refresher`예요. green1052/DCRefresher-Reborn 포크예요.
- **환율**: 원, 달러, 엔 같은 통화를 바꿔 봐요.

## 어떻게 만들어져 있어요

도구는 WXT(확장 뼈대), Vue 3(디시 화면만), TypeScript, Bun이에요. 치지직·번역·환율·메일의 많은 부분은 빌드 때 그대로 복사되는 순수 자바스크립트예요.

- `src/entrypoints/background.ts`: 서비스 워커는 이 파일 하나예요. 메일, 번역, 우클릭, 업데이트, 치지직 스크립트 등록이 여기 붙어요.
- `src/entrypoints/popup/`: 팝업 껍데기예요. 가운데 탭은 치지직·번역·디시·메일·환율이에요. 치지직·번역·디시는 iframe이고, 메일·환율·업데이트는 이 페이지 안이에요.
- `src/entrypoints/options/`: 확장 프로그램 세부정보의 설정 화면이에요. 왼쪽 탭은 메일, 환율, 치지직, 번역, 디시, 우클릭, 설정이에요.
- `src/entrypoints/dc/`: 디시 Vue 화면(`dc.html`).
- `src/modules/gmail/`: 메일. 배경은 `watch.js`와 `background.js`, 화면은 팝업이에요.
- `src/modules/trans/`: 번역. `background.js`는 배경에 `startTransBackground()`로 붙고, 페이지 글은 `content/content.js`를 나중에 넣어요.
- `src/modules/chzzk/`: 치지직. 배경이 `src/modules/chzzk-register.ts`로 콘텐츠 스크립트를 등록해요. 이 파일 순서는 바꾸지 마세요.
- `src/modules/fx/`: 환율 계산과 나라 색.
- `src/modules/rightclick/`: 사이트의 오른쪽 클릭을 되살려요.
- `src/modules/theme/`: 밝은 화면·어두운 화면 색. `theme/theme.css`가 공통 테마예요.
- `wxt.config.ts`의 `imports.parser: "oxc"`는 빼지 마세요. 빼면 배경 스크립트가 죽어요.

## 저장 키

사용자 데이터는 지우지 마세요. `chrome.storage.*.clear()`도 쓰지 마세요. 안 쓰는 옛 키가 남아 있어도 그대로 두세요. 예: 환율 즐겨찾기 `fx.favorites`는 화면에서 뺐지만, 저장값은 지우지 않아요.

| 구역 | 어디 | 예 |
| --- | --- | --- |
| 디시 | `chrome.storage.local`, 접두사 `refresher:` | 디시 안쪽 탭 위치 `refresher:popup:lastTab` |
| 치지직 | `chzzk.*` (sync/local, `src/modules/chzzk/lib/ns.js`가 접두사를 붙임) | 광고 차단 `chzzk.adBlock` |
| 번역 | `chrome.storage.local` | `trans.settings`, `trans.cacheStats`, `trans.alwaysOrigins` |
| 공통 | `chrome.storage.local` | `core.modules`, `core.popupTab`, `core.popupTabOrder`, `core.update:*` |
| 메일 | `chrome.storage.local` | `gmail.snapshot`, `gmail.unread`, `gmail.seen`, `gmail.baseline`, `gmail.error`, `gmail.notify`, `gmail.intervalMs`, `gmail.disabled`, `gmail.photos`, `gmail.accountColors`, `gmail.accountOrder`, `gmail.sound` |
| 메일 토큰 | `chrome.storage.session` | `gmail.sessionTokens` (브라우저를 닫으면 사라지는 작업 토큰) |
| 환율 | `chrome.storage.local` | `fx.table`, 카드 순서 `fx.cardOrder`, 금액·통화 `fx.form`. 옛 `fx.favorites`는 읽지도 쓰지도 않아요 |
| 우클릭 | `chrome.storage.local` | `rc.origins` |

디시 데이터 작업(가져오기, 초기화, 백업)은 `src/storage/namespace.ts`가 디시 키만 다뤄요. 다른 구역은 건드리지 않아요.

번역 캐시 IndexedDB 이름은 `page-translator`예요. 업데이트 폴더 핸들 IndexedDB 이름은 `bongextend-install`이에요.

## 권한

권한을 늘리지 마세요. manifest `key`도 넣지 마세요. `webNavigation`도 넣지 마세요. `host_permissions`에 `<all_urls>`도 넣지 마세요.

- `permissions`: `activeTab`, `alarms`, `contextMenus`, `declarativeNetRequest`, `downloads`, `notifications`, `offscreen`, `idle`, `storage`, `scripting`, `tabs`, `windows`, `unlimitedStorage`, `clipboardWrite`
- `host_permissions`: `https://*.dcinside.com/*`, `https://chzzk.naver.com/*`, `https://api.chzzk.naver.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.github.com/*`, `https://github.com/*`, `https://objects.githubusercontent.com/*`, `https://release-assets.githubusercontent.com/*`, `https://mail.google.com/*`, `https://latest.currency-api.pages.dev/*`
- 번역이 사이트를 항상 켤 때만 그 주소의 `optional_host_permissions`(`https://*/*`, `http://*/*`)를 물어봐요.
- 단축키는 번역 켜기/끄기(`toggle-translation`) 하나만 두세요.
- Gemini API 키는 서비스 워커와 확장 페이지에만 두세요. 콘텐츠 스크립트로 보내지 마세요.
- `.github/FUNDING.yml`은 고치지 마세요.

다른 사이트 주소의 창(iframe)을 번역하려면 그 사이트 권한이 더 필요해요. 그 권한이 없으면 멈추고, 왜 필요한지 오너에게 말하세요. 몰래 넣지 마세요.

## 시험

시험은 가짜로 해요. 진짜 Gmail, Gemini, 치지직, 디시, GitHub 릴리스를 부르지 않아요.

- `bun install`
- `bun run test`는 디시·타입 시험, 그다음 자바스크립트 시험, 그다음 `tsc --noEmit`예요.
- 자바스크립트 시험은 치지직, 번역, 메일, 환율, 우클릭, 테마, 플랫폼 폴더의 `node --test`예요.
- `bun run build` 결과는 `.output/chrome-mv3/`예요.
- `bun scripts/check-no-eval.ts`는 빌드 결과의 js/html에 `eval`이나 `Function` 생성자가 있으면 실패해요. 서비스 워커에서 `Function()`을 쓰면 크롬 MV3가 등록을 막아요.

## 릴리스

버전 숫자는 `package.json` 하나예요. 사용자에게 보이는 변경은 `CHANGELOG.md`의 `## [X.Y.Z]`에 쉬운 한국어로 적어요.

순서는 이래요.

1. `package.json` 버전을 올려요.
2. `CHANGELOG.md`에 그 버전 섹션을 넣어요.
3. 작업 브랜치에서 PR을 열어요. `gh pr create`는 이 환경에서 막힐 수 있어요. 저장소가 쓰는 PR 도구로 열어요.
4. CI가 초록이 되면 스쿼시로 합쳐요. 합친 브랜치는 지워요.
5. `main`이 그 커밋인지 확인한 뒤 태그 `vX.Y.Z`를 푸시해요.
6. `.github/workflows/release.yml`이 시험, 태그=버전 확인, 크롬 zip, zip 검사, eval 검사, 릴리스를 만들어요. 파이어폭스 zip은 올리지 않아요.
7. 받은 zip을 풀어 `bun scripts/check-no-eval.ts`로 한 번 더 봐요.

main 푸시와 PR의 CI(`.github/workflows/ci.yml`)는 시험과 빌드와 eval 검사만 해요. 릴리스는 만들지 않아요. 문서만 바꾼 PR은 태그와 릴리스가 필요 없어요.

푸시, 태그, 릴리스는 오너가 확인한 뒤에만 해요. 이미 나간 태그를 다시 다는 일도 오너가 그 버전 배치에 넣으라고 한 뒤에만 해요.

## 화면 규칙

아이폰처럼 둥근 모서리, 넓은 여백, 알약 스위치예요. 기기 설정이 밝은 화면이면 밝게, 어두운 화면이면 어둡게 나와요. 글자와 바탕은 읽기 쉽게 차이를 유지해요. 움직임 줄이기를 켜면 짧은 움직임을 빼요.

- 팝업 탭은 가운데에 모여요. 끌어서 순서를 바꿀 수 있어요.
- 오른쪽 끝의 마우스 그림은 지금 사이트의 오른쪽 클릭·복사·글자 선택을 되살려요.
- 오른쪽 아래 톱니는 업데이트·설정이에요. 새 버전이 있으면 톱니에 점이 찍혀요.
- 메일 탭 배지는 읽지 않은 수예요. 0이면 숨고, 100통부터는 `99+`예요.
- 환율 탭 배지는 1달러가 몇 원인지예요. 시세가 없으면 숨겨요.
- 메일 탭의 모듈 스위치, 확인 간격, 새 메일 알림, 긴 설명은 팝업이 아니라 설정 화면의 메일에 있어요. 팝업 메일에는 다시 확인 아이콘만 있어요.
- 환율 화면은 팝업 높이 안에 들어가요. 칸을 더 내리지 않아도 8개 나라 칸과 시세 글이 보여요. 이 문장은 1.2.3·1.2.4 변경 기록에는 빠졌지만, 화면은 1.2.3부터 들어 있어요.

## 최근 역사 (1.2.0 ~ 1.2.7)

자세한 문장은 `CHANGELOG.md`에 있어요.

- **1.2.0**: 팝업과 설정이 아이폰 스타일이 되고, 설정 화면에 왼쪽 탭이 생겼어요.
- **1.2.1**: 설정 화면 마지막 탭 이름이 설정으로 바뀌었어요.
- **1.2.2**: 메일을 계정마다 묶고, 모두 읽음, 알림 소리, 프로필 사진, 계정 색을 넣었어요.
- **1.2.3**: 업데이트 확인을 5분마다 해요. 같은 Gmail 주소는 한 번만 나와요. 메일 배지, 계정 순서 끌기, 파스텔 번역, 환율 즐겨찾기 제거(저장값은 유지), 나라 색, 1달러 배지, 스크롤 없는 환율 화면이 들어갔어요.
- **1.2.4**: 타오바오처럼 주소 `#` 뒤가 바뀌고 글이 나중에 생기는 화면도 번역해요. 메일 탭은 받은 메일이 먼저 보이고, 제목이 가장 크며, 이름·주소·받은 시각이 나와요. 치지직 광고 칸과 짧은 광고 영상은 가리고 소리를 끄며, 건너뛰기가 켜지면 눌러요.
- **1.2.5**: 치지직 라이브에서 소리는 나는데 화면만 검던 문제를 고치려 했어요. 본영상을 숨기지 않게 바꿨지만, 광고를 빈 응답으로 막는 방식은 그대로였어요.
- **1.2.6**: 치지직이 광고를 못 받으면 까만 막을 유지해요. 광고 스크립트와 빈 일정으로 막지 않고, 재생 전 광고 표시만 끄며, 남아 있는 까만 막은 본영상이 나온 뒤에 접어요.
- **1.2.7**: 환율 칸 순서를 끌 수 있어요. 메일이 없어도 계정이 보여요. 톱니와 단축키 버튼을 다듬고, 새 메일 소리에 Checker Plus 소리를 넣었어요. 즐겨찾기 저장값은 그대로예요.
- **1.2.8**: 툴바 배지는 읽지 않은 메일만 보여요. 탭·메일·환율 끌기를 다듬고, 환율 금액과 통화 그림을 기억해요. 시세는 지금 출처를 더 자주 받아요.

## 알려진 문제와 남은 일

코드는 들어갔지만, 로그인된 실제 크롬에서 끝까지 본 기록은 아직 없어요.

- 치지직 라이브에서 화면이 보이는지, 그리고 광고가 길게 남지 않는지. 1.2.6부터는 광고 요청을 빈 응답으로 막지 않아요. 광고 영상 주소가 다른 사이트면, 지금 권한으로는 그 요청을 막지 못하고 화면에서 건너뛰어요.
- 번역을 켠 페이지의 창이 다른 사이트 주소면, 그 창은 번역되지 않아요. 권한을 더 넣기 전에 오너에게 이유를 말하세요.
- Gemini 키로 실제 페이지가 번역되는지. 타오바오 채팅은 가짜 화면으로만 봤어요.
- Gmail 실계정에서 사진, 순서 끌기, 모두 읽음, 소리가 도는지.
- 디시 글 미리보기와 댓글, 로그인한 디시 기능.
- 항상 번역 스위치를 켤 때 그 사이트만 권한을 묻는지.
- 예전 번역 설정 파일과 예전 디시 설정을 실제로 가져오기. 자동 시험만 있어요.
- 번역을 치지직·디시 페이지에서 켰을 때 서로 안 부딪히는지.

그 밖에 지우면 안 되는 것:

- `fx.favorites` 저장값.
- `.github/FUNDING.yml`.
- 디시 모듈의 green1052 라이선스 표시.

파이어폭스 zip은 로컬 스크립트만 있고, 릴리스에는 올리지 않아요.
