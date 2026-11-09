# BongExtend 인수인계

기준일: 2026-11-10. 이 문서는 기존 v1.2.10 인수인계를 대체해요. 이후 변경은 package.json, CHANGELOG.md, GitHub Releases를 우선 확인하세요.

## 최신 인계 — v1.2.54

- 최신 구현은 package.json/CHANGELOG의 **1.2.54**예요. 아래 v1.2.40 상태·파일 지도는 과거 기준이며 최신 상태를 덮어쓰지 않아요. 배포 결과·커밋은 최신 GitHub Release/main을 확인하세요.
- 앱 커밋 **bf6d335** main, [v1.2.54 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.54). CI **42642155913**·Release **42642160225** 모두 성공했고 Chrome ZIP(4,812,254바이트)·Windows 영상 보조 ZIP(22,615바이트) 게시를 확인했어요. 이후 문서 커밋은 앱 버전을 바꾸지 않아요. 이 요청의 코드·검사·배포는 완료했고 담당 다크팀은 idle이에요. 실제 사용자 Chrome 설치·실계정 쪽지 검증은 하지 않았어요.
- 1.2.41~53: 통나무 자동 받기, 네이버 통합 메일/N 로고, 브라우저에 붙은 크기 조절, 업데이트 확인 후 자동 진행, 통화 선택, 번역 누락·진행 표시, 메일 상단 축소/본문80%/계정 순서 등 변경은 CHANGELOG와 모듈 REPORT를 확인해요. 이미 passing한 검사를 인계만을 위해 반복하지 않아요.
- 1.2.54: **공통** 대비 엔진(중립 글자/SVG/카드/범례·칸), 작은 투명 조작 bitmap의 중립 픽셀 보정, 사진·캐릭터 원색 보존, 원래 투명한 root/body가 음수 iframe을 가리는 조건 보호, document.open 문서 교체 뒤 테마·MAIN proxy/CSSOM 재연결을 구현했어요.
- 주요 파일: dark.content.ts/dark-proxy.content.ts, dark/contrast.js, icon-contrast.js, paint-guard.js, site-fixes.js, proxy.js, DarkReader dependency patch. 패치는 URL 이미지 원색을 보존하면서 CSS gradient는 계속 테마 처리해요. proxy.js는 upstream에 cleanup 반환 adapter 하나만 추가하고 sync script가 검증해요.
- 실제 공개 Chrome API/helper: 네이버 카드·AI 글자(컬러915픽셀/alpha 보존), codex-resets 범례·가시 칸 색 일치, 로스트아크 요청 페이지 큰 그림31개의 원본URL/필터 및 얼굴 정상색 확인. 제품 패키지 합성 Chrome: iframe URL/srcdoc/blank·문서교체 CSSOM·음수 iframe 본문 픽셀·hidden/OFF 복원, strict CSP/시스템테마 통과. 전체 JS252개·Bun·타입·ZIP/eval/권한 검사 통과. 자세한 근거/캡처 경로는 docs/team/dark/REPORT.md에 있어요.
- **실제 로그인 네이버 쪽지 목록은 여전히 미확인**이에요. 사용자가 다크 OFF 하면 즉시 목록이 돌아온다고 확인했고, 유사한 CSS paint 원인과 별개 문서교체 결함을 합성으로 재현·수정했어요. 합성 passing을 실제 해결 증거로 말하지 않아요. 설치 버전·기존 페이지 새로고침도 배포와 별개예요.
- 지속 정책: 사용자 UI 지적은 공통규칙 요청. 사이트 특례만으로 완료 금지, 외부 AI에 페이지/계정 전송 금지. 사진·캐릭터·배너를 통째로 반전/숨기지 않아요. 완료 항목은 **한 줄 전체 굵은 목록**. 팀은 필요한 담당만 medium 이하 기본, Astra는 극난도/서로 다른 접근 수차례 실패 때만. 현재 담당팀 채팅은 조정 문서를 재사용해요.

## 과거 기준 상태 (v1.2.40)

- 저장소: https://github.com/Baegovda/BongExtend
- 최신 앱: **v1.2.40**, 앱 커밋 **4172675**, main. 이후 문서 커밋은 앱 버전을 바꾸지 않아요.
- 배포: https://github.com/Baegovda/BongExtend/releases/tag/v1.2.40
- Chrome ZIP과 Windows 영상 보조 프로그램 ZIP이 모두 게시됐고 CI/Release가 성공했어요. Source code ZIP은 설치 파일이 아니에요.
- 마지막 요청인 메일 상세 UI와 창 크기 조절은 구현·시험·배포까지 끝났어요. **현재 미완료 코드 작업이나 실행 중인 에이전트는 없어요.**
- **배포 완료와 사용자 Chrome 적용은 달라요.** 마지막 배포 후 실제 설치 버전과 열린 페이지 새로고침은 직접 확인하지 않았어요.

## 작업 원칙과 승인 맥락

AGENTS.md → MERGE_NOTES.md → 이 문서를 읽으세요. 오래된 v1.2.10 설명이나 매번 릴리스 승인을 받으라는 옛 문구를 다시 정책으로 적용하지 마세요.

- 사용자는 쉬운 한국어 **해요체**를 원해요. 개발자가 아니므로 결과와 사용법을 먼저 말해요.
- 사용자는 이미 “릴리즈까지 알아서”, “선조치 후보고”를 지시했어요. 승인된 범위에서 조사·수정·필요한 검사·푸시·릴리스를 끝내고 보고해요. 같은 승인을 반복해서 묻지 않아요.
- 실패하면 원인을 좁히고 다른 허용된 방법으로 진행해요. 의미 없는 재검사·반복 설명·끝없는 새 기능 추가는 하지 않아요. 상위 지침과 실제 도구 권한은 그대로 적용돼요.
- UI는 직접 검수하되 **로그인된 실제 사이트, 별도 Chrome의 가짜 화면, 단위 시험**을 구분해서 보고하세요.
- Windows 창 검사에는 .cursor/rules/windows-inspection.mdc를 적용해요. 프로세스 조회 → GetWindowRect → 이미 보이는 사각형 CopyFromScreen 캡처예요. 검사만 하려고 클릭·키 입력·창 활성화·이동·복원을 하지 않아요. 안전 차단을 다른 방법으로 우회하지 않아요.
- 브라우저 시험은 폐기 가능한 별도 Chrome 프로필에서 해요. 사용자 실제 프로필에 Playwright/CDP를 붙이지 않아요. 개인 메일 전송·읽음·삭제나 유료 Gemini 요청을 자동 시험으로 실행하지 않아요.
- 완료된 검사와 지식을 재사용해요. 문서 인수만을 위해 앱 시험을 전부 다시 돌리지 않아요.

## 제품 정체성과 지도

BongExtend는 메일·다운로더·번역·치지직·디시·환율·다크 모드를 합친 Chrome MV3 확장이에요. **앱 전체를 Checker Plus/Chrono로 바꾸면 안 돼요.** 공통 테마는 src/modules/theme/theme.css와 tokens.js예요. 둥근 카드·여백·파란 강조색·밝은/어두운 테마를 유지해요.

- src/entrypoints/background.ts: 하나의 서비스 워커. 모듈·배지·OTP·업데이트를 연결해요.
- src/entrypoints/popup/: 전체 탭 셸, 공통 설정·업데이트·인앱 메일 설정.
- 메일: public/checkerplus-popup.html, public/js/popup.js, background.js와 계정 헬퍼 등 **Checker Plus 36.6 원본 코드**가 연결돼요. src/modules/gmail/에는 어댑터·설정·레거시 코드도 있어요. 이 폴더만 보고 전체 엔진을 판단하지 마세요.
- 다운로더: **Chrono 0.13.12 원본 관리자·설정·워커**와 어댑터가 남아 있어요. 최근 목록은 public/recent-downloads.{html,css,js}의 자체 UI예요. 표시 이름은 **다운로더**예요. chrono-worker.js와 chrono-action-bridge.js 등 내부 이름은 무턱대고 바꾸지 않아요.
- 번역: src/modules/trans/. background.js는 공통 워커에 연결하고 content/content.js는 비모듈 IIFE로 주입해요.
- 치지직: src/modules/chzzk/, 등록은 src/modules/chzzk-register.ts. 콘텐츠 스크립트 순서를 유지해요.
- 다크 모드: src/entrypoints/dark.content.ts, dark-proxy.content.ts, src/modules/dark/, patches/darkreader@4.9.134.patch.
- 디시: src/entrypoints/dc/, options/, content/ 등 기존 Vue 코드. green1052/DCRefresher-Reborn 출처를 유지해요.
- 환율은 src/modules/fx/, 우클릭 복구는 src/modules/rightclick/.
- PC 영상: native/video/host.py, Launcher.cs, 설치 스크립트. scripts/package-video-helper.ps1로 패키징해요.

사용자는 원작자 허락을 받았다고 지시했어요. 타사 코드의 실제 통합 범위와 자체 어댑터를 구분하고, CHECKERPLUS-ATTRIBUTION.txt, CHRONO-ATTRIBUTION.txt, licenses/ 등 저작권·라이선스 표시는 유지해요.

## 최근 완료한 변경

### v1.2.40 — 메일 상세 UI와 크기 조절

- public/checkerplus-embed.css: 도구 모음·제목·발신자 카드·답장 영역을 공통 테마로 리메이크했어요. 발신자가 지정한 **본문 색과 이미지**는 유지해요. 과거 검은 글자/검은 바탕 문제를 다시 만들지 마세요.
- public/js/bongextend-mail-ui.js: 기존 버튼·이벤트를 유지하며 한국어 표시와 추가 메뉴를 적용해요. 제목을 스크롤 영역 밖으로 옮겨 항상 보이게 해요.
- src/entrypoints/popup/window-controls.ts: 상단 ↗ 버튼으로 popup.html?window=1 별도 창을 열어요. 기존 780×590 도구 모음 팝업은 Chrome의 최대 800×600 제한을 받아 큰 크기는 별도 창에서 처리해요.
- 별도 창은 가로·세로를 채우고 작은 폭에서는 탭 줄을 바꿔요. OS 테두리와 오른쪽 아래 손잡이의 드래그/방향키로 크기를 조절해요. local의 core.popupWindowSize에 마지막 크기를 저장해요.
- 현재 선택 메일 ID가 있으면 새 창의 previewMailId로 전달하는 코드가 있어요. **실계정의 이미 읽은 메일·작성 중 답장까지 완전하게 이어지는지는 미검증**이에요.

### v1.2.39 — 치지직 넓은 화면과 F11

- 사용자 요청으로 **Ctrl+Shift+L 자동 입력을 제거**했어요. 다시 넣지 마세요. BrowserShortcut.cs, vertical-tabs.js, 네이티브 collapse-tabs 처리와 연결 UI를 제거했어요.
- src/modules/chzzk/wide-fullscreen.js가 chrome.windows로 브라우저 전체화면을 켜요. 키 입력/영상 보조 프로그램을 사용하지 않아요.
- content-wide.js는 실제 넓은 화면 상태 변경을 보고해요. 설정은 sync의 chzzk.wideFullscreen, 기본값 켜짐이에요.
- 이전 일반 창 위치·크기 또는 최대화 상태를 session의 core.chzzkWideFullscreen에 보관해요. 넓은 화면 해제, 탭 이동·닫기·분리, 페이지 이동, 기능/모듈 끄기에 복구해요.
- 이미 사용자가 켜 둔 전체화면은 소유하지 않아요. 수동 F11 해제를 즉시 덮어쓰지 않아요. 다른 탭에서 돌아오면 실제 넓은 화면 상태를 다시 읽어요.
- 화면 밖 좌표를 Chrome이 거부하면 위치 지정 없이 일반 창으로 복구해요. 비동기 전환은 직렬화해요.

### v1.2.38 — 다크 모드 CSP 오류 반복

- 사용자 오류 화면을 읽기 전용으로 캡처했어요. 다수는 content-scripts/dark.js:15의 인라인 스크립트가 CSP에 막혀 반복된 기록이었어요. **확장 ID 충돌로 진단한 것이 아니에요.**
- Dark Reader 4.9.134의 자체 완결 injectProxy 원본을 별도 MAIN 콘텐츠 스크립트로 패키징하고 ISOLATED 테마와 이벤트로 연결했어요. 사이트 CSP 완화/unsafe-inline 추가는 하지 않아요.
- scripts/sync-darkreader-proxy.cjs로 원본과의 일치를 확인해요. 패치·원본 복사본·등록/즉시 주입 경로를 함께 관리해야 해요. Windows CRLF도 비교 시 정규화해요.
- 모든 사이트에서 인라인 프록시 주입은 끄되 CSSOM 감지를 유지해요. 기존 사이트별 프록시 예외는 남아 있어요.
- 업데이트로 옛 오류 기록이 자동 삭제되지 않으며, 열린 탭의 옛 스크립트는 페이지 새로고침이 필요해요.

### v1.2.37과 직전의 중요한 상태

- 최근 다운로더는 표가 아닌 **파일 아이콘·이름·출처·크기·시간의 세로 목록**이에요. 사용자가 마지막에 다시 목록을 요청했으므로 옛 표 UI로 되돌리지 않아요. 아이콘은 chrome.downloads.getFileIcon을 사용해요.
- 영상 우클릭 **동영상 저장하기**와 현재 페이지 영상 받기가 연결돼요. 직접 주소는 Chrome 다운로드, 스트리밍/blob은 페이지 주소로 로컬 영상 받기를 사용해요. src/modules/downloads/video-menu.js, video.js, video-history.js를 보세요.
- Downloaderto 서버의 API 키/403 문제로 사용자가 선택한 방식은 **PC의 yt-dlp + FFmpeg, API 키 불필요**예요. 외부 변환 서버로 되돌리거나 DRM/로그인 보호 영상 지원을 약속하지 않아요.
- OTP는 추출 → 복사 성공 → 웹페이지 중앙 하단의 닫힌 shadow DOM/popover 카드로 약 7초 표시해요. src/modules/gmail/otp.js, otp-toast.js. 프리즘·페이드 효과예요. 별도 인증번호 창으로 되돌리지 않아요. 사이트 표시 권한이 없으면 시스템 알림으로 대체해요.
- 프로필 사진 비동기 덮어쓰기/숨김을 수정했어요. public/js/bongextend-profile.js와 계정 표시 경로를 함께 보세요. 인앱 설정에 원본 알림음 19개와 미리 듣기가 있어요.
- 메일 감지는 **이미 로그인된 Gmail 세션**을 사용해요. 정상 응답 시 1초 간격이며 중복 요청·오류·Retry-After 대기가 있어요. 타인 메일에 무인증 접근하는 기능이 아니에요.
- 치지직 시청자 수는 정상 응답 시 약 1초, 증가/감소 색은 은은하게 약 5초 유지해요. 실제 영상 해상도와 방송 경과 시간도 표시해요.
- 툴바 배지는 미읽음 메일 합계(src/modules/toolbar-badge.js). 다운로더 배지는 새 완료 건을 확인하면 지우는 방식이에요. 모든 과거 다운로드 수를 99+로 표시하던 동작으로 되돌리지 않아요.
- 번역 요구는 **프리즘 세로 막대 위치를 기준으로 원문/번역문을 명확히 나누고, 지나간 글에 파스텔 잔광이 남다 원래 색으로 복귀**하는 거예요. 타오바오 글 겹침·위치 불일치·버벅임도 반복 지적됐어요. 단순 전체 페이드/일괄 치환으로 바꾸지 마세요.

## 확인한 증거

인계만을 위해 아래 검사를 다시 전부 실행하지 마세요. 관련 변경·실패·새 증상·오래된 증거가 있을 때 필요한 검사를 골라요.

- v1.2.40: bun run test의 기존 Bun 시험, JS **213개**, 타입 검사 통과.
- bun run zip, bun run verify, check-no-eval.ts, check-manifest-permissions.ts 통과.
- 네이티브 Python 시험 6개는 v1.2.39에서 통과했어요. 이후 해당 코드는 그대로이며 v1.2.40 배포 CI도 성공했어요.
- scripts/verify-mail-reader-browser.cjs: 별도 실제 Chrome + 시험 메일. 밝은/어두운 테마, 본문 색·그림, 제목·뒤로 가기, 번역 메뉴, 별도 창 크기 채우기, 실제 창 API 변경, 손잡이 드래그·방향키, 크기 저장 확인.
- scripts/verify-chzzk-wide-browser.cjs: 별도 Chrome + 가짜 치지직 DOM. 실제 브라우저 전체화면 API, 일반 창/최대화 복구, 기존 전체화면, 수동 해제, 탭 이동·복귀·페이지 이동, 설정 확인. 실제 로그인 방송 검증은 아니에요.
- scripts/verify-dark-csp.cjs: 로컬 엄격한 CSP에서 인라인 script 위반 없음, 다크 스타일, CSSOM 변경, 기존 탭·새 문서·하위 프레임·시스템 테마 확인.
- scripts/verify-downloader-list.cjs: 별도 Chrome의 실제 다운로드 API + 시험 파일로 OS 아이콘·목록·검색 확인.
- 다른 번역·업데이트·모듈·영상 기록 시험은 scripts/verify-*.cjs에 있어요. 이번에 모두 다시 실행했다고 주장하지 마세요.
- UI 증거: docs/handoff/mail-reader-dark-v1.2.40.png, resizable-window-v1.2.40.png. **합성 메일**이에요. 작은 창 캡처는 일부러 줄인 상태라 본문 공간이 좁아요.

## 미검증 사항과 다음 조사 후보

아래를 모두 고장으로 단정하거나 한꺼번에 다시 만들지 마세요. 사용자의 다음 증상과 관련된 항목부터 증거로 좁히세요.

1. 별도로 보인 **TypeError: Failed to fetch**는 어떤 요청인지 스택을 확보하지 못했어요. CSP 수정으로 이것까지 해결됐다고 하지 않았어요. 재발하면 발생 URL·시간·스택을 먼저 구분하세요.
2. v1.2.38~40의 실제 사용자 Chrome 설치/적용/페이지 새로고침은 미확인이에요. GitHub 게시만으로 적용 완료라고 하지 마세요.
3. 실제 Gmail 사진·알림음·미읽음 합계·새 메일·OTP 복사/카드·답장 전송은 마지막 변경 후 종합 검증하지 않았어요. 선택 메일과 작성 중 초안의 새 창 인계도 미검증이에요.
4. 실제 치지직 광고 전체 주기/차단 감지, 시청자 변화, DOM 변경 시 F11 연동은 합성 시험과 다를 수 있어요. 광고가 절대 안 나온다고 보장하지 마세요.
5. 타오바오 실제 로그인 메인/채팅의 최신 프리즘 효과·레이아웃·성능은 다음 재현을 기준으로 조사해요.
6. 사용자 영상 보조 프로그램의 **실제 확장 ID 등록/연결 완료**는 미확인이에요. 설치 파일 준비만으로 연결 완료가 아니에요. 설치 위치는 %LOCALAPPDATA%/BongExtend/video-helper. 네이티브 호스트 허용 ID와 연결 상태부터 구분하세요. 치지직 F11에는 이 프로그램이 필요 없어요.
7. 네이버/쿠팡의 동적 모달·iframe 다크 모드, 디시 로그인 기능, 실제 설정 가져오기도 최신 사용자 환경에서 완전 검수한 것으로 간주하지 마세요.

## 데이터·권한·보안

- wxt.config.ts의 **imports.parser: "oxc"**를 유지해요. 제거하면 순환 import로 워커가 죽을 수 있어요.
- refresher:*는 디시, chzzk.*는 치지직, trans.*는 번역, core.*는 공통이에요. 디시 초기화가 다른 모듈을 건드리면 안 돼요. chrome.storage.*.clear()를 쓰지 않고 옛 fx.favorites도 유지해요.
- IDB 이름은 번역 캐시 page-translator, 업데이트 폴더 핸들 bongextend-install이에요. 사용자 캐시·프로필·설정을 임의로 지우지 않아요.
- core.popupWindowSize는 local, core.chzzkWideFullscreen은 session. 영상 기록은 core.video:history, 상태는 core.video:status예요.
- manifest key, webNavigation, 필수 <all_urls>를 추가하지 않아요. 권한은 AGENTS.md와 check-manifest-permissions.ts를 보세요. 기존 선택 권한에 메일/영상 호환 권한도 남아 있어요. 다크/항상 번역의 사이트 권한 흐름을 유지해요.
- commands는 toggle-translation 하나예요. Ctrl+Shift+L은 제거됐으며 F11 동작도 명령 등록/합성 키가 아니라 창 API예요.
- Gemini 키를 콘텐츠 스크립트·페이지·인수인계에 넣지 않아요. GET_PREFS 허용 필드를 유지해요.
- OTP 원문·실메일·토큰·사용자 실제 브라우저 캡처를 공용 저장소에 올리지 않아요.
- .github/FUNDING.yml, 디시·타사 라이선스 표시는 유지해요.

## 빌드·배포와 다음 채팅

- 검증된 도구: Bun **1.3.14**, 로컬 Node 26, CI Node 22, WXT 0.20.27, TypeScript 7 계열.
- CI/Release의 Bun은 1.3.14 고정이에요. 이전 latest 1.4.4 다운로드 504 때문에 고정했으므로 무심코 latest로 바꾸지 마세요.
- 소스 변경 시 관련 시험과 bun run test. 배포는 zip → verify → no-eval/권한 검사예요. 성공한 검사를 관련 변경 없이 반복하지 않아요.
- 버전은 package.json, 쉬운 변경 기록은 CHANGELOG.md. vX.Y.Z 태그가 Release를 시작해요. **두 배포 파일과 CI/Release 성공**을 확인한 뒤 완료라고 보고해요.
- 이미 공개한 태그를 몰래 다시 달거나 강제 푸시하지 않아요. 이번 인계는 문서만 바꾸므로 새 앱 버전/태그/릴리스가 필요 없어요.
- 실제 Git 루트가 환경 폴더 아래 work/BongExtend일 수 있어요. 먼저 기존 체크아웃 위치와 git status를 확인하고 불필요한 재클론·초기화를 하지 않아요.
- 같은 프로젝트의 새 채팅에 NEXT_CHAT_PROMPT.txt를 붙여 넣으세요. 다음 구체적인 요청이 오면 관련 파일·증상부터 이어서 작업해요.
