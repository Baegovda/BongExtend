# BongExtend 인수인계

기준일: 2026-11-10. 이 문서는 기존 v1.2.10 인수인계를 대체해요. 이후 변경은 package.json, CHANGELOG.md, GitHub Releases를 우선 확인하세요.

## 최신 인계 — v1.2.65 / 세션2 인수

- 앱1.2.65는 CSS pseudo 수량/화살표, 작은 투명 IMG 로고, 넓은 중립 canvas 톤 및 메일 뒤로가기/스크롤바·프레임 경계 요청을 통합해요. 앱 **98a044c46ad19880f96f06d58c4f8997c33e2097** main / v1.2.65 배포 완료예요. CI **42762509817**·Release **42762520141** success, Chrome ZIP **4,882,143바이트**·Windows 보조 ZIP **22,614바이트** uploaded 확인. 앱 코드/검수/배포 작업은 완료했고 별도 시험 프로세스는 종료됐어요. 이후 문서 커밋은 앱 버전을 바꾸지 않아요.
- 사용자 최신 대조: Smartstore 추천 빈칸은 **다크 ON 후 페이지 새로고침하면 정상**이라고 확인했어요. 새로고침으로 증상이 해소된 사실만 확정이며 원인/특정 코드 수정 효과는 입증되지 않았어요. 이전의 ‘응답 대기/계속 빈칸’ 문구는 이 답변으로 대체해요. 수량 +/−·회색 띠·검은 로고는 별도 공통규칙 요청이에요.
- 다크: pseudo-contrast.js/.d.ts는 작은 활성 control의 ::before/after 단색 선·경계 화살표·짧은 중립 glyph만3:1로 보정해요. 실제 배경/alpha 보존, 브랜드/사진/mask/gradient/disabled/hidden/animation 제외,96요소/192규칙 상한·소유 stylesheet/marker OFF 복원이에요. dark.content.ts와 contrast callback에 통합했어요.
- icon-contrast.js는 기존 background-image 분류에 작은 투명 IMG 로고를 추가해요. source/currentSrc/alt/크기/filter는 그대로 두고 소유 CSS content로 중립 paint만 표시해요. standalone은 labelled·short/wide 후보만, 기존 PNG/WebP/SVG 정적/alpha/희소픽셀·크기/캐시/동시성 상한을 따르며 author content/src 교체와 OFF 복원을 보존해요. 기존 worker 권한/보안 검증을 재사용하고 새 권한/도메인 특례 없음.
- contrast.js는 저대비 카드에 +7 배경 덧칠을 제거하고 경계만 보강해요. near-neutral dark, 실제 opaque body와 대비<=1.25, viewport폭85%·높이40% 이상인 border/radius/shadow 없는 흐름 canvas만 body톤에 맞춰요. form/header/footer/nav/dialog/selected/fixed/brand/사진/불명확 합성은 보존해요. 모든 영역을 동일색으로 평탄화하지 않아요.
- 메일: ReaderZoom.navigation 공통 helper와 Gmail/Naver 어댑터, body color-scheme/scrollbar-color 및 Naver outer iframe data-be-mail-theme 경계. mouse button3과 history back은 기존 메일함 동작을 호출하고 일반 휠/배율/기존 초안 유지. 상세 검수 결과는 mail REPORT를 참고해요.
- 검증: JS267+Bun+타입, ZIP/eval/manifest snapshot 통과. source neutral logo/alpha/brand/geometry·canvas·author 변경/OFF(be-logo-surfaces-4FQ9aO), source nested카드/OFF(6jORZP), common contrast10000노드 상한(pw2xtZ), pseudo96요소/disabled/alpha/OFF(wUsM5Y) 통과. 제품 controls/pseudo/IMG/OFF/안정성(R57MNh), divider/focus/경계(q9Ndtz), upstream+제품 깜빡임0 mutation(yiv42o), Gmail button3/history·기존reply draft/zoom/resize(THmrS4), Naver bodybutton3/history·프레임dark/original·zoom/error/close(ReQUwD), 긴본문 dark scrollbar-color/경계(tZC7cS) 통과·화면 직접 확인. 모두 사용자 Temp 아래 합성 Chrome, 실계정 증거가 아니에요.
- Gmail 첫 패키지 검사 실패는 fixture가 합성 layout을 만든 뒤 원래 initOpenEmailEventListeners()를 누락한 것과 중간 build staleness를 확인했어요. fixture에 실제 원래 초기화 추가·최종소스 재빌드 후 통과했으며 제품 back을 가짜로 교체하지 않았어요.
- 사용자 지시: 이번 작업을 끝낸 뒤 **총괄과8개 모듈팀 전체를 새 세션으로 열고 이름 끝에 차수 숫자**를 붙이라는 요청을 반영했어요. 기존 명단은1차이고 다음은 ‘BongExtend 총괄팀 2’·‘BongExtend 메일팀 2’ 등2차예요. 총괄+8팀 모두2차 세션을 실제 생성했고 새ID/소유권은 COORDINATION 상단 현재명단에 기록했어요. 준비 상태는 docs/team/session-2/*.md예요. 총괄+8팀 모두 READY 기록과 실제 idle 상태를 확인했으며 진행 중인 개발/시험/자동 반복 프로세스는 없어요. 새 담당은 읽기 인수만 하며 자체 백로그/전체 시험/코딩/배포를 시작하지 않아요.
- 실제 로그인 주문/결제/cart/메일 API·설치 runtime 검증은 하지 않았어요. Smartstore 상품429 장벽은 재접속/우회하지 않으며 사적인 주문 페이지/결제 상태를 조작하지 않아요. 합성 Chrome 통과는 실제 페이지 해결 증거가 아니에요.

## 이전 인계 — v1.2.64

- 확인된 경계 보강 수정은 앱 **cf7b14a**, main / [v1.2.64 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.64)로 배포 완료했어요. CI **42759682072**·Release **42759685437** success, Chrome ZIP **4,878,892바이트**·Windows 보조 ZIP **22,616바이트** uploaded 확인. 팀 idle·실행 중인 시험 없음. **장바구니 추천 빈칸과 실제 수량 아이콘은 아직 미해결**이며 새로고침 대조 질문 답변/실제 구조 증거가 필요해요. 스스로 백그라운드에서 계속 진행하는 작업은 없어요.

- 사용자 Smartstore https://smartstore.naver.com/v_air/products/4182023833 기본 화면의 과한 경계/어두운 수량버튼과 cart sidebar의 검은 배경/빈 추천 사진·글자 두 상태를 지적했어요. 다크팀 Sol/medium이 disposable 공개 접속1회에서429를 받아 실제상품/추천 DOM을 확보하지 못했고 추가host/UA/쿠키/사용자프로필로 우회하거나 반복접속하지 않았어요. 실제 구매/결제/cart 변경 없음. 사용자 **다크 OFF면 추천 사진/글자가 보인다**고 확인했으며, **다크 ON→페이지 새로고침→cart 다시 열어도 같은지** 추가 응답 대기예요.
- root는 독립된 공통 경계 회귀를 확인·수정했어요. contrast.js가 border-bottom 구분선·평면/넓은 구조 프레임·이미 대비있는 경계도 full box outline으로 덮던 것을, radius>=4px +4면closed border 또는shadow가 있는 저대비 카드만 후보로 좁혔어요. 기존 border 합성대비>=1.6/shadow>=1.8면 추가 보강을 생략해요. 문서구조/visibility/opacity/사진 표시를 임의 수정하지 않았어요.
- source 증거: be-nested-surfaces-YkjNPX(평면/중첩/divider/이미 선명한 둥근경계5개 유지·저대비 둥근1개만 보강·OFF), be-dark-overlay-NrO4tR(일반 rgba backdrop와 동적sidebar의 사진/text 유지·OFF). 합성overlay에서는 실제 blank 추천이 재현되지 않았어요. 수량 +/- 실제 paint도 미확인이에요.
- Chrome 실행 메타데이터와 **BongExtend 항목의 파일 버전/권한 메타데이터만 읽기 전용**으로 확인: 사용자 Chrome Profile2 등록 경로는 C:/Users/Revaptor_FX/Documents/BongExtend, 그 manifest 파일1.2.63, 저장된 active/granted/runtime HTTPS 전체권한은 true예요. 이것은 열린 페이지의 런타임 버전·현재 DOM 검증이 아니에요. 사용자 프로필에 Playwright/CDP를 연결하거나 로그인/쿠키/계정 내용을 가져오지 않았어요.
- root source contrast 합성·10000요소상한·stability 검수 통과(be-contrast-4DYvLG / be-dark-stability-3fsP8Q). 기존 fixture는 둥근 카드로 보강대상을 명확히 하고, 제품 boundary fixture는 raw 저대비 글자 보정과 한쪽 divider가 full box가 되지 않는지 함께 검증하도록 조정했어요. 확인된 경계 수정은 통합/배포를 마쳤고 실제 cart 빈칸 해결은 미확정이에요. 다크팀 source진단 종료/idle, Astra 미사용.
- 최종 검증: 전체 JS267+Bun+타입, ZIP/eval/권한/diff 통과. 제품 boundary(TvFwx6)는 한쪽 divider outline 없음·흰 경계/shadow 재노출 없음·글자/선택focus/hidden/disabled/작성자 semantic 변경/OFF 원복을 확인했어요. 실제 패키지 저대비 둥근 카드의 보강은 유지되고 2.5초안정구간 배경1색·style mutation0, OFF white 원복도 통과(be-dark-stability-n0Lvbu). nested와 boundary 캡처를 root가 직접 검수했어요.
- Chrome 등록 항목의 저장된 active/granted/runtime HTTPS 전체 권한도 true로 읽기 전용 확인했어요. 이 메타데이터로 사용자 페이지 내용이나 살아 있는 runtime 상태를 읽지 않았고, cart 빈칸 원인을 단순 권한 누락으로 확정하지 않아요.

## 이전 인계 — v1.2.63

- 앱 커밋 **a2f9722**, main / [v1.2.63 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.63). CI **42758291292**·Release **42758295193** success, Chrome ZIP **4,878,784바이트**·Windows 보조 ZIP **22,613바이트** uploaded 확인. 환율 탭 정리 구현·검사·배포 완료, 실제 사용자 설치는 미확인. 이후 사용자 Smartstore 상품/장바구니 다크 문제를 다크팀에 새로 배정했어요.
- 사용자 상단 환율 탭이 혼자 보기 싫다는 요청으로 파란 시세 숫자 배지를 제거했어요. popup index/style/main의 badge DOM·색 규칙·갱신 경로만 정리했고 환율 변환/카드/가격 갱신·메일/다운로드 알림과 기존 탭 순서/선택 규칙은 보존해요. 총괄 단독의 작은 수정이며 팀은 추가 호출하지 않았어요.
- 기존 scripts/verify-ui-workflows.cjs를 새 탭 기준으로 보완하고 --tabs-only 집중 모드를 추가했어요. 실제 별도 Chrome 제품에서780/600/520px·7모듈 전환 때 고정38px 헤더 geometry, 환율과 다른 두글자 탭의 같은 크기/폰트, 변환 결과 유지와 light/dark 캡처를 확인했어요. be-ui-flow-a08GgE/fx-dark-780.png, fx-light-520.png 직접 검수예요. 합성 환율/계정이며 사용자 실제 설치 증거는 아니에요.
- 전체 JS267+Bun+타입 및 ZIP/eval/권한/diff 검사 통과했어요. 이전1.2.62의 스타일 한 번 허용 기능은 이미 배포 성공했고 Chrome 승인/실제 설치는 별도예요.

## 이전 인계 — v1.2.62

- 앱 커밋 **65e668f**, main / [v1.2.62 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.62). CI **42757771767**·Release **42757774840** success, Chrome ZIP **4,878,891바이트**·Windows 보조 ZIP **22,613바이트** uploaded 확인. 한 번 허용 기능 구현·검사·배포 완료이며 실제 사용자 설치·승인은 미확인. 사용자가 이어서 요청한 환율 탭 숫자 배지 정리를 총괄이 작업 중이에요.
- 사용자 최신 요청: 스타일 연결을 사이트마다 반복 클릭하지 않고 한 번 허용하면 자동 적용해요. popup은 Chrome 실제 `permissions.contains({origins:['https://*/*']})`로 상태를 확인하고, 명시적인 ‘스타일 자동 연결 한 번 허용’ 클릭에서만 기존 optional HTTPS 전체 권한을 요청해요. 기존 사이트별 CSS 수집/요청 helper는 제거했어요. 새 필수 권한·자동 grant·새 storage key는 없어요.
- 모든 사이트에서 다크 켜기와 스타일 권한은 분리해요. 기존 enabledSites/disabledSites/모듈 OFF를 유지하고 이미 전체 HTTPS grant가 있으면 연결 버튼은 표시하지 않아요. 권한 회수 시 다시 표시되며 background permissions.onAdded/onRemoved에서 기존 sync를 호출해 열린 허용 탭에도 재적용해요. 현재 사이트 켜기는 기존 사이트 권한만 요청해요.
- 실제 패키지 합성 Chrome: 권한 미허용에서 전체 HTTPS 한 번 요청/거절 시 기존 설정 보존, 승인 상태의 실제 Chrome fixture grant에서 팝업 재열기·다른 사이트/새 CDN의 relay에 추가 permission request 없음, 미선택 사이트는 다크 OFF 보존을 확인했어요. 360px light/dark 검수: be-css-product-HOgEqx / iuL4EU. 이 fixture grant는 폐기용 확장 복사본에만 선언했고 사용자 프로필/실제 승인창을 조작하지 않았어요.
- 총괄 단독으로 범위가 작은 UI/권한 이벤트 변경을 진행했어요. 별도 팀을 깨우지 않았고 Astra 미사용. AGENTS에 현재 요청을 기록했어요. 전체 검사/최종 패키지/배포 결과는 확인 뒤 이곳에 추가해요. 아래 1.2.61 CSS 제한과 실제 사용자 설치 미확인 사항은 그대로예요.
- 최종 1.2.62 검증: 전체 JS267+Bun+타입, ZIP/eval/권한·diff 검사 통과. 실제 패키지 fixture 최종 dy6fMk(미허용/거절), aA1lTn(실제 시험 프로필의 전체 HTTPS grant 재사용/다른 사이트+새 CDN/재열기/미선택 OFF). 사용자 실제 Chrome 권한 승인·설치 여부는 시험하지 않았어요. 스크린샷 직접 검수는 같은 코드의 앞선 HOgEqx/iuL4EU light/dark360px이며 최종 변경은 권한 event 갱신 listener뿐이에요.

## 이전 인계 — v1.2.61

- 최종 앱 커밋 **70dbfdc**, main / [v1.2.61 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.61). CI **42756864720**·Release **42756868180** success, Chrome ZIP **4,879,332바이트**·Windows 보조 ZIP **22,617바이트** uploaded 확인. 구현·검수·푸시·릴리스 완료, 다크팀 idle·추가 시험 프로세스 없음. 사용자 Chrome 설치·권한·열린 페이지 적용은 별개예요. 후속 증거 문서 커밋은 앱 버전을 바꾸지 않아요.
- 사용자 무신사 브랜드 페이지의 부분 흰 배경/검정 상품명 문제를 공통 CSS 읽기 경로로 수정했어요. 실제 공개 https://www.musinsa.com/brand/musinsastandard?gf=A 의 msscdn 스타일2개가 CORS 읽기 실패했고, 해당 CSS를 읽으면 흰 bg-white 영역과 글자가 정상 테마되는 것을 source before/direct/relay/OFF로 확인했어요(be-musinsa-css-lvf6Yg). 사진을 덮는 사이트 전용 CSS는 추가하지 않았어요.
- css-resource.js/.d.ts의 darkStylesheetOrigins는 HTTPS 공개형 주소·.css 경로·exact page/resource origin 패턴을 반환하고 기존 Naver/DC permission helper는 호환용으로 남겨요. fetchDarkStylesheet는 credentials omit/redirect error/text-css/UTF-8/5MiB streaming 상한·cancel을 적용해요. IP/local/private형 이름은 image-resource 검증 재사용, DNS의 실제 사설주소 해석까지 판별하는 함수는 아니에요.
- background의 기존 bongextend-dark-css port를 공통화했어요. 실제 sender.id/tab/문서기원·현재 module/site ON과 양쪽 기존 origin 권한을 검사, 동시4/대기24/queue+fetch 총12초·disconnect abort·대기 뒤 재검증이에요. content는 일반 fetch가 실패하고 공통 조건이 맞을 때만 relay해요. 새 필수 권한·자동 grant·로그인 정보 전송은 없어요.
- popup/dark-css-access.ts는 현재 top 문서의 stylesheet 주소만128개 이내 읽고 부족한 외부 origin 최대16개만 확인해요. 현재사이트 켜기 시 요청에 포함하고 이미 켠 사이트는 ‘페이지 스타일 연결’을 표시해 사용자 Chrome 권한 승인 뒤 재적용해요. 거절은 기존 설정 유지. 실제 사용자 Chrome 권한은 접근하지 않았어요.
- root 실제 패키지 fixture: 합성 직접 fetch 실패를 강제해 실제 content→worker→CSS/글자·면 전환, 미허용/private/비CSS/비웹sender/OFF 거절,12개 요청의 동시4 상한, permission UI의 exact origin 요청·거절유지·360px 검수 통과. public 모드는 fixture용 musinsa/msscdn grant를 별도 복사본에만 추가하고 실제 공개 페이지에서 밝은 면/상품명 개선과 사진20개 URL/filter 원형을 확인했어요(be-css-product-zFSTkj, 최종 검사 결과 아래 추가).
- 최종 1.2.61 패키지 증거는 **be-css-product-t2aoka**예요. 공개 페이지의 안내 modal 확인을 닫은 뒤 상단·900px 아래 신상품 영역까지 검사/직접 캡처 검수, 흰 큰 면 없음·상품명 대비·사진20개 원색 보존과 OFF 복원. permission-360.png는 거절 후 안내가 읽히는지 확인했어요. 실제 Chrome 권한 승인 dialog를 자동 우회하지 않았고 fixture는 요청 origin/거절 흐름만 주입 시험했어요.
- 전체 JS267+Bun+타입 및 ZIP/eval/권한 검사를 통과했어요. agent source 진단과 root 제품 경로를 구분하고, 실제 사용자 설치·CDN 권한·로그인 상태는 미확인이에요. 다크팀 Sol/medium 한 곳만 배정해 담당 완료/idle, Astra 미사용. 이전 1.2.60 흰 경계선과 1.2.59 flicker/메일 수정은 보존해요.

## 이전 인계 — v1.2.60

- 앱 커밋 **410663e**, main / [v1.2.60 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.60). CI **42755182217**·Release **42755188452** success 확인. 앱 구현·검수·푸시·릴리스가 끝났으며 사용자 실제 설치/로그인 화면 검증과는 별개예요. 이후 문서 커밋은 앱 버전을 바꾸지 않아요. 사용자 새 무신사 부분 테마 요청은 다크팀에 별도 배정 중이에요.
- Chrome ZIP **4,878,494바이트**·Windows 보조 ZIP **22,614바이트** uploaded 확인.
- 사용자 네이버페이 구매내역의 흰 경계선 지적을 공통 회귀로 조사했어요. 실제 로그인 DOM은 확보하지 못했지만, upstream 단독이면 어두운 inline border/shadow가 helper marker 추가 뒤 흰색으로 돌아오는 경로를 합성 Chrome에서 확정 재현했어요. site-fixes.js의 요소전체 ignore를 HTML 카드/아이콘에서 제거하고 SVG paint 격리만 유지해요. upstream 추가 패치·도메인별 dim 규칙은 넣지 않았어요.
- helper가 직접 쓴 inline!important 속성은 유지하고 같은 요소의 나머지 경계/그림자는 upstream이 계속 처리해요. source fixture에서 baseline→helper ON→helper stop 동일·전체 OFF white 원복, alpha/opacity·브랜드/선택·hidden/disabled/사진·SVG/data 아이콘·observer 안정화를 확인했어요(be-dark-boundaries-tFcRvz). 이전 버전 white 회귀 근거는 be-dark-boundaries-rELQTU예요.
- root 최종 패키지 fixture는 실제 content/worker/등록과 inline 3px white border·white shadow가 어두운 원래 변환을 유지하는지 통과했어요. 키보드 focus outline을 보강 inline outline이 덮는 문제도 발견해 contrast.js :focus-visible 예외와 focusin/out 재평가로 수정했어요. 작성자 semantic border 변경과 OFF 원복·hidden/disabled·안정구간 mutation0도 확인했어요. scripts/verify-dark-boundary-product-browser.cjs, be-boundary-product-lJg4lu(최종), 8lXQNV(직접 시각검수·동일 HTML 경계 시나리오).
- 전체 JS265+Bun+타입 및 빌드/ZIP/eval/권한 필수 검사를 통과했어요. 다크팀 한 곳 Sol/medium만 배정했고 이 흰 경계선 배정은 완료, Astra 미사용이에요. 네이버페이 실제 사용자 설치/로그인 결과는 여전히 미확인이며 아래 과거 미확인 항목은 유지해요.

## 이전 인계 — v1.2.59

- 최종 앱 커밋 **d62968a**, main / [v1.2.59 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.59). CI **42754068705**·Release **42754074042** 모두 success, Chrome ZIP **4,878,450바이트**·Windows 보조 ZIP **22,614바이트** uploaded 확인. 구현·검수·푸시·릴리스 완료, 담당팀 idle·추가 시험 프로세스 없어요. 실제 Chrome 설치·열린 페이지 새로고침·로그인 네이버페이 화살표 검증과는 별개예요. 이후 증거 문서/fixture charset 보완 커밋은 앱 버전을 바꾸지 않아요.
- 사용자 새 요청: 네이버페이 3/4 좌우 버튼 저대비, 네이버 계정만 다른 UI, 나무위키 WARDOGS 회색 깜빡임. 모든 사이트 지적은 공통규칙이라는 기준을 유지했어요. 다크·메일팀 Sol/medium 두 곳만 배정했고 Astra는 사용하지 않았어요.
- contrast.js는 실제 작성자 inline 선언과 기반 엔진의 --darkreader-* 보조 변수를 구분해요. 직접 보정한 속성의 transitionend도 새 사이트 변경으로 처리하지 않아요. 기존 소스로 upstream+공통 fixes+색 전환 카드를 검사하면 2.5초 동안78 style mutation/16 pass와29 배경색이 반복됐고, 수정 후 안정 구간은0 mutation/0 추가 pass/1색이에요. 실제 작성자 style/class 변경과 OFF 원복도 확인했어요.
- 공개 namu.wiki/w/WARDOGS에 소스 helper+기반 엔진을 적용해 회색 패널3개와 배경의 색이 안정적이고 표본2.5초 동안 추가 보정0회였어요. 실시간 최근 변경으로 scan pass는 계속 발생할 수 있어요. 이는 공개 페이지 helper 검증이며 사용자의 실제 설치/동일 환경 재현 증거가 아니에요. 캡처 be-dark-stability-V9rE1h/public-dark.png.
- 작은 활성 컨트롤의 명시적 중립 SVG fill/stroke와 bounded data SVG/PNG/WebP 배경 보정을 추가했어요. 색상/사진/hidden/disabled/복잡한 SVG 보호·OFF 원복, 나중 fill/stroke 속성 변경 반영을 합성 Chrome에서 확인했어요. 네이버페이 history는 로그인으로 이동해 실제 carousel의 DOM은 확보하지 못했어요. pseudo/border/mask 형태는 아직 이 보완 대상이 아니므로 실제 사용자 버튼 해결을 확정하지 않아요.
- 네이버 계정 header가 Gmail과 같은 accountHeader/j-button 액션/정렬·접기 크기를 사용해요. N 로고·드래그·기존 순서 저장·내부 reader 보존. mail fixture 전체 담당 검사와 최종 패키지 header-only(동일 높이/정렬폭·360/480px) 통과, be-naver-mail-RUZx8q/hQeYrw. 실계정 기능은 여전히 미검증이에요.
- 전체 JS265+Bun+타입, ZIP/eval/권한 검사 통과. 신규 focused scripts는 verify-dark-stability-browser.cjs(--public, --packaged), verify-dark-arrow-browser.cjs예요. 이전 원색/메일 본문 다크 정책과 아래 미확인 사항은 그대로 유지해요.
- 최종 패키지 content→worker→등록→합성 HTTPS 카드 검사는 배경1색/style mutation0과 OFF white 복원 통과(be-dark-stability-iGjb4C). 첫 fixture는 exact host grant만 넣어 제품의 wildcard 등록 조건에 맞지 않아 timeout했으며, 폐기용 manifest에 기존 다른 fixture와 같은 시험 서브도메인 grant를 넣어 통과했어요. 제품 권한/등록 코드는 바꾸지 않았어요.

## 이전 인계 — v1.2.58

- 최종 앱 커밋 **3a9db99**, main / [v1.2.58 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.58). CI **42751010897**·Release **42751014261** 모두 success. Chrome ZIP **4,878,179바이트**·Windows 보조 ZIP **22,614바이트** 게시 확인. 이 배정의 구현·검수·푸시·릴리스 완료, 담당팀 idle·추가 코딩/시험 프로세스 없음. 사용자 Chrome 적용·실계정 검증과는 별개예요. 이후 문서 커밋은 앱 버전을 바꾸지 않아요.
- 사용자 요청: 메일 본문 Ctrl+휠 배율과 본문에도 같은 다크 모드를 적용해요. 이전의 ‘발신자 색 원형 보존’ 요청은 원본 모드 복원 기준으로 유지하고 새 자동 다크를 막는 조건으로 쓰지 않아요. AGENTS와 README/CHANGELOG에 반영했어요.
- public/js/bongextend-reader-zoom.js는 Gmail·Naver 공통 몸체 배율 helper예요. Ctrl/Meta+휠만50~200%, 일반 휠은 소비하지 않아요. Gmail은 messageBody 위의 wheel만, Naver는 scriptless 본문 document에서 parent realm listener로 처리해요. 80/100 버튼과 상단 UI 크기를 보존해요.
- mail-appearance.ts가 앱의 prefers-color-scheme와 core.modules.dark를 따르고 core.mailBodyTheme(auto/dark/original)를 저장해요. dark면 앱이 밝아도 강제, original/모듈 OFF는 원래 inline 색/priority 복원. 공통 밝기/대비/sepia/grayscale/배경·글자 및 mail.google.com/mail.naver.com siteTheme를 사용하고 사진 보존을 위해 동적색 변환 mode1로 처리해요.
- patches/darkreader@4.9.134.patch는 기존 artwork URL/MAIN proxy 보완을 유지하며 upstream Background/Foreground/Border 색 함수3개만 추가 export해요. 색 호출의 register=false로 문서 전역 CSS를 만들지 않아요. **API import가 chrome.runtime.sendMessage의 Promise 반환을 가로채는 upstream shim을 설치하므로 color-only 동적 import 직후 native sendMessage/onMessage.addListener를 복원해요.** 이 분리를 삭제하면 공통 메일 설정 요청이 실패해요. Bun frozen install·patch reverse check·proxy sync check 통과했어요.
- 새 dark/mail-theme.js는 지정된 메일 subtree만 변환해요. Gmail은 .messageBody, Naver는 외부 앱을 포함하지 않는 sandbox 본문 문서의 html canvas예요. readonly 관찰/rAF batch120·8ms, 사전6000요소 상한/큐32개이며 넘으면 일부 테마를 남기지 않고 전체 원본으로 복원해요. legacy bgcolor/font attrs·이미지URL/filter·SVG currentColor·편집/disabled/hidden·레이아웃·이벤트는 보존해요. 복잡한 pseudo/shadow/nested iframe/일부 CSS color·이미지 위 글자는 전체 변환을 보장하지 않아요.
- 검증: 전체 JS265개+Bun+타입 통과. Chrome 제품 fixture에서 Gmail 원본/자동 다크/앱 밝음 복원/강제 다크/색상 설정 변경/모듈 OFF·재ON/원본 복원, 실 Ctrl+휠 본문 배율과 일반 휠 스크롤·상단 크기 불변·resize/문맥 메뉴를 통과했어요(be-reader-VFhhIz). Naver 설정 통신·본문 sandbox·html canvas dark·Ctrl+휠·원본색·오류/취소·520px도 통과했어요(be-naver-mail-T3z4RI). 모두 별도 Chrome의 합성 메일이며 실제 로그인 계정의 동작 증거는 아니에요.
- agent source-helper fixture는 before/dark/restored·큰 본문 원본 보존을 be-mail-theme-fu2GPT에서 확인했어요. DOM에서 script를 실행하거나 외부로 메일을 보내지 않아요. 큰 메일과 지원하지 않는 CSS는 원본 색으로 볼 수 있어요. 아래 1.2.57의 실계정 API와 몰테일 사진 미확인 사항은 여전히 남아 있어요.

## 이전 인계 — v1.2.57

- 최종 앱 커밋 **3485bfc**, main / [v1.2.57 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.57). CI **42664124741**·Release **42664128999** 모두 success, Chrome ZIP **4,837,075바이트**·Windows 보조 ZIP **22,611바이트** 게시 확인. 이 버전의 코드·검사·푸시·릴리스를 마쳤고 팀/시험 프로세스는 idle/종료예요. 남은 몰테일 사진 진단은 사용자 OFF 대조 답변이 필요하며 백그라운드에서 계속 작업 중인 상태가 아니에요. 이후 문서 커밋은 앱 버전을 바꾸지 않아요.
- 검증 완료: 전체 JS262개+Bun+타입, release ZIP/eval/권한 검사 통과. 최종 SVG mask/상속 mask 두 형태는 alpha/brand 차이0·defs 보존, 실제 패키지 relay도 권한 거절/OFF 복원까지 확인했어요.
- 사용자 최신 요청은 Gmail·네이버 통합 계정의 드래그 정렬과 네이버 앱 내부 본문 읽기예요. 추가로 몰테일 다크 화면의 로고/아이콘 저대비와 상품 빈칸을 조사했어요. 이전 항목의 완료를 새 실계정/사이트 검증으로 간주하지 않아요.
- 계정 정렬: public/js/bongextend-mail-ui.js 전용 grip(pointer/가장자리 스크롤/Escape·cancel), naver-mail.ts가 cancelable `bongextend-mail-account-move` {sourceKey,targetKey,placement}를 실제 계정 DOM 키로 검증하고 기존 core.mailAccountOrder에 저장해요. native Gmail 객체·index·위/아래 버튼을 보존하고 리스너는 iframe 문서마다 한 번 설치해요.
- 네이버 읽기: naver-reader.ts, modules/naver-mail/client.js/message.js, public/naver-reader.css. 사용자가 선택한 mailSN만 /json/read로 session POST, redirect:error/no-store/15초/계정·모듈·기존 권한 확인. 닫기/연결 변경/모듈 OFF는 본문을 비우고 늦은 응답을 무시해요. 제목·발신자·80/100%·재시도·명시적 네이버에서 열기를 제공해요.
- 본문은 저장소에 보관하지 않고 HTML 허용목록으로 복사한 뒤 **allow-scripts 없는 sandbox+script-src none** 프레임에 표시해요. 원래 색/이미지·기본80% 유지, forms/events/active URLs/외부 style·script는 제거해요. Naver 답장/첨부 전체 기능은 원본 사이트에서 해요. **실제 로그인 Naver의 /json/read 응답 형식·읽음 처리·첨부/인라인 CID 이미지는 미검증**이에요. 합성 API fixture 통과를 실계정 성공으로 표현하지 않아요.
- 다크: 작은 투명 static SVG의 명시적 중립 paint만 공통 보정하고 vector geometry/컬러/alpha/사진을 보존해요. SVG 위험 요소와 크기 상한은 icon-contrast.js를 참고해요. background의 전용 image relay는 실제 sender URL/현재 다크 설정/페이지와 자원 양쪽 기존 origin 권한, credential omit/redirect error/3초/128KiB/동시4를 검증해요. 새 필수 권한·도메인 특례는 없어요.
- Chrome 검증: 실제 parent 정렬 저장/재열기·객체/index 유지, Naver 앱내 읽기/색·이미지/80%·재시도·닫힌 뒤 지연 응답/520px/스크립트 제거를 be-naver-mail-0jmXEq에서 확인했어요. Gmail reader 원색/이미지/배율/resize/문맥 메뉴는 be-reader-UeRJmm에서 재검사 통과. 실제 패키지 content→CORS 실패→권한 검증 worker→SVG 보정 및 브랜드/alpha/사진 보존·권한 거절·OFF 복원은 be-image-relay-u7mEq7에서 통과했어요. 계정 grip 취소/스크롤과 공개 Malltail SVG 픽셀/위험 SVG 검증은 각 REPORT를 참고해요.
- **몰테일 상품 사진 빈칸은 미해결/미재현**이에요. 공개1500px와3600×1950 before/ON/OFF 모두 사진 loaded/naturalWidth/URL/filter/opacity를 유지했고 사용자 스크린샷과 일부 외부 CSS 적용 조건도 달라요. 사용자에게 ‘다크 OFF 하면 사진이 나타나는지’ 질문을 보냈고 아직 답변이 없어요. 원인 없이 사진 표시/반전 패치를 추가하지 않았고 이 증상 해결을 주장하지 않아요. 이 후속 진단은 답변이 필요해요.

## 이전 인계 — v1.2.56

- 최종 앱 커밋 **89364c9**, main / [v1.2.56 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.56). CI **42657326353**·Release **42657332139** 모두 success. Chrome ZIP **4,828,953바이트**·Windows 영상 보조 ZIP **22,614바이트** 게시 확인. 이 배정의 구현·검사·푸시·릴리스 완료, 담당팀 모두 idle이며 추가 코딩/시험 프로세스는 없어요. 이후 문서 커밋은 앱 버전을 바꾸지 않아요.
- 2026-11-10 사용자 후속 요청: 남색을 줄인 Chrome 계열 중립 차콜/밝은 회색·진주빛 유리 UI, 탭 크기 통일, 다운로더 한 줄, 모든 모듈의 사용자 흐름, 치지직 넓은 화면 F11 실패를 반영했어요. package.json은 1.2.56이고 배포 결과는 아래 기록을 최신으로 유지해요.
- 공통 theme/tokens와 첫 화면 색을 중립화했어요. 상단 38px/선택 전후 같은 크기의 탭·고정 도구 슬롯, 공통 설정의 상단 이동, 아래 크기 조절 손잡이를 가리지 않는 다운로드 하단을 적용했어요. Chrome 개인 테마를 읽거나 자동 동기화한 것은 아니에요.
- 최근 다운로드는 42px 한 줄 목록(파일/주소/크기·상태/시간/동작), 짧은 상태/전체 툴팁/2px 진행률과 키보드 포커스 복원이에요. 자체 테마가 있는 최근 목록에는 vendor embed 테마를 뒤늦게 덧씌우지 않아요. 전체 관리자의 DB/파일/업데이트 엔진은 변경하지 않았어요.
- 메일: 계정별 접기/펼치기·안 읽음 설명·대상 계정 작업명·키보드 계정 열기·빈/오류 안내. 기존 엔진/계정 순서/N 로고/80%/본문 원색을 보존해요. 유리 그라데이션 아래 불투명 기본색이 빠져 흰 바탕이 비치던 것도 통합 화면 검수에서 고쳤어요.
- 번역·치지직·다크는 주요 동작을 먼저 보여주고 세부 조정을 details로 접어요. 디시는 실제 키보드 버튼, 환율은 금액/기준/대상 통화 라벨이에요. 꺼진 모듈의 상태·켜기, 업데이트/기능 선택 우선, 백업/앱 정보 접기, 전체 설정의 다운로더/다크 진입 및 우클릭 적용 탭 선택을 추가했어요. 데이터/키/라이선스/권한을 보존해요.
- 치지직 `content-wide.js`는 fullscreen 요청 전에 성공으로 기억하고 응답을 버리던 문제를 고쳤어요. 응답 확인·최초 포함 최대4회·1.2초×시도 횟수 대기이며 수동 해제/설정 OFF는 반복하지 않아요. 기존 background 창 소유/복구 규칙과 단축키는 변경하지 않았어요.
- 검증: 전체 JS257개+Bun+타입, ZIP/eval/권한 통과. disposable Chrome에서 7모듈 light/dark·600/360px, 520/600/780px 동일 탭 geometry와 한 줄 다운로드/포커스, 꺼진 모듈 켜기·접힌 설정·우클릭 탭 선택·전체 설정 진입, 합성 Gmail/Naver와 reader 색/이미지/80%/크기/문맥 메뉴를 확인했어요. 치지직은 첫 window API 거절 뒤 실제 fullscreen 재시도·normal/maximized 복구·기존 fullscreen·수동 해제·탭 전환/이동 시험을 담당팀이 확인했어요.
- 증거: be-ui-flow-DNtKOq, be-glass-ui-8eJhvp, be-naver-mail-x31mCZ, be-reader-7cuRdK, be-chzzk-wide-OpcAPE (모두 사용자 Temp 아래). 각 REPORT와 검사 스크립트를 참고해요. 마지막 메일 기본색 수정 뒤 Naver fixture를 다시 통과했고 본문 스타일/로직은 바꾸지 않았어요.
- **실제 사용자 설치 버전·로그인 네이버/Gmail/치지직 방송에서의 개선은 미확인**이에요. 합성 검사를 실제 계정 검증으로 표현하지 않아요. 배포 후 기존 페이지를 새로고침해야 새 콘텐츠 스크립트가 적용돼요. 팀은 사용자 개별 메시지 대신 REPORT/내부 경로로 총괄에게만 보고하며, 이 지시를 AGENTS와 협업 규칙에 기록했어요. Astra 미사용이에요.

## 이전 인계 — v1.2.55

- 최종 앱 커밋 **f4ffc8a**, main / [v1.2.55 Release](https://github.com/Baegovda/BongExtend/releases/tag/v1.2.55). CI **42648315178**·Release **42648319228** 모두 success. Chrome ZIP **4,822,834바이트**·Windows 보조 ZIP **22,613바이트** 게시 확인. 코드·검사·배포 완료, 담당팀 모두 idle이며 추가 실행 중인 작업은 없어요. 이후 문서 커밋은 앱 버전을 바꾸지 않아요.
- 사용자 승인으로 BongExtend 전체 UI를 **세련됨·고급스러움·유리 질감·그라데이션·오묘한 색상·애플 감성** 방향으로 리메이크했어요. AGENTS.md에 지속 정책과 다크 모드의 “사이트를 디자이너가 직접 재설계한 듯한 자연스러움” 목표를 기록했어요.
- 공통 theme.css/tokens.js에 남청색/진주색·청록/보라 sheen·glass/control/gradient 토큰, 대비·focus·모션/투명도 줄이기·불투명 fallback을 넣었어요. 앱 셸, 메일·다운로더·번역·치지직·디시·환율·다크·공통 설정/업데이트를 연결했어요. 메일 원색/80%·계정 순서·기존 기능/라이선스/데이터는 유지해요.
- 다운로더 actual task row0은 기존 vendor에서도 재현됐어요. `__cdexp_$0` 로컬 DB 조회 export 부재로 wf.eg가 []를 반환하던 것을 public/download-module.js의 native **readonly** adapter로 복구했어요. 숫자 state3/4·exists/recycled는 원본과 맞췄고 DB migration/파일삭제/권한 확대는 없어요. focus/click으로 즉시 닫히던 검색도 고쳤어요.
- 웹 다크 공통 엔진: stable opacity>=.5 중립 글자는 원래 opacity/color alpha를 유지하며 합성 대비4.5를 보정해요. 명시된 선택 상태와 원래 불투명한 탭/탐색 그룹의 면을 구분하고, 의도적 fading/브랜드/사진/숨김/disabled/투명 nav는 보존해요. 스타일/애니메이션 조회 batch 캐시와 상한을 검증했어요. 콘텐츠 사이트에 확장 UI glass 색을 강제로 씌우지 않아요.
- 검증: 전체 JS254개+Bun+타입, ZIP/eval/권한. Chrome 임시 프로필에서 7모듈 밝음/어두움 및600/360px, 합성 schema의 실제 디시 Vue control, 메일 reader/원색/배율/resize/context menu, 다운로드 실제2MiB 시작/일시정지/재개/재시작/바이트일치/완료개수/목록제거후파일보존/설정저장·오류0, 관리자 실제작업/검색/선택/734·440px, 공통 다크 합성·공개 네이버/리셋 범례 검사 통과. 개별 REPORT.md에 캡처·근거가 있어요.
- **실제 로그인 네이버 메뉴·메일 미리보기와 쪽지 목록은 여전히 미확인**이에요. 사용자 최신 스크린샷과 구조가 같다는 근거 없이 해결됐다고 말하지 않아요. 사용자 실제 Chrome 적용·기존 페이지 새로고침도 배포와 별개예요. 모든 사이트의 완벽한 재디자인이나 경쟁 제품보다 우월함이 입증됐다는 주장은 하지 않아요.

## 이전 인계 — v1.2.54

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
