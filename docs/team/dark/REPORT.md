# 공통 대비 보정과 긴급 쪽지 조사 보고

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
