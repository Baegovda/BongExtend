## root OTP 통합 검수 — 1.2.67

- background 복사성공 후 tracker/isolated watcher 연결 완료. trusted paste와 실제 input 확인, 원본계정/메일만기존 읽음API, 기존권한만재사용, source메타만session 저장해워커재시작복구. 아래 tracker 메모리 한계는 source단독 설명이며 root session bridge가 기존주입문서 경로를 보완해요. 전체 JS275+Bun+타입, session/사칭/동시/TTL source와 실제패키지clipboard→Ctrl+V→합성원본만읽음(pKd8h6),차단/오번호/가짜/중복/OFF 및ZIP/eval PASS. 실제계정미검증, 권한없는페이지/다른앱은지원하지않아요.

# OTP 붙여넣기 원본 읽음 처리 — 담당 구현/집중 검사 완료

- 기준 main `28e68dd` / 앱1.2.66. 변경은 src/modules/gmail/otp.js, 신규 otp-paste.js 및 test/otp-paste.test.js예요. 공통 background/content watcher·제품 통합·빌드/배포는 총괄 담당이에요.
- API: `createOtpPasteTracker({now = Date.now} = {})`. `arm(mail, code)`는 crypto.randomUUID 토큰(유효하지 않은 mail/code는 null), `current()`는 `{token,code}` 또는 null, `consume(token)`은 성공 true/만료·구토큰·중복·동시호출 false예요. markAsRead 실패는 reject하며 같은 유효 토큰으로 재시도 가능해요. `invalidate()`/`clear()`는 현재 항목을 폐기해요.
- 최신 복사 1건·10분 TTL·메모리 전용이에요. 같은 번호라도 새 복사의 토큰은 달라요. 소비 중 새 복사를 arm하거나 clear하면 이전 요청의 완료가 새 토큰을 지우지 않아요. 이미 시작된 읽음 API 자체는 취소할 수 없어요. 워커 재시작 시 정보가 사라져요.
- otp.js는 `copy(code, mail)`로 원본 객체를 전달해요. 기존 1인자 copy와 호환해요. root는 실제 복사 성공 후에만 arm하고 trusted paste/정확한 코드 일치를 검증한 뒤 consume해야 해요. tracker 자체는 붙여넣기 출처를 검증하지 않아요. baseline에는 copy 호출이 없고 복사 실패 후 arm하지 않는 연동 예제를 집중 검사했어요.
- UI/배지 조사: public/js/mail.js:105의 markAsRead→account.executeMailAction(MARK_AS_READ). public/js/account.js:2560 이후 autoDetect는 HTTP action→getEmails→mailUpdate를 await해요. public/js/background.js:3241~3266의 mailUpdate는 updateBadge·unreadCount 저장·initPopup·serializeAccounts·mailUpdate 메시지까지 수행해요. OAuth는 account.js:2690 이후 removeMail/계정 unreadCount 감소·updateBadge·serializeAccounts를 수행하지만 별도 mailUpdate 메시지는 그 경로에 없어요. updateBadge는 await되지 않으므로 markAsRead resolve 시점에 배지 반영 완료까지 보장되지는 않아요. root가 사용하는 autoDetect 기본 경로는 기존 동기화 흐름을 재사용할 수 있어요.
- 기존 account.executeMailAction에는 params/mail을 console.log하는 진단 로그가 있어요(account.js:2561). tracker는 코드/메일/토큰을 로그하거나 저장하지 않아요. 실제 계정 검증은 하지 않았어요.
- 실행 검증: `node --test src/modules/gmail/test/otp.test.js src/modules/gmail/test/otp-paste.test.js` 11개 통과, 담당 파일 diff --check 통과. 최신 원본만 처리·중복/동시 소비·실패 재시도·TTL·새 복사와 진행 중 요청 경쟁·baseline/복사 실패를 합성 객체로 확인했어요. 제품 UI/실계정·실제 붙여넣기 통합은 미검증이며 총괄 검수 대상으로 남아요. 빌드/커밋/배포·실계정 접근·팀 호출은 하지 않았어요.
# 메일 뒤로가기·스크롤바 수정 — source·root 패키지 검사 완료

- root 최종 검수: 최신 source 재빌드, fixture에 원래 initOpenEmailEventListeners()를 추가한 뒤 Gmail button3/history/기존 초안·휠·resize/문맥 메뉴 통과(be-reader-THmrS4). Naver source/API fixture의 body button3/history·다크/원본·zoom·취소/오류는 be-naver-mail-ReQUwD, 긴본문의 dark scrollbar-color·얇은 경계는 tZC7cS에서 통과하고 직접 시각 확인했어요. 실제 계정/설치 확인과 별개예요. 담당 idle.

- **Gmail package timeout 코드 검토 (소스 고정)**: fixture mountReader는 initTemplate만 호출하고 원본 openEmailPromise 경로를 생략해요. 원본 #back click→openInbox 바인딩은 popup.js:1436 initOpenEmailEventListeners 안에 있고, 실제 호출은 popup.js:3298뿐이에요. fixture에 이 초기화 호출이 없으므로 helper가 #back.click()을 실행해도 inactive로 바뀌지 않는 것이 이번 line194 timeout의 우선 원인이에요.
- root 권장: fixture의 합성 reader mount 뒤 원본 initOpenEmailEventListeners()를 초기화해 native click handler를 갖춘 상태로 검사해 주세요. 제품 back 함수를 시험용 가짜로 대체하지 않아도 돼요. 이번 요청대로 제품/fixture 코드는 추가 수정하지 않았어요.
- .output reader-zoom.js가 실제 소스보다 오래된 것도 확인했어요(active/host observer 없음). 다만 이 Gmail fixture에는 Naver reader를 open하는 단계가 없어 hidden Naver 선점보다는 위 원본 handler 미초기화 근거가 더 직접적이에요. 소스 재빌드만으로 fixture의 누락된 초기화까지 해결되지는 않아요.

- **최종 인계 요약 (메일팀 2용)**: 구현 종료. 아래 제품 파일과 3개 fixture가 미커밋 상태이며 root 제품 빌드/검사/배포만 남아요. source helper 검사는 실제 button3·history.back·page.goBack·수동 닫기/재열기 3회·다른 모듈로 숨김/복귀까지 최종 통과했어요.
- **마지막 보정**: 숨겨진 mail iframe의 reader는 다른 모듈의 back을 가로채지 않아요. shell의 class/hidden/style 변화 시 보이는 열린 reader에만 같은 URL guard를 재무장해요. DOM을 지우거나 모듈을 강제로 전환하지 않아요.
- **최종 증거**: node scripts/verify-reader-navigation.cjs 통과, node scripts/verify-mail-theme-browser.cjs 통과(be-mail-theme-UzVikr). root는 빌드 후 verify-naver-mail-browser.cjs / verify-mail-reader-browser.cjs를 실행하고 iframe 실제 scrollbar·경계를 시각 검수해 주세요. 실제 계정·최종 확장 패키지는 담당이 확인하지 않았어요.

- 기준 main `f8180c3`, 앱 1.2.64. 현재 다른 팀 pseudo/contrast/dark.content 변경은 건드리지 않았어요.
- 제품 변경: public/js/bongextend-reader-zoom.js, public/js/bongextend-mail-ui.js, public/naver-reader.css, src/entrypoints/popup/naver-reader.ts, mail-appearance.ts, src/modules/dark/mail-theme.js.
- 공통 ReaderZoom.navigation API를 추가했어요. Gmail 기존 back 버튼, Naver 기존 close 함수를 호출하며 임의 사이트 이동/메일 전송/초안 초기화를 하지 않아요.
- 보조 마우스 button3의 mousedown/up/auxclick을 capture 단계에서 취소하고 중복 이벤트는 1회로 묶어요.
- popup 최상위에 같은 URL의 history guard 1개를 유지해 브라우저 history back도 열린 reader를 닫게 해요. 수동 닫기 시 history.back을 호출하지 않아 비동기 이탈을 피하고 재열기 시 guard를 재사용해요.
- Naver scriptless 본문 문서 및 Gmail 접근 가능한 본문 iframe에 직접 리스너를 연결하고 교체/close/dispose 시 해제해요. 외부 원점의 접근 불가능한 iframe은 직접 제어하지 않아요.
- Gmail은 기존 back handler를 사용해 답장 textarea를 새로 만들거나 지우지 않아요. Naver는 기존 요청 취소·초점 복구·닫기 흐름을 보존해요.
- 다크 mail-theme controller가 root에 color-scheme:dark와 scrollbar-color를 소유권 기록과 함께 적용해요. 원본/모듈OFF/stop 시 이전 값·우선순위로 복원해요.
- Naver outer iframe은 실제 본문 모드에 맞춰 data-be-mail-theme=dark/original을 갱신해 얇은 경계·canvas color-scheme을 맞춰요.
- 줌·본문 색 변환·원본 복원·계정 정렬의 기존 처리는 유지해요.
- source 검증: node scripts/verify-reader-navigation.cjs 통과. 실제 Chrome CDP button back을 부모와 sandbox 본문에서 실행, history.back·재열기·동일 URL/문서 marker/작성 중 textarea 보존 확인했어요.
- source 검증: node scripts/verify-mail-theme-browser.cjs 통과. 기존 upstream mapping/원본 복원/6000요소 fallback과 새 color-scheme·scrollbar-color 적용 및 스타일 원복을 확인했어요.
- theme source 캡처: C:/Users/Revaptor_FX/AppData/Local/Temp/be-mail-theme-UzVikr.
- TypeScript noEmit, 두 JS syntax, 집중 git diff --check 통과했어요.
- root 패키지용 fixture scripts/verify-naver-mail-browser.cjs에 iframe dark/original scheme·모드 및 실제 body button3/historyback→reader 닫힘·popup URL 유지 검사를 추가했어요.
- scripts/verify-mail-reader-browser.cjs에도 Gmail button3/historyback→메일함·기존 reply-textarea 문구 보존 검사를 추가했어요. 두 제품 fixture 변경은 syntax만 확인했고 root 빌드 후 실행이 필요해요.
- root 다음 검증: 빌드한 뒤 node scripts/verify-naver-mail-browser.cjs, node scripts/verify-mail-reader-browser.cjs. 실제 네이버 dark 스크롤바/경계 캡처를 확인해 주세요.
- 앱 빌드·패키지 검사는 배정 지시에 따라 수행하지 않았어요. source 검사를 실제 통합 확장 결과로 보고하지 않아요.
- 실제 계정·개인 Chrome·유료 API 사용 없음. 버전·커밋·푸시·배포는 실행하지 않았어요.
