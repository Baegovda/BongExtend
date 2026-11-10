# 공통 대비 보정과 긴급 쪽지 조사 보고

## root 깜빡임 통합 검증

- 최종 실제 패키지 content/worker fixture도 카드 배경1색·mutation0·OFF white 복원을 확인했어요(be-dark-stability-iGjb4C). 첫 시험 manifest exact grant는 wildcard 등록에 맞지 않아 timeout했고 시험용 서브도메인 권한으로 고쳤어요. 실제 manifest/등록은 변경하지 않았어요. 캡처에서 fixture 한글 인코딩 누락을 확인해 후속 test-only charset 선언을 보완했으며 배경 안정성 검증과 제품 본문에는 영향이 없어요.
- 1.2.59 앱d62968a CI42754068705/Release42754074042 success·양쪽 ZIP 게시 확인. 담당 idle·실제 설치와 로그인 네이버페이는 미확인.
- contrast.js styleSignature는 --darkreader-* 보조 변수만 제외하며 실제 작성자 style/class/fill/stroke 변경을 관찰해요. owned 속성 transitionend가 자기 복원/보정 루프를 만들지 않게 했어요.
- upstream+실제 공통 fixes+transition 카드에서 이전 HEAD는 idle2.5초 동안78 mutation/16pass/29색 반복, 수정 후0 mutation/0 추가pass/1색. 작성자 갱신·OFF 원복과 기존 contrast 합성/10000요소 상한 검사 통과. be-dark-stability-s06fEz(이전 실패), V9rE1h(수정)와 be-contrast-37yB5j.
- 공개 나무위키 WARDOGS 소스 helper 검수: 회색 패널3개/배경 모두 색1개, 추가 보정0회. 실시간 데이터 갱신에 따른 legitimate scan과 구분했어요. 실제 설치 환경 증거는 아니에요.

## 새 네이버페이 화살표 배정 — 담당 보완·검사 완료 / root 통합

- 담당은 contrast.js의 inspect() 내 **smallIcon 조건/중립 fill·stroke 처리 구간만** 수정했어요. scheduler/observer/run/캐시는 편집하지 않았고 총괄이 나무위키 flicker 경로를 소유해요. root의 styleSignature/ownStyles/settledEffect flicker 수정도 보존해요.
- 공개 pay history URL은 nid 로그인으로 redirect되어 실제 carousel DOM/CSS 자산을 확보하지 못했어요. 로그인/개인 프로필 접근 없이 일반 엔진 gap(명시적 검정 SVG fill/stroke, data:image 배경)이 재현되어 소형 enabled 조작아이콘 조건으로만 보완했어요. 실제 사용자 원인 확정은 아니에요.
- 구현: enabled button/a/role=button 안의40px 이하 단순 inline SVG(최대24자손)의 중립 fill/stroke만 실제 배경대비3:1에 맞춰 보완해요. saturated paint는 그대로, role=img/disabled/hidden/편집/복잡한 mask/filter/use/style/pattern/animation SVG는 기존 보호를 유지해요. defs/clip/gradient 정의는 수정하지 않아요.
- 단일 background URL 범위를 bounded data:image/svg+xml/png/webp로 넓혔어요. 같은 기존 크기/투명도/중립 픽셀 검사·정적 SVG 제한·원색/alpha 보존과 OFF 복원을 그대로 사용하며, data URI는 네트워크 relay나 새 권한이 필요 없어요.
- 소유 변경: contrast.js의 inspect smallIcon 구간, icon-contrast.js의 URL 허용 검사, 새 scripts/verify-dark-arrow-browser.cjs, REPORT. root가 편집 중인 records/write/restore/observer/scheduler는 건드리지 않았어요.
- 검증: 관련 단위5개 통과, 로컬 Chrome 합성 carousel(명시 검정 stroke + data SVG)의 보정, 기존 stroke attribute 원형 유지, 컬러/hidden/disabled 보호, 자기 pass 안정화와 OFF 원복 통과. 직접 검수 C:/Users/REVAPT~1/AppData/Local/Temp/be-dark-arrows-7jff1X/dark.png (before 포함).
- 미확인: 실제 네이버페이 로그인 carousel은 검사하지 않았어요. 사용자의 화살표가 CSS pseudo/border/mask라면 이 보완으로 해결된다고 할 수 없고 그 형태는 무작정 추가하지 않았어요. author가 fill/stroke attribute를 나중 바꾸는 경우 즉시 재검사하려면 root 소유 observer attributeFilter 추가 검토가 필요해요(현재 다음 일반 pass에서 재평가). 새도메인 패치/전체빌드/버전/배포는 하지 않았어요.

## 신규 메일 하위 DOM 테마 — root 제품 통합 완료

- root 통합: 실제 제품 fixture에서 Gmail·Naver의 본문 다크/원본 복원과 Ctrl+휠이 통과했어요. Gmail은 앱 밝음/강제 다크·색 설정 변경·모듈OFF/재ON도 확인. Naver는 sandbox의 html canvas까지 포함해 빈 여백도 맞추고 script 금지는 유지했어요. Temp/be-reader-VFhhIz, be-naver-mail-T3z4RI 캡처 직접 검수예요.
- root가 upstream API import의 Chrome 메시지 shim을 color-only 사용 직후 복원해 네이버 메일 설정 Promise 통신을 보존했어요. 새 mapper/register=false와 전역 DarkReader.enable 미호출을 유지해요. 전체 JS265+Bun+타입 통과.

- createMailThemeController(root, {background,foreground,border}) → update(enabled, theme), stop(). mapper는 (rgbaArray, theme)→CSS 색 문자열이며 upstream 실제 함수는 root가 주입해요. 외부 document/전체 checker에는 테마를 켜지 않아요.
- 각 theme 세션 최대6000요소, mutation queue32개, frame당 최대120요소/약8ms. **초기 bounded 사전 순회에서6000초과면 한 요소도 테마하지 않고 본문 전체 원본 유지**예요. 뒤늦게 거대 본문이 도착해 한도/queue 상한을 넘으면 소유 변경을 전부 복원하고 멈춰요. stats.limitHit=true로 표시해요. stop은 observer/예약작업/소유 inline 속성만 정리하고 원래 bgcolor/font color 속성은 전혀 편집하지 않아요.
- 기준08c92f4/1.2.57에서 담당 변경: src/modules/dark/mail-theme.js/.d.ts, test/mail-theme.test.js, scripts/verify-mail-theme-browser.cjs, REPORT. 기존 엔진/메일 UI/권한/버전/패치/빌드 파일은 수정하지 않았어요.
- root/자손의 computed 색을 주입 upstream mapper로 변환해요. 투명 하위 배경은 그대로, 투명 root에는 scoped dark canvas를 제공해요. rgba 색과 표시 중인 border, URL없는 rgb/rgba CSS gradient stop만 변환하고 이미지URL/filter/구조/이벤트/본문은 그대로 둬요.
- hidden/inert/disabled/editable/이미지/SVG/iframe 등의 하위는 제외해요. currentColor SVG·disabled·editor가 들어 있는 조상은 inherited color를 바꾸지 않아 원래 그림/편집 색을 지켜요. 그 조상에 직접 달린 raw text는 보수적으로 미보정일 수 있어요. 일반 자식 p/font/link의 글자는 각각 변환돼요.
- 원래 inline value/important는 소유 값이 남아 있는 속성만 복원해요. 사이트가 새 inline 값을 쓰면 그 값을 보존해요. 기존 bgcolor/font color 속성은 수정하지 않으며 CSSOM 직렬화 공백은 달라질 수 있지만 값/우선순위는 복원돼요.
- Node happy-dom 주입 mapper2개 통과: scope 밖 UI/legacy attrs/hidden/editor/나중 번역문/자기 observer 안정화/stop·사이트 새 inline 보존. 실제 Chrome은 DarkReader named export3개를 직접 주입해 링크·파란 버튼·밝은/기존 어두운 카드·gradient·SVG currentColor/이미지/hidden/editor·OFF/동적본문을 검증했어요. 전체 문서 DarkReader.enable은 호출하지 않았어요.
- 거대 메일 Chrome 검사: 처음10000요소는 root 포함 한 부분도 테마되지 않고 원래 white/#111 유지, small→late10000요소 전환도 전체 원본 복원 통과. 초기 제한 확인 누적 visited13/writes17(앞선 작은 본문), passes54/maxBatch120/limitHittrue, 이후 pass 증가 없이 안정됐어요.
- 직접 시각 확인: C:/Users/REVAPT~1/AppData/Local/Temp/be-mail-theme-b12fBI/dark.png에서 본문만 어두워지고 파란 링크/버튼·그림 원색·밝은 편집 영역 유지 확인. 최종 회귀 캡처는 be-mail-theme-fu2GPT/before.png/dark.png/restored.png예요. 모두 합성 메일/소스 helper이며 실제 계정이나 제품 통합검사라고 주장하지 않아요.
- 미검증/한계: 실제 Gmail/Naver 메일 DOM과 발신자 CSS/pseudo-element/닫힌 shadow DOM/중첩iframe 내부는 검증하지 않았고 처리하지 않아요. 모던 oklch/color()/named gradient stop은 computed RGB로 나오지 않으면 미보정이에요. 사진 위에 인쇄된 글자는 수정하지 않아요. root가 자동/다크/원본 선택·모듈OFF 정책·통합 빌드/릴리스를 소유해요. 담당 추가 build/전체test/커밋/푸시 없이 종료해요.

## 2026-11-10 Malltail 최종 담당 보고 — root 통합 완료

- root 최종 패키지 검사: scripts/verify-dark-image-relay-browser.cjs에서 실제 content→CORS 실패→권한 검증 worker→보정을 확인했어요. 중립1076픽셀 변화/브랜드0·alpha0 차이, 사진 보존, 허용하지 않은 자원·다크 OFF 거절, OFF 스타일 복원 통과. Temp/be-image-relay-u7mEq7/dark.png/off.png 직접 확인이에요. 공개 사이트의 완전한 테마 재현 증거와는 구분해요.
- root 최종 보호: mask 내부뿐 아니라 mask를 포함한 조상의 paint도 상속 변경하지 않아요. 로컬 mask 검사 두 형태(명시 paint, root fill을 상속한 mask) 모두 changed512/alpha0/brand0/defs 보존 통과. 최종 전체 JS262개+Bun+타입/ZIP/eval/권한 검사 통과예요.

- **마지막 mask/clip 회귀 완료**: visible paint를 바꿀 때 defs/mask/clipPath/pattern/linearGradient/radialGradient 내부는 제외해요. 새 로컬 `scripts/verify-dark-svg-mask-browser.cjs` 통과: 보이는 중립512픽셀만 변화, mask alpha 차이0, 컬러 차이0, defs XML 완전일치, OFF marker 복원. CSS/default fill처럼 판별 불가능한 paint는 그대로 둬요.
- **실제 relay 경로 추가 확인**: 최신 controller와 dark.content.ts의 동일 fetch hook을 disposable extension의 시험 파일로 주입해 direct CORS 실패→실제 root backend port→SVG 보정→stop 복원 통과했어요. 이 진단은 공개 로고에 임시 어두운 backdrop을 준 조건이며 페이지 전체 제품 테마 성공으로 표현하지 않아요. be-malltail-product-OEwj41에 before/dark/off가 있어요.
- root 최종 패키지 회귀도 통과했다고 전달받았어요: verify-dark-image-relay-browser.cjs에서 실제 content→relay→SVG/권한거절/다크OFF거절/원본사진/복원 확인, 중립1076픽셀 변화·컬러/alpha차이0. 증거 be-image-relay-u7mEq7/dark.png/off.png. 해당 최종 제품 검사는 중복 실행하지 않았어요.
- 공개 CDN source-helper는 passing 세션에서7개/브랜드671픽셀·alpha 원형보존을 확인했으나 마지막 반복 중 일부는15초 보정조건 대기 만료가 발생했어요(원인 미확정, 임의 해결 주장하지 않음). mask 경계 검사는 네트워크와 분리한 위 로컬 시험으로 확정했어요. root의 통제된 최종 제품 회귀와 공개 사이트의 안정성 범위를 구분해요.
- 담당 최종 소유 파일에 scripts/verify-dark-svg-mask-browser.cjs를 추가했어요. 사진 빈칸은 여전히 미재현/사용자 OFF 대조 대기이며 강제 보정은 없어요. 추가 빌드/전체시험/푸시/릴리스 없이 이번 배정을 종료해요.

- 변경 파일: icon-contrast.js/.d.ts, dark.content.ts(fetchImage 연결), 신규 scripts/verify-malltail-dark-browser.cjs 및 verify-malltail-icon-browser.cjs, REPORT예요. proxy/권한/버전/메일 파일은 수정하지 않았어요.
- 공통 SVG 지원: 작은 투명 조작/홈 링크 및 입력창 옆 단순 glyph만 기존 픽셀 분류 상한으로 검사하고, 정적인 SVG의 명시적 중립 fill/stroke만 밝게 해요. geometry/clipPath/alpha/컬러 paint는 원형 보존해요. 새 사이트 분기는 없어요.
- Chromium createImageBitmap(SVG Blob) 실패를 확인해 Image.decode 경로를 사용해요. 처음 PNG 재인코딩 시험에서 SVG antialias/브랜드 차이를 발견해 폐기했고, SVG의 원래 벡터를 유지하는 방식으로 수정했어요. 최종 실제 로고 검사: 중립1003픽셀 변화, 컬러671픽셀 차이0, alpha 차이0이에요.
- SVG 외부참조/DOCTYPE/ENTITY/스크립트/이미지/스타일/애니메이션/필터는 거절하고 정수/px 명시 크기512×256/65536픽셀 상한을 decode 전에 검사해요. 원래 PNG/WebP 상한도 유지해요. CSP data/blob 허용이 없거나 복잡한 SVG면 원본을 그대로 둬요.
- dark.content.ts의 fetchDarkImage는 direct omit/redirect:error fetch를 먼저 쓰고 CORS 등 예외만 전용 bongextend-dark-image port로 대체해요. AbortSignal/3초/port disconnect cleanup과 응답 MIME/base64/128KiB 재검사를 넣었어요. backend의 실제 origin 권한/설정 검증은 root 구현을 사용해요.
- 공개 source-helper 검사 통과: 로고/돋보기/종/계정/장바구니 등7개 보정, alpha/브랜드 원형보존, OFF marker/style 복원, 위험 SVG4종 거절. 사진 URL/naturalWidth400/filter none/opacity1 보존. 단위2개 통과·diff check 통과예요.
- 실제 .output 확장 port 경로도 1500px/3600px에서 응답 ok/type image/svg+xml/9215바이트 확인했어요. 다만 최종 source의 벡터 보존/입력 glyph 변경 이후 root 최종 재빌드 및 제품자동보정 검사는 root가 이어가야 해요. 담당은 build를 하지 않았어요.
- 직접 검수한 source-helper 화면: C:/Users/REVAPT~1/AppData/Local/Temp/be-malltail-icons-fxKLnt/source-helpers-dark.png (before/off 포함). 제품형 3600×1950 비교: be-malltail-product-218DHv/before.png/dark.png/off.png.
- **상품 빈칸은 미재현**: 1500px 및 마지막 독립3600×1950 before/ON/OFF에서 HOTDEAL/BEST 이미지가 모두 보였고 loaded true·naturalWidth400/553/1020·원본URL 유지였어요. 제품 경로는 외부CSS 일부가 CORS로 미적용되어 header가 흰색인 차이가 있어 사용자 전체 조건을 재현했다고 할 수 없어요. 사진을 억지 표시/반전하는 패치는 넣지 않았어요. 사용자 OFF 대조 답변은 root가 대기 중이에요.
- 보고 종료: SVG 공통 소스 보완·relay 연결과 관련 근거를 보존했어요. 실제 사용자 사진빈칸 해결/모든 상태 지원/배포 완료를 주장하지 않아요. root가 최종 빌드/통합/릴리스를 소유해요.

### 초기 조사 기록 (위 최종 결과 우선)

- 기준13661f0/1.2.56, 공개 post.malltail.com에서 header 검은 SVG 로고·조작아이콘 저대비는 재현했어요. 원본 SVG URL은 header_logo2025_D.svg, header_user_icon1_D.svg 등 cdn.malltail.com/goods_img/contents/index 아래예요.
- 현재 icon controller는 MIME png/webp만 허용해 SVG를 건너뛰고, content-script fetch는 공개 CDN SVG에 CORS Failed to fetch가 나요. 단순 모든 이미지반전은 안전하지 않아요. **총괄 공유 제안**: 기존 선택한 사이트/자원 호스트 권한을 확인하는 bounded 이미지 relay(omit credentials, redirect:error, MIME png/webp/svg+xml,128KiB 상한)를 icon controller fetchImage hook으로 연결해야 실제 cross-origin SVG 픽셀 분류가 가능해요. 담당은 background/권한을 직접 바꾸지 않아요.
- HOTDEAL 사진 빈칸은 아직 재현 못했어요. 비로그인 공개 before/DR API/full external CSS/OFF에서 이미지 naturalWidth400/553/1020·opacity1·filter none·blend normal·원본URL 모두 유지하고 사진이 보여요. 실제 .output extension 임시프로필에서도 로딩/이미지는 유지됐어요(그 경로는 일부 외부CSS 미적용으로 화면 전체테마가 사용자와 달라 완전 대조가 아니에요).
- 증거 직접 확인: C:/Users/REVAPT~1/AppData/Local/Temp/be-malltail-8cVCsu/tall-dark.png/tall-off.png 및 be-malltail-product-2CByex/before.png/dark.png/off.png. 사진 가림 원인은 확정하지 않았어요. 사진에 visibility/filter/표시 강제 보정은 넣지 않아요.

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
