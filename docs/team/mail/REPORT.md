# 1.2.57 총괄 통합 — 계정 드래그와 네이버 앱내 읽기

- root가 parent 어댑터를 결합했어요. 실제 패키지에서 Gmail↔Naver pointer drop, core.mailAccountOrder 저장·재열기, native account id/index 보존과 기존 위/아래 이동을 확인했어요.
- Naver 메시지는 선택 시 /json/read 응답을 HTML 허용목록+scriptless sandbox로 표시해요. 원색·raster 이미지·80/100%·목록 복귀·오류 재시도·취소 뒤 응답·520px 검사 통과. 본문은 저장소에 보관하지 않아요. 답장·첨부 전체 기능은 명시적인 네이버에서 열기예요.
- 실제 로그인 계정의 API 응답 형식·읽음 처리·CID/첨부 및 Naver 본문 번역 전체 경로는 미검증이에요. 합성 통과와 실계정 성공을 구분해요.
- root 증거: Temp/be-naver-mail-0jmXEq (합성 Naver/정렬/520px), be-reader-UeRJmm (Gmail reader/문맥 메뉴/resize), 집중 JS3개. 실제 계정·유료 요청·개인 프로필 접근은 없었어요.

# 계정 드래그 담당 보고 (통합 계약 이행 완료)

- 기준 main `13661f0`, 앱 1.2.56. 소유 변경: public/js/bongextend-mail-ui.js, public/checkerplus-embed.css, scripts/verify-mail-account-drag.cjs예요.
- **통합 계약**: naver-mail.ts loaded()에서 iframe document의 `bongextend-mail-account-move` 이벤트를 수신해 주세요.
- cancelable CustomEvent detail은 `{sourceKey,targetKey,placement}`, placement는 `before` 또는 `after`예요.
- 키는 기존과 동일한 gmail:소문자주소 / naver:소문자주소예요.
- 현재 DOM에서 두 키가 존재하고 서로 다른지 검증한 뒤 기존 core.mailAccountOrder 정렬·저장 경로로 적용해 주세요.
- 수락한 요청은 `event.preventDefault()`로 응답해 주세요. 수락하지 않으면 UI는 DOM·저장소를 변경하지 않아요.
- parent의 loaded() 재호출 시 옛 document 리스너 해제, 새 document에 1회 설치가 필요해요.
- 담당은 naver-mail.ts를 수정하지 않았어요. 위/아래 버튼이 쓰는 저장·복원 경로를 root가 공유해 주면 돼요.
- 구현: Gmail/네이버 헤더 왼쪽 전용 grip에서 pointer capture로 드래그해요. 일반 계정명·본문·입력 영역은 드래그 시작점이 아니에요.
- 5px 이동부터 드래그 활성화하고 대상 계정의 앞/뒤 위치를 선으로 표시해요. 실제 DOM은 drop 이벤트 수락 시 parent만 변경해요.
- 화면 안 드래그에 한해 inbox 가장자리 32px에서 자동 스크롤해요.
- Escape·pointercancel·capture 해제·창 blur/pagehide·원본 계정 제거·영역 밖 놓기는 저장하지 않고 정리해요.
- 마우스업/클릭이 계정/메일 열기로 전달되지 않으며, grip 위/아래 방향키는 기존 이동 버튼을 호출해요.
- native account 객체/index·로그인·폴링·본문·N 로고·기존 설정은 변경하지 않아요.
- 검증: `node scripts/verify-mail-account-drag.cjs` 최종 통과. 소스 HTML 합성 헤더를 폐기용 실제 Chrome에서 실행했어요.
- 검증 범위: Gmail↔네이버 pointer 이동 이벤트/위치, native ID 보존, 취소/영역 밖/수락 거절 무변경, grip 키보드 이동, 자동 스크롤, 메일 열기 0회, 밝음/어두움·600×500예요.
- 검사는 parent 어댑터를 모의 구현해 프로토콜을 확인해요. 실제 parent core.mailAccountOrder 저장/재열기는 root 통합 후 기존 네이버 fixture로 확인해야 해요.
- 캡처: `C:/Users/Revaptor_FX/AppData/Local/Temp/be-mail-drag-61Rumd`의 light.png/dark.png/drag-scroll.png를 직접 확인했어요.
- JS syntax 및 집중 변경 git diff --check 통과했어요.
- 앱 build·전체 검사·버전·커밋·배포는 실행하지 않았어요. 실계정·개인 프로필·유료 API 접근은 없었어요.
- 배정 파일 구현은 종료했어요. root 어댑터 결합 외 추가 사용자 선택은 필요 없어요.
