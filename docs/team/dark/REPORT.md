# 공통 대비 보정과 긴급 쪽지 조사 보고

## 2026-11-10 메뉴·반투명 미리보기 보완 (최신 배정)

- 총괄 최종 공개/합성 재검사 통과: 10000노드 상한과 자기 mutation 안정화(visited6064/styleReads1765/animationReads2/maxBatch180), 공개 네이버 카드면·outline, codex-resets 범례·가시칸 색 일치 유지. `C:/Users/REVAPT~1/AppData/Local/Temp/be-contrast-BYL2Em`. 실제 로그인 메뉴·미리보기 검증은 아니에요.
- 추가 검토 반영: selected 경계만으로 탭띠 문제를 해결했다고 보지 않아요. role=tablist/nav/navigation의 작은 조작요소2~12개, 높이100px 이하, 원래 불투명한 중립 표면이 있고 부모와 대비가 낮은 조건에서 **그룹 면만 RGB+10**으로 구분해요. 투명 nav·그림/disabled 포함 그룹·움직이는 효과는 그대로예요. 도메인/네이버 클래스 분기는 없어요.
- 실제 변경 수치(합성): 탭띠 bg rgb(24,26,27)→rgb(34,36,37), 투명 nav inline background 변경 없음. 반투명 미리보기는 .72 group opacity/.85 color alpha 보존 + 최종 합성 대비>=4.5 확인. 글자 크기/굵기·기존 의미색·선택 경계 위계는 유지해요.
- 성능 추가 개선: batch별 computed-style/실제 paint-animation 판정 WeakMap 캐시, animation/transition 선언이 없는 정상 글자는 getAnimations 호출 생략. stats에 styleReads/animationReads만 추가했고 소비 API는 동일해요.
- 최종 관련 검사: 단위3개와 합성 브라우저 통과. 10000노드 한정 검사 누적 visited6064/styleReads1763/animationReads2/maxBatch180, 정상 글자 stress 중 animationReads 증가0, 48pass 후 무한/자기 dirty 재순회 없이 안정. 최종 캡처 C:/Users/REVAPT~1/AppData/Local/Temp/be-contrast-OkvmfT/synthetic-dark.png 직접 확인했어요.
- 이번 마지막 표면·캐시 변경 후 비로그인 공개 검사를 중복 실행하지 않았어요. 실제 로그인 메뉴/메일 미리보기 구조와 개선 효과는 여전히 미확인이며 사용자 사진의 모든 문제가 해결됐다고 주장하지 않아요. 전체 UI 리디자인/완벽한 사이트별 수작업 품질 완료도 아니에요. 추가 build/ZIP/커밋/배포는 하지 않았어요.

- 기준 main118f4f5/앱1.2.54. 담당 변경은 contrast.js, test/contrast.test.js, scripts/verify-dark-contrast-browser.cjs, REPORT예요. .d.ts/API는 변경하지 않았고 타 팀 변경을 보존했어요.
- 원인 후보를 공통 보완: 이전에는 opacity<.99인 글자/조상이면 전부 건너뛰었어요. 이제 안정된 opacity .5 이상 중립 글자는 조상별 배경alpha와 group opacity를 안쪽부터 합성해 최종 대비4.5:1을 계산해요. 원래 opacity와 color alpha 모두 보존하며 색의 RGB만 필요한 만큼 밝게 해요.
- 실제 실행 중인 opacity/color/background 애니메이션·전환은 제외하고 종료 후 다시 평가해요. 자기 color 전환 종료로 재보정 루프가 생기지 않도록 소유 이벤트는 제외했어요.
- 명시 role=tab+aria-selected 또는 aria-current 링크/메뉴가 부모와 가까운 면색이고 유효한 기존 경계/그림자/outline이 없을 때만 얇은 중립 경계를 더해요. 기존 선택 경계·의미색·focus는 유지해요. aria 상태 변경 시 복원해요.
- 새로운 도메인 분기는 없어요. 콘텐츠 사이트에 확장 UI 유리 토큰을 넣지 않았고, 글자 굵기/크기/내용/원래 사진/브랜드/숨김/disabled/편집 영역은 유지해요.
- 검사: 단위3개 통과. 합성 Chrome에서 중첩 background alpha+.72 group opacity+.85 글자 alpha의 실제 합성 대비>=4.5, opacity/alpha 불변, idle transition 선언은 허용, 실제 fade 보호, 선택 해제 시 경계 복원, 브랜드/hidden/disabled/stop/새 inline 보존 통과했어요.
- 자기 mutation 안정화와 10000노드 상한 검사 통과(최대batch180, 방문6058 누적, 최종 재검사42pass 후 안정). 기존 공개 Naver/codex-resets API+helper 검사도 통과했어요. 전체 빌드/타입/ZIP/릴리스는 실행하지 않았어요.
- 직접 화면 검수: C:/Users/REVAPT~1/AppData/Local/Temp/be-contrast-WBpZIg/synthetic-dark.png (일반 구조 합성), naver-dark.png (비로그인 공개 메인), codex-resets-dark.png. 최종 추가 합성 ratio assert 재검사 폴더는 be-contrast-oyymg0예요.
- 한계: 로그인 프로필 탭과 실제 메일 미리보기 DOM은 접근하지 않았어요. 사용자 증상 해결 완료는 미확인이에요. 사진/gradient 배경·filter/blend·강한 의미색·opacity<.5·최대 밝기로도 목표대비 불가능한 글자는 안전하게 미보정해요. 모든 페이지를 수작업 수준으로 완성했다는 증거는 아니에요.
- 총괄 의존: 기존 연결 API 변경 없이 새 helper를 다음 통합 빌드에 포함하고 실제 사용자 페이지 적용 후 확인해야 해요. 담당 배정을 마쳐요.

## 총괄 통합 v1.2.54 (2026-11-10)

- 최종 배포: 앱 commit bf6d335 main + v1.2.54. GitHub CI42642155913 / Release42642160225 모두 success. Chrome ZIP4,812,254바이트·Windows 보조 ZIP22,615바이트 게시 확인. 사용자 Chrome에 실제 적용됐다는 뜻은 아니에요.
- 공통 대비·투명 bitmap 조작 아이콘·paint guard를 dark.content.ts의 켜기/끄기/시스템 테마/재설정 수명에 연결했어요. 도메인 특례를 새로 추가하지 않았어요.
- DarkReader의 URL 이미지 자동 반전·숨김은 공통으로 막고 CSS 그라데이션 보정은 유지해요. dependency patch는 mjs/standalone js 모두 반영했어요. 기존 CSP MAIN proxy 패치도 보존했어요.
- `icon-contrast.js`는 작은 투명 PNG/WebP 조작 배경의 저대비 중립 픽셀만 로컬로 바꿔요. 컬러 픽셀·alpha는 그대로이며 opaque/큰/짙게 채운 이미지·불확실한 합성은 제외해요. CORS/페이지 CSP가 막으면 원본을 유지해요. credentials omit, 동시 요청2·URL48·응답128KiB·픽셀65536·3초 제한이에요.
- 공개 네이버 AI 이미지: 중립 픽셀507개 보정, 컬러 픽셀915개 및 모든 alpha 원본 일치. 공개 Chrome API/helper 조합에서 캡처 직접 확인: `C:/Users/REVAPT~1/AppData/Local/Temp/be-dark-icons-OW1PpO/naver-ai-dark.png`.
- 공개 로스트아크 요청 페이지: 큰 그림31개의 원본 URL·필터 유지. 가운데와 쌍브이 인물 얼굴 정상 색 캡처를 직접 확인했어요: `C:/Users/REVAPT~1/AppData/Local/Temp/be-dark-artwork-MfB2dF/event-dark-preserved.png`. 합성 그림에서 기존 엔진의 전체 반전을 재현한 뒤 원본 보존과 gradient 테마 동시 통과.
- document.open/write/close는 document listener를 제거하고 JS world를 유지해요. root 교체 시 MAIN/isolated 연결을 재구성하고 upstream proxy cleanup closure를 반환하는 명시적 adapter로 native hook 중첩을 막았어요. sync 검사도 adapter를 포함해요.
- 최종 1.2.54 설치 패키지 + 폐기 Chrome 합성 쪽지: URL/srcdoc/blank, 문서 전체 재작성 후 CSSOM 변경, 음수 iframe 본문 실제 글자 픽셀, hidden 유지, OFF 복원 모두 통과. `C:/Users/REVAPT~1/AppData/Local/Temp/be-note-dark-kt6c8L/negative-frame-dark.png`.
- 최종 strict CSP 제품 검사: inline script 위반0, CSSOM/기존탭/새로고침/iframe/시스템 테마 수명 통과. `C:/Users/REVAPT~1/AppData/Local/Temp/be-dark-csp-FkdmI5`.
- 공통 helper 최종 재검사: 10000노드 상한/자기 mutation 안정화/해제 복원, 공개 네이버 카드 면·outline, codex-resets 범례와 가시 칸 주황/청록 일치 통과. `C:/Users/REVAPT~1/AppData/Local/Temp/be-contrast-N7wfvP`.
- 전체 JS252개와 Bun 시험·타입, ZIP/eval/권한 검사 통과. 실제 로그인 쪽지 해결·사용자 Chrome 설치/페이지 갱신은 미확인이에요. 아래 담당 기록은 개별 구현 단계의 근거예요.

- 2026-11-10 성능 보완: paint guard는 시작/iframe 추가 시 후보를 최대64개 캐시하고, root/body/프레임/프레임 조상 속성 또는 iframe 추가·제거만 검사 예약해요. 무관한 gradient/sprite 스타일 변경은 CSS 읽기나 iframe 재검색 없이 무시해요. stop은 후보 캐시도 정리해요.
- 관련 최소 재검사: `node scripts/verify-dark-paint-browser.cjs` 통과. 실제 DR 동시 활성 상태에서 무관한 transform 변경20회×20ms를 iframe 있음/없음 두 상태로 계측해 iframe 검색0·rect 측정0을 확인했어요. 동적 iframe 추가/숨김과 기존 보호/복원 검사도 통과했어요. 증거 폴더 `C:/Users/REVAPT~1/AppData/Local/Temp/be-paint-guard-YvczAQ`예요. 추가 빌드는 하지 않았어요.

- **신규 paint 통합 API**: `createPaintGuard(document)` → `prepare():boolean` / `start()` / `stop()`. 이전 DarkReader disable() 완료 뒤, 다음 enable()/auto() **전에 prepare()**, dark scheme 활성 시 start(), cleanup/OFF/light 때 stop()이에요. stop은 baseline을 보존해 system dark 재진입이 가능해요.
- prepare 시 body가 없으면 안전하게 false예요. document_start에서 body 없는 상태로 시작했다면 DOMReady에 이전 테마를 disable한 뒤 prepare→enable을 한 번 다시 해야 원래 투명성을 확보해요. 문서 재작성 시에도 다시 prepare가 필요해요. 공유 진입점 연결은 총괄 소유예요.
- paint 구현 완료 파일: `src/modules/dark/paint-guard.js`, `paint-guard.d.ts`, `scripts/verify-dark-paint-browser.cjs`예요. baseline 원래 불투명/배경그림/효과가 있으면 비활성, 음수 positioned iframe이 실제 viewport에 있고 별도 ancestor stacking context/덮개/hidden이 없는 경우만 보호해요. 최대64frame·조상24단계·40ms 단일 coalesce예요.
- 최종 paint Chrome 검사 통과: 부모/자식 모두 DR 적용, 가려졌던 본문 밝은 픽셀 100개 초과 복귀, iframe z-index 불변, OFF 정확 복원, 사이트 새 inline 값 보존, 원래 불투명 html/body·iframe 없음·의도적 overlay·hidden 보호, 동적 iframe 추가/숨김 시 guard 적용/복원이에요.
- 최종 paint 직접 검수: `C:/Users/REVAPT~1/AppData/Local/Temp/be-paint-guard-nd7vt1/negative-dark-restored.png`. 같은 폴더 hidden/off 캡처와 대비했고 실제 note가 아닌 합성이에요. 제품 빌드는 수행하지 않았고 실제 note 해결은 여전히 미확인이에요.

## 긴급 새 재현 근거 — body 불투명 칠이 음수 iframe을 가림

- **공통 조건 재현 성공**: 원래 투명 body + 헤더/사이드바 + absolute iframe(z-index:-1)을 합성하면 기본 상태에서 FRAME CONTENT가 보이고 DarkReader.enable() 직후 중앙 전체가 사라지며 disable() 즉시 복귀해요. 실제 note 구조 확정은 아니에요.
- 증거 직접 확인: `C:/Users/REVAPT~1/AppData/Local/Temp/be-note-layer-4Oi6Hd/before.png`, `after.png`, `off.png`. note 사용자 화면과 같은 상단/사이드바 유지·중앙 전체 빈 형태예요.
- DOM 내용을 지우거나 iframe display를 바꾸지 않아도 발생해요. DR UA/fallback이 원래 transparent body를 불투명 배경으로 바꿔 음수 stacking child를 가리는 공통 CSS paint 조건이에요.
- 복구 실험의 한계: body만 transparent!important로 바꾸면 흰 iframe canvas가 나타나지만 **FRAME CONTENT 글자는 여전히 안 보였어요** (`transparent-guard-loaded.png`). 프레임 DOM에는 글자가 있고 computed color 검정/배경 흰색임을 확인했어요. 최초 복구 성공 표현은 이 결과로 정정해요. 단순 body 투명화로 완료 처리하면 안 돼요.
- **html과 body를 함께 원래 transparency로 보존하면 글자까지 복구 성공**: 같은 폴더 `both-transparent.png` 직접 확인했어요. 원래 둘 다 transparent인 음수 stacking iframe 조건에 한한 실험이며 실제 note 원인 확정/제품 수정 완료가 아니에요.
- 이 paint-order 재현은 `scripts/verify-dark-contrast-browser.cjs`에 독립 합성 diagnostic으로 보존했어요. 마지막 추가 후 node --check/diff --check 통과했고 실제 시각 근거는 위 직접 실행 캡처예요.
- 총괄은 별도로 about:blank document.open/write/close 후 테마 재연결 실패를 재현하고 수정 중이라고 전달했어요. 이것도 실제 note 구조 진단과 구분해요. AI PNG 대비 분석은 총괄 소유이며 담당은 임의 이미지 반전을 추가하지 않았어요.
- 총괄 제안: pre-theme에 원래 투명 body/ancestor 상태를 캡처하고, 음수 z-index의 보이는 iframe/콘텐츠가 해당 불투명 배경 뒤로 들어가는 조건에 한해 원래 transparency를 보존하는 공통 guard를 검토해요. 무조건 body 투명화/iframe z-index 변경은 피해야 해요. 담당은 공유 진입점 변경하지 않았어요.

- 기준: main `ce28075`, 앱 1.2.53에서 시작했어요. 총괄의 공유 파일 변경을 보존했어요.
- 담당 변경: `src/modules/dark/contrast.js`, `contrast.d.ts`, `test/contrast.test.js`, `site-fixes.js`, `scripts/verify-dark-contrast-browser.cjs`, 이 보고서예요.
- 공통 API: `createContrastController(document)` → `start()/update()/stop()`, 누적 `stats`예요. 총괄이 dark.content.ts 수명 연결을 맡았어요.
- 글자는 조상 배경의 alpha 합성 + sRGB 상대 휘도로 대비 4.5:1을 검사해 필요한 중립색만 밝게 해요. 작은 currentColor SVG 조작 아이콘은 3:1 기준이에요.
- 사진/영상/canvas/이미지 배경/gradient/불확실한 합성/낮은 opacity/강한 의미색/hidden/disabled/편집/메일 본문 DOM은 보존해요. 메일 도메인 전체 제외는 하지 않아요.
- 원래 border/shadow가 있고 부모와 대비가 낮은 불투명 중립 카드만 RGB +7과 얇은 outline으로 보강해요. 임의 모든 요소에 테두리를 넣지 않아요.
- 범례는 도메인 분기 없이 section/article/figure 안에서 legend modifier와 data-category 값이 대응하는 작은 단색 칸을 찾아요. 2~4개 분류색이 가까운 경우만 범례·칸을 같은 팔레트로 분리해요.
- 서로 다른 section의 같은 분류명은 분리하며 이미 구분되는 분류색은 유지해요. 날짜/개수/링크/본문은 변경하지 않아요. 구조가 불명확한 차트는 미보정이에요.
- `withTranslationColors.ignoreInlineStyle`에 `[data-bong-contrast-owned="1"]`을 추가해 DR 재변환 간섭을 막아요. 기존 사이트 보정은 보존했고 신규 도메인 특례는 없어요.
- stop은 소유 속성/marker만 복원하고 사이트가 새로 덮어쓴 inline 값은 보존해요. detached 노드는 WeakRef로 추적하고 중지 시 observer/listener/idle 작업을 정리해요.
- 성능: idle 1회 최대 180후보/약8ms 시간 예산, 한 순회 6000노드 상한, 조상 합성 24단계 상한, 증분 root queue32개, nearviewport 측정이에요. nested scroll도 capture로 갱신해요.
- 단위 9개 통과. 합성 Chrome: 어두움/밝음, alpha, 동적 DOM, 브랜드/disabled/hidden/편집/opacity 보존, stop 복원/사이트 새 값 보존, 자기 mutation 안정화, 독립 그래프 분리 통과했어요.
- 10000노드 합성: 총 방문6050(앞선 검사 누적), 최대batch180, 40~41pass 후 안정화했어요. 방문 상한 이후 무한 재순회는 없었어요.
- 공개 Chrome + 실제 Dark Reader API + helper 검사 통과: 네이버 #account bg rgb(31,33,34), outline1px; codex-resets 범례·가시 칸 rgb(239,136,80)/rgb(85,189,214) 일치예요.
- 공개 검사는 설치 확장 통합 증거가 아니라 API/helper 조합이에요. CSS/이미지는 허용된 공개 호스트만 credentials omit으로 가져오고 이미지 binary를 보존했어요.
- 직접 확인한 화면: `C:/Users/REVAPT~1/AppData/Local/Temp/be-contrast-iWhrv4/naver-dark.png`, `codex-resets-dark.png`; 같은 폴더 `synthetic-dark.png`는 합성 화면이에요.
- 네이버 AI는 다색 로고+문구가 합쳐진 background 이미지여서 이 helper는 변경하지 않아요. 총괄이 이미지 보정 모듈을 별도로 검토 중이에요.
- 중간 공개 실패는 범례 검사에서 가로 스크롤 밖 칸까지 비교한 검사 범위 오류였고 x/y 가시 범위로 수정 후 통과했어요.

## 긴급 쪽지 본문 누락

- 새 사용자 사진과 다크 OFF 즉시 목록 복귀 대조를 반영했어요. 실제 데이터 부재보다 스타일/프레임 가림을 우선하지만 원인은 아직 미확정이에요.
- 공개 `https://note.naver.com/`는 nid 로그인 페이지로 redirect되어 현재 쪽지 본체 CSS/JS/iframe URL을 확보하지 못했어요. 로그인 우회/개인 계정/프로필 접근은 하지 않았어요.
- Dark Reader defaultFallbackFactory는 색/배경/경계만 변경하며 display/visibility를 숨기지 않아요. 엔진의 display:none은 스타일 보관 container, overlay는 Chrome PDF 전용이어서 일반 note 가림 근거가 아니에요.
- MAIN proxy의 childNodes/getElementsByTagName 변경은 brilliant/vy와 baidu에서만 적용되어 note 후보에서 제외해요. styleSheets의 Array Proxy/native item brand-check 충돌은 가능한 코드 경로지만 실제 note 사용 근거는 없고 OFF 즉시복귀로 우선순위가 낮아요.
- 임의 display/visibility 강제, note전용 proxy 제외나 전역 엔진 비활성은 추가하지 않았어요. 이전 srcdoc 합성 통과를 실제 쪽지 해결로 보고하지 않아요.
- 총괄은 document.open/write 재작성과 투명 iframe 캔버스 가설을 재현 중이에요. 실제 원인 구분에는 비개인정보 중앙 iframe src/origin/크기, html/body computed색, DR style 유무/길이, 중앙 elementsFromPoint tag/id/class/bg/position/z-index가 유용해요. 쪽지 내용/ID/발신자/토큰 수집은 불필요해요.
- 미완료: 실제 쪽지 빈 화면 원인과 수정. 공유 엔진/진입점 수정·최종 확장 통합검사·버전/릴리스는 총괄 영역이에요. 이번 담당은 build/zip/commit/push/release를 실행하지 않았어요.
