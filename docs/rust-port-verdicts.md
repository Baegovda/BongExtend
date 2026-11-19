# Rust 이식 파일별 판정표

사용자 목표 "Rust로 옮길 부분이 없어질 때까지"에 맞춰 `src` 의 모든 소스 파일(시험·자동 생성·타입 설명 `.d.ts` 제외)을 하나씩 판정했어요. 2026-11-20, bun 1.3.14(일부 실제 크롬 157).

- 옮기는 기준(rust-first): 결과가 똑같고 느려지지 않을 때만. Rust 다리 최소 비용 1.0~1.6µs, 실제 데이터를 넘기면 16~20µs(다운로드 규칙을 옮겼다가 4.6µs → 16~20µs로 느려져 되돌림). 그래서 한 번 처리가 수십 µs 이상이고, 넘길 데이터가 계산보다 작고, 자바스크립트와 똑같은 결과를 보장할 수 있는 것만 옮겨요.
- "브라우저 기능" 열: 파일 안에서 DOM·크롬 API·네트워크·저장소·타이머·Vue 반응형을 쓰는 횟수(자동 집계). 이것들은 브라우저 안에서만 돼서 Rust로 옮길 수 없어요.
- "잰 시간" 열: 파일이 내보내는 순수 함수를 모두 실제로 불러서 잰 한 번 처리 시간 중 가장 긴 값(자동 측정; 네트워크·저장소·크롬을 쓰는 함수는 부르지 않고 "연결"로 셈). 큰 입력이 들어올 수 있는 함수는 큰 입력으로 따로 재서 근거 칸에 적었어요.
- "Rust 하한 증명" 열: 함수마다 같은 입력을 Rust 엔진에 넘기고(Rust 는 계산 없이 바로 답) 같은 크기의 출력을 받아 되살리는 시간만 쟀어요. 이것이 어떤 Rust 구현이라도 피할 수 없는 최소 비용이라, 이 값이 JS 처리 시간보다 크면 "반드시 느림"이에요. 순수 함수 364개 중 329개가 그랬고, 나머지 35개는 실제 입력으로 다시 재거나(대부분 하한이 더 커짐) 실제로 Rust 로 만들어 골든 비교·크롬 시간으로 판정했어요(아래 실험 기록과 근거 칸).
- 엔진 준비 비용(크롬): 배포 엔진(234KB) 0.9ms, 주소 해석 url 부품까지 넣은 엔진(520KB) 2.1ms. 서비스 워커는 쉬면 꺼졌다가 다시 켜지며 그때마다 준비해요. 엔진이 없는 화면(콘텐츠 스크립트·다운로드 화면 등)에서 쓰려면 이 비용이 더해져요.

## 실제 이식 실험 기록(2026-11-20, 크롬 157)

Rust 코드는 `native/core-wasm/src/extra.rs`(cargo 기능 `experiments`, 배포 엔진에는 안 들어감; `cargo test --features experiments`, `scripts/build-core-wasm.ps1 -Experiments`)에 남겨 두었어요.

| 함수 | 결과가 같은지(골든) | 크롬 시간 JS → Rust | 결정 |
|---|---|---|---|
| 설치 순서 정렬 `installPlan.ts` orderFiles | 두 글자 조합 9,025개·무작위 경로 4,000개·배포 파일 521개 다른 자리 0 | 0.647 → 0.143ms | **Rust로 옮김** |
| 프로필 사진 찾기 `gmail/actions.js` profileFromHtml | 무작위 페이지 2만 개 다름 0 | 메일 모름 1만 자 0.052 → 0.024ms, 200만 자 11.3 → 4.7ms / 메일 앎 200만 자 1.9 → 4.5ms | **메일 모름·1만 자 이상만 Rust로 옮김** |
| 숫자 표기 `formatMoney`·`formatPrice`·`formatCount`·`formatViewers` | 25만 개 다름 0(처음엔 443개 달랐음: Rust 의 가장 짧은 십진 표현이 가운데 값에서 JS 와 달라 JS 글자를 받도록 고침) | 11µs → 2.5µs, 그런데 Intl 표기기 재사용 JS 0.23µs | JS 표기기 재사용으로 바꿈(가장 빠름) |
| 번역 목표 언어 `isAlreadyTargetLanguage` | 모든 유니코드 글자 667만 건 중 177건 다름(유니코드 판 차이) | 보통 1.0 → 5.0µs, 4,000자 16 → 35µs | JS 유지(다르고 느림) |
| 번역 훑기 순서 `planWiperOrder` | 3,000개 다름 0 | 300상자 30 → 239µs | JS 유지(7.8배 느림) |
| 여러 주소 펼치기 `expandBatchUrls` | 5,000개 다름 0(ASCII 아닌 글자·15자리 넘는 수는 예전 길) | 100줄 142 → 96µs | JS 유지(url 부품으로 엔진 준비 +1.2ms, 다운로드 화면엔 엔진이 없음) |
| 사진 원본 주소 `originalImageUrl`·`originalProductImage` | 3만 3천 건 다름 0 | 3.16 → 2.50µs / 1.93 → 2.23µs | JS 유지(누를 때 0.66µs 아끼려고 엔진 준비 +1.2ms) |
| zip 풀기 `zip.ts` extractAll(1차) | 무작위·망가진 zip 1,800개 다름 0 | 189 → 46ms | Rust로 옮김(1.2.165~) |

## 실행 프로파일 확인(안쪽 함수까지, 2026-11-20)

표의 "잰 시간"·"하한 증명"은 밖으로 내보낸 함수만 잴 수 있어요. 그래서 안쪽 함수까지 빠짐없이 보려고 실제 확장을 띄우는 검증 스크립트 30개(번역·메일·네이버 메일·인증번호·치지직·다크 13종·다운로드·환율·팝업·업데이트·쇼핑·디시; 로컬·가짜 페이지만)를 CPU 프로파일러(0.1ms 간격, 측정 도구 때문에 타이밍이 흔들린 3개는 1ms)를 붙여 돌렸어요. 페이지·콘텐츠 스크립트뿐 아니라 백그라운드 서비스 워커에도 크롬 전체 연결(CDP Target.attachToTarget)로 붙었어요(워커가 꺼질 수 있어 2초마다 끊어 저장). 30개 모두 끝까지 통과한 상태로 잡혔어요(낡았던 검증 스크립트 8개는 따로 고쳤어요). 함수 이름을 보려고 측정 때만 `BONG_NO_MINIFY=1` 로 묶었어요(배포 묶음은 그대로).

- 최종(30개 장면, 프로파일 154개 = 페이지 87 + 서비스 워커 67): 확장 코드 시간 3,890ms = 가져온 외부 코드 1,902ms(49%), 브라우저 기능 1,016ms(26%), 출처를 못 이은 묶음 초기화 590ms(15%), 브라우저 기능을 직접 안 쓰는 함수 381ms(10%, 131개). 서비스 워커 안 확장 코드 1,213ms 는 대부분 외부 메일 엔진(크롬 번역 문구 API chrome.i18n, Intl 날짜, WebCrypto, 큰 스크립트 첫 실행)이에요.
- 131개: 하한 증명 42개, 화면 요소·스타일 객체 42개, Intl 2개(moneyFormat, formatDate), 나머지 47개는 하나씩 확인(네트워크·크롬·파일 시스템·IndexedDB·WebCrypto 연결, 또는 실제 입력 하한이 더 큼: normalizeVersion 0.07µs < 1.31µs, parseScan 0.49µs < 33µs, normalizeDarkSettings 0.07µs < 9µs 등). 그중 업데이트 화면의 `collectReachable` 만 엔진이 이미 있는 화면이고 하한(0.053ms)이 JS(0.31ms)보다 작아서 실제로 Rust 로 옮겼어요(위 installPlan.ts 줄).
- 화면 요소·스타일 객체를 받는 함수도 하한을 쟀어요(크롬 157, 실제 getComputedStyle 객체): Rust 로 옮기면 자바스크립트가 같은 스타일 값을 먼저 읽어 넘겨야 해서, 그 "읽어서 넘기기만"이 하한이에요. textLineMode(lineClampOf·overflowClips·pixelLength 포함) JS 1.09µs < 하한 6.44µs, stable(hairline-contrast) 1.21µs < 6.49µs, isInlineBox 0.09µs < 2.50µs → 모두 반드시 느림. 나머지 화면 함수(step·setProgress·refreshJobs 등)는 스타일·위치를 읽을 뿐 아니라 화면에 직접 써서(DOM 쓰기) Rust 쪽에서 할 수 있는 일이 없어요.

아래는 1차(서비스 워커 없이) 기록이에요.

- 소스 전체 함수: 4,001개(안쪽 함수 2,622개). 브라우저 기능을 직접 쓰는 함수 1,316개, 안 쓰는 함수 2,685개(@babel/parser 로 셈).
- 30개 장면에서 확장 코드가 쓴 시간 합계 1,255ms: 가져온 외부 코드(Checker Plus 메일 엔진 등) 413ms(33%), 브라우저 기능을 쓰는 함수 435ms(35%), 출처를 못 이은 묶음 코드(Vue·라이브러리 초기화 등) 250ms(20%), 브라우저 기능을 직접 안 쓰는 함수 156ms(12%, 81개).
- 그 81개: 하한 증명으로 반드시 느림 26개(예: textLineMode 15.9ms, currencyName 13.1ms), 실제로는 화면 요소·스타일 객체를 받아 읽는 함수 35개(예: step 10.2ms, lineClampOf 8.5ms, stable 5.5ms), Intl 표기기 1개(moneyFormat), 나머지 19개는 하나씩 봤어요: availableCurrencyCodes(실제 입력 하한 88µs > JS 59µs), formatMoney(Intl), readableColor·textPaint·colorIo(이미 Rust 또는 그 다리), beginWiper·normalizeRect(화면 위치), syncRightClick·inject·flush·getStatus·disconnect·listener·set(크롬 기능·비동기 연결), normalizeTheme·normalizeHosts·publicHost(설정 읽을 때 한 번, 30개 장면 합쳐 0.4~1.6ms), 치지직 wide.js 시작 코드(정규식 만들기).
- 결론: 실제 실행에서 시간을 쓴 우리 함수는 안쪽 함수까지 모두 위 판정 중 하나에 들어가고, 새로 옮길 후보는 나오지 않았어요. 순수 계산이 다 합쳐 30개 장면에 156ms(장면당 약 5ms)라서, 이를 전부 없애도 엔진이 없는 화면에서 엔진을 준비하는 비용(0.9ms)과 주고받는 비용을 넘기 어려워요.
- 1차의 한계(서비스 워커 없음, 낡은 스크립트 8개가 중간에 끝남)는 위 최종 측정에서 메웠어요.

| 파일 | 줄 | 브라우저 기능 | 잰 시간 | Rust 하한 증명 | 판정 | 근거 |
|---|---:|---:|---|---|---|---|
| `src/@types/components.ts` | 68 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/@types/core.ts` | 35 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/@types/internal.modules.ts` | 19 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/@types/memo.ts` | 14 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/@types/module.ts` | 131 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/@types/post.ts` | 40 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/@types/user.ts` | 1 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/@types/utils.ts` | 10 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/components/countdown.vue` | 38 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/components/dccon.vue` | 365 | 10 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 10회 |
| `src/components/loader.vue` | 126 | 1 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 1회 |
| `src/components/previewButton.vue` | 214 | 11 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 11회 |
| `src/components/timestamp.vue` | 39 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/components/toast.vue` | 271 | 5 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 5회 |
| `src/components/user.vue` | 171 | 5 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 5회 |
| `src/composables/useRelativeTime.ts` | 76 | 7 | 연결 함수 1개 | - | 자바스크립트 | "3분 전" 같은 시각 표시(Vue 반응형 + Date). 화면 갱신 때 한 번, 날짜 계산 몇 줄 |
| `src/core/block.ts` | 336 | 4 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 사용자가 쓴 자바스크립트 정규식(RegExp) → Rust로 같은 뜻 보장 불가. 포함 비교 규칙 200개 3.7µs |
| `src/core/eventbus.ts` | 28 | 2 | - | - | 자바스크립트 | 함수 목록에 이벤트를 전하는 28줄 연결 코드(계산 없음) |
| `src/core/filtering.ts` | 213 | 14 | - | - | 자바스크립트 | 디시 글 목록 걸러내기 틀(MutationObserver·`matches`·`closest` 14회). 각 글 판단은 `block.ts` |
| `src/core/memo.ts` | 124 | 3 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 사용자 메모 저장·읽기(저장소). 값 검사는 필드 두 개 typeof |
| `src/core/modules.ts` | 227 | 14 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 기능 켜고 끄기·설정 전달(메시지·저장소 14회). 계산 없음 |
| `src/core/popup/pointerDrag.ts` | 138 | 0 | 함수 4개, 최대 0.53µs (`nearestSlot`) | 4/4개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.53µs) |
| `src/core/popup/tabOrder.ts` | 32 | 0 | 함수 2개, 최대 0.63µs (`moveItem`) | 2/2개 반드시 느림 | 자바스크립트 | `pickStartTab` 0.07µs, `normalizeTabOrder` 0.26µs |
| `src/core/semver.ts` | 90 | 0 | 함수 2개, 최대 0.41µs (`compareVersions`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.41µs) |
| `src/core/settings.ts` | 68 | 6 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 저장소 읽기·쓰기 + 값 정리 switch 한 번 |
| `src/core/update/autoInstall.ts` | 26 | 0 | 함수 1개, 최대 0.08µs (`shouldLaunchUpdater`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.08µs) |
| `src/core/update/availability.ts` | 18 | 0 | 함수 2개, 최대 0.33µs (`isNewerVersion`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.33µs) |
| `src/core/update/installPlan.ts` | 296 | 0 | 함수 9개, 최대 0.31µs (`normalizeAssetPath`) | 9/9개 반드시 느림 | Rust로 옮김 | 설치 순서 정렬 `orderFiles` 를 Rust(`extra.rs` order_keys)로: localeCompare 의 ICU 기본 규칙을 출력 가능한 ASCII 에 한해 옮김(두 글자 조합 9,025개·무작위 경로·배포 파일 모두 같음, 다른 글자는 예전 길). 크롬 0.647 → 0.143ms(4.5배). 우선 파일 찾기(`collectReachable` 의 참조 글자 잡기, 세 정규식)도 Rust(`refs.rs`, 파일 바이트에서 바로)로: 무작위 글 9천 개·배포 파일 162개(크롬 V8 정규식과도) 다름 0, 크롬 0.16 → 0.13~0.16ms(SIMD 켠 엔진; 끈 엔진에선 0.20ms 로 느려서 SIMD 와 함께만 남김). 경로 계산(`resolveSpecifier` 등)은 0.3µs 대라 JS |
| `src/core/update/manifestRefs.ts` | 90 | 0 | 함수 1개, 최대 0.34µs (`manifestReferencedFiles`) | 1/1개 반드시 느림 | 자바스크립트 | 배포 검사 전용(bun·CI), 사용자 브라우저에서 안 돌아요 |
| `src/core/update/noEval.ts` | 56 | 0 | 함수 2개, 최대 6.29µs (`findUnsafeEvalInFiles`) | 0/2개 반드시 느림, 나머지(findUnsafeEvalInFiles, unsafeEvalHits)는 근거 칸 | 자바스크립트 | `findUnsafeEvalInFiles`·`unsafeEvalHits` 는 배포 검사 전용(bun·CI, 배포 한 번에 7.7ms), 사용자 브라우저에서 안 돌아요. Rust 로 만든 결과를 검사하는 독립 검사기라 같은 엔진에 넣지 않아요 |
| `src/core/update/progress.ts` | 94 | 0 | 함수 3개, 최대 0.14µs (`formatBytes`) | 2/2개 반드시 느림 | 자바스크립트 | `computeProgress` 0.16µs, 나머지 다운로드 스트림 읽기 |
| `src/core/update/release.ts` | 112 | 1 | 함수 3개, 최대 0.71µs (`isBongExtendManifest`) | 3/3개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.71µs), 나머지는 브라우저 기능 1회 |
| `src/core/update/timeout.ts` | 37 | 1 | 함수 2개, 최대 0.04µs (`describeUpdateError`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.04µs), 나머지는 브라우저 기능 1회 |
| `src/core/update/types.ts` | 15 | 0 | - | - | 자바스크립트 | `fileKey` 0.06µs |
| `src/core/update/zip.ts` | 173 | 0 | 함수 1개, 최대 0.21µs (`safePath`) | 1/1개 반드시 느림 | Rust로 옮김 | 압축 풀기 `extractAll` 을 Rust(`zip.rs`)로: 실제 크롬 189ms → 46ms, 바이트까지 같음. 남은 `listEntries` 55.7µs·`safePath` 는 시험·배포 검사용 |
| `src/core/updateCheck.ts` | 449 | 55 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 새 판 확인(GitHub 네트워크·알림·저장소 55회). 판 비교는 `semver.ts`(0.39µs), 릴리스 글 줄이기는 업데이트 확인 때 한 번 |
| `src/entrypoints/background.ts` | 867 | 124 | - | - | 자바스크립트 | 서비스 워커 시작점(크롬 API 124회). 각 기능 모듈을 이어 붙여요 |
| `src/entrypoints/content/composables/useDcconPopup.ts` | 83 | 4 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 4회 |
| `src/entrypoints/content/composables/useMeDetection.ts` | 79 | 9 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 9회 |
| `src/entrypoints/content/index.ts` | 58 | 2 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 2회 |
| `src/entrypoints/content/modules/block/index.ts` | 362 | 44 | - | - | 자바스크립트 | 디시 글마다 차단 검사 붙이기(DOM 44회). 판단은 `core/block.ts`(사용자 정규식이라 JS) |
| `src/entrypoints/content/modules/block/request.ts` | 132 | 1 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 1회 |
| `src/entrypoints/content/modules/fonts.ts` | 90 | 18 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 18회 |
| `src/entrypoints/content/modules/imagesearch.ts` | 44 | 4 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 4회 |
| `src/entrypoints/content/modules/layout.ts` | 213 | 31 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 31회 |
| `src/entrypoints/content/modules/manage/helpers.ts` | 64 | 6 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 6회 |
| `src/entrypoints/content/modules/manage/index.ts` | 362 | 36 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 36회 |
| `src/entrypoints/content/modules/preview/bodyFrame.ts` | 232 | 14 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 14회 |
| `src/entrypoints/content/modules/preview/cache.ts` | 52 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/content/modules/preview/commentFrame.ts` | 434 | 13 | - | - | 자바스크립트 | 댓글 미리보기 화면(Vue·DOMParser). 반복은 댓글 목록을 화면에 그리는 일 |
| `src/entrypoints/content/modules/preview/components/comment/comment.vue` | 253 | 7 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 7회 |
| `src/entrypoints/content/modules/preview/components/comment/write_comment.vue` | 434 | 22 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 22회 |
| `src/entrypoints/content/modules/preview/components/frame/frame.vue` | 349 | 14 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 14회 |
| `src/entrypoints/content/modules/preview/components/frame/frameComponent.vue` | 284 | 27 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 27회 |
| `src/entrypoints/content/modules/preview/components/frame/frameError.vue` | 82 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/content/modules/preview/components/frame/frameVotes.vue` | 66 | 3 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 3회 |
| `src/entrypoints/content/modules/preview/components/frame/scroll.vue` | 59 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/content/modules/preview/components/popup/adminPanel.vue` | 180 | 17 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 17회 |
| `src/entrypoints/content/modules/preview/components/popup/blockPopup.vue` | 98 | 6 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 6회 |
| `src/entrypoints/content/modules/preview/components/popup/captchaPopup.vue` | 39 | 8 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 8회 |
| `src/entrypoints/content/modules/preview/controller.ts` | 593 | 55 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 55회 |
| `src/entrypoints/content/modules/preview/frame.ts` | 59 | 4 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 4회 |
| `src/entrypoints/content/modules/preview/getRelevantData.ts` | 33 | 4 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 4회 |
| `src/entrypoints/content/modules/preview/index.ts` | 253 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/content/modules/preview/miniPreview.ts` | 169 | 38 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 38회 |
| `src/entrypoints/content/modules/preview/panel.ts` | 145 | 3 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 3회 |
| `src/entrypoints/content/modules/preview/postParser.ts` | 71 | 35 | - | - | 자바스크립트 | 디시 글 미리보기 읽기 = 브라우저 `DOMParser` + `querySelector` 30여 번(HTML 해석은 DOM 이 필요) |
| `src/entrypoints/content/modules/preview/previewFrame.ts` | 210 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/content/modules/preview/request.ts` | 267 | 5 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 5회 |
| `src/entrypoints/content/modules/preview/scrollDetection.ts` | 109 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/content/modules/refresh/controller.ts` | 313 | 56 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 56회 |
| `src/entrypoints/content/modules/refresh/index.ts` | 88 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/content/modules/refresh/load.ts` | 207 | 37 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 37회 |
| `src/entrypoints/content/modules/stealth.ts` | 104 | 34 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 34회 |
| `src/entrypoints/content/modules/userinfo.ts` | 294 | 21 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 21회 |
| `src/entrypoints/content/modules/write.ts` | 96 | 10 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 10회 |
| `src/entrypoints/dark.content.ts` | 286 | 46 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 46회 |
| `src/entrypoints/dark-proxy.content.ts` | 40 | 11 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 11회 |
| `src/entrypoints/dc/App.vue` | 139 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/dc/components/BlockDialog.vue` | 82 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/dc/components/BlockListItem.vue` | 168 | 3 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 3회 |
| `src/entrypoints/dc/components/bubble.vue` | 135 | 6 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 6회 |
| `src/entrypoints/dc/components/checkbox.vue` | 137 | 6 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 6회 |
| `src/entrypoints/dc/components/icons.ts` | 48 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/dc/components/module.vue` | 156 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/dc/components/options.vue` | 115 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/dc/components/PopupResizeHandle.vue` | 46 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/dc/components/range.vue` | 165 | 4 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 4회 |
| `src/entrypoints/dc/components/refresherInput.vue` | 98 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/dc/components/settingControl.vue` | 75 | 3 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 3회 |
| `src/entrypoints/dc/components/settingItem.vue` | 35 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/dc/components/settingsModule.vue` | 48 | 3 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 3회 |
| `src/entrypoints/dc/composables/popupTabs.ts` | 17 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/dc/composables/useBlocks.ts` | 190 | 12 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 12회 |
| `src/entrypoints/dc/composables/useData.ts` | 147 | 22 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 22회 |
| `src/entrypoints/dc/composables/useMemos.ts` | 101 | 6 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 6회 |
| `src/entrypoints/dc/composables/usePopupResize.ts` | 50 | 14 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 14회 |
| `src/entrypoints/dc/composables/usePopupTab.ts` | 23 | 2 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 2회 |
| `src/entrypoints/dc/composables/useSettings.ts` | 245 | 30 | - | - | 자바스크립트 | 디시 설정 화면 상태(Vue 반응형·저장소) |
| `src/entrypoints/dc/main.ts` | 7 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/dc/tabs/AdvancedTab.vue` | 49 | 1 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 1회 |
| `src/entrypoints/dc/tabs/BlockTab.vue` | 512 | 5 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 5회 |
| `src/entrypoints/dc/tabs/DataTab.vue` | 41 | 3 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 3회 |
| `src/entrypoints/dc/tabs/GeneralTab.vue` | 35 | 1 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 1회 |
| `src/entrypoints/dc/tabs/MemoTab.vue` | 69 | 2 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 2회 |
| `src/entrypoints/dc/tabs/ModuleTab.vue` | 70 | 1 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 1회 |
| `src/entrypoints/dc/utils/io.ts` | 89 | 1 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 1회 |
| `src/entrypoints/dc-options/App.vue` | 161 | 1 | - | - | 자바스크립트 | 화면 부품(Vue 템플릿·반응형), 브라우저 기능 1회 |
| `src/entrypoints/dc-options/main.ts` | 6 | 0 | - | - | 자바스크립트 | 진입점: 모듈을 이어 붙이기만(계산 없음) |
| `src/entrypoints/downloads/main.ts` | 354 | 111 | - | - | 자바스크립트 | 다운로드 화면(DOM 111회). 규칙·이름 계산은 `downloads/settings.js`(최대 91µs, 누를 때 한 번) |
| `src/entrypoints/gmail.content.ts` | 33 | 8 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 8회 |
| `src/entrypoints/grecaptcha.content.ts` | 21 | 3 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 3회 |
| `src/entrypoints/image-paste.content.ts` | 49 | 12 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 12회 |
| `src/entrypoints/image-toolbar.content.ts` | 283 | 89 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 89회 |
| `src/entrypoints/image-viewer/main.ts` | 251 | 70 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 70회 |
| `src/entrypoints/offscreen/main.ts` | 188 | 18 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 18회 |
| `src/entrypoints/options/main.ts` | 164 | 75 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 75회 |
| `src/entrypoints/popup/fx-picker.ts` | 28 | 24 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 24회 |
| `src/entrypoints/popup/image.ts` | 121 | 36 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 36회 |
| `src/entrypoints/popup/mail-appearance.ts` | 61 | 18 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 18회 |
| `src/entrypoints/popup/mail-settings.ts` | 108 | 58 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 58회 |
| `src/entrypoints/popup/main.ts` | 1788 | 445 | - | - | 자바스크립트 | 팝업 전체 화면(DOM 445회). 반복 53곳은 목록을 화면에 그리는 일, 계산은 각 모듈의 순수 함수(이 표의 µs 값) |
| `src/entrypoints/popup/naver-mail.ts` | 182 | 88 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 88회 |
| `src/entrypoints/popup/naver-reader.ts` | 72 | 32 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 32회 |
| `src/entrypoints/popup/shop.ts` | 128 | 56 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 56회 |
| `src/entrypoints/popup/usage.ts` | 146 | 18 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 18회 |
| `src/entrypoints/popup/window-controls.ts` | 102 | 45 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 45회 |
| `src/entrypoints/shop.content.ts` | 237 | 47 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 47회 |
| `src/entrypoints/update/main.ts` | 443 | 41 | - | - | 자바스크립트 | 업데이트 화면·폴더 쓰기(파일 시스템 API 41회). 무거운 압축 풀기는 Rust(`zip.ts` → `zip.rs`) |
| `src/entrypoints/youtube-hold.content.ts` | 26 | 1 | - | - | 자바스크립트 | 진입점: 화면·크롬 연결, 브라우저 기능 1회 |
| `src/http/http.ts` | 160 | 5 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 디시 주소 만들기·요청(fetch·window). 주소 조립 몇 줄 |
| `src/http/messaging.ts` | 156 | 0 | 함수 1개, 최대 0.09µs (`isMissingReceiverError`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.09µs) |
| `src/modules/chrono-register.ts` | 11 | 2 | 연결 함수 1개 | - | 자바스크립트 | 예전 다운로드 엔진의 스크립트 등록 지우기(크롬 scripting API) |
| `src/modules/chzzk/content.js` | 457 | 117 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 플레이어 감시·복구·화질 메뉴 누르기(DOM·video·타이머 117회). 판단은 `lib/player.js`(최대 8.2µs)·`lib/retrytimer.js`(1.14µs)·`lib/quality.js`(0.53µs)에서 하고 모두 Rust 다리 실비용보다 짧아요 |
| `src/modules/chzzk/content-adblock.js` | 13 | 1 | - | - | 자바스크립트 | `lib/ads.js` 를 페이지에 끼우기만(12줄). 광고 응답 고치기 1.18µs, 페이지 MAIN world 라 WebAssembly 를 못 쓸 수 있음 |
| `src/modules/chzzk/content-adflag.js` | 134 | 38 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 광고 안내창 찾아 닫기(DOM·shadow DOM 38회). 판단은 `lib/player.js`(최대 8.2µs) |
| `src/modules/chzzk/content-autoplay.js` | 59 | 23 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 재생 버튼 찾아 누르기(DOM 23회). 판단은 `lib/autoplay.js`(최대 0.23µs) |
| `src/modules/chzzk/content-extras.js` | 743 | 262 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 시청자 수·시작 시각·광고 가리기·소리 복원(DOM·video 262회). 판단은 `lib/extras.js`(숫자 표기 Intl 15~19µs, 나머지 µs 미만)·`lib/player.js`·`lib/retrytimer.js` |
| `src/modules/chzzk/content-following.js` | 86 | 24 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 팔로잉 목록 새로고침 누르기(DOM·타이머 24회). 판단은 `lib/following.js`(최대 0.41µs) |
| `src/modules/chzzk/content-log-count.js` | 309 | 80 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 통나무 금액 화면(DOM·저장소·네트워크 80회). 계산은 기록 목록 찾기(`find`, 기록 최대 개수만큼)와 숫자 표기뿐 |
| `src/modules/chzzk/content-log-power.js` | 103 | 18 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 통나무 파워 받기 버튼 찾기(DOM 18회). 판단은 버튼 글자 정규식 한 번(`isReward`) |
| `src/modules/chzzk/content-watch.js` | 68 | 12 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 관심 스트리머로 이동(저장소·타이머 12회). 판단은 `lib/watch.js`(최대 1.65µs, 채널 200개 22µs) |
| `src/modules/chzzk/content-wide.js` | 172 | 52 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 넓은 화면 버튼 찾기·누르기(DOM 52회). 판단은 `lib/wide.js`(최대 0.32µs) |
| `src/modules/chzzk/ima-stub.js` | 58 | 9 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 페이지의 광고 SDK 자리를 채우는 빈 객체(계산 없음) |
| `src/modules/chzzk/lib/ads.js` | 373 | 2 | 함수 7개, 최대 1.18µs (`patchAdResponse`) | 7/7개 반드시 느림 | 자바스크립트 | 치지직 페이지 MAIN world 에서 fetch·JSON.parse 를 동기로 가로채요(페이지 CSP 아래). `patchAdResponse` 2.5µs |
| `src/modules/chzzk/lib/autoplay.js` | 27 | 0 | 함수 3개, 최대 0.23µs (`scorePlayButton`) | 3/3개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.23µs) |
| `src/modules/chzzk/lib/extras.js` | 79 | 0 | 함수 13개, 최대 18.68µs (`formatCount`) | 11/13개 반드시 느림, 나머지(formatViewers, formatCount)는 근거 칸 | 자바스크립트 | `formatCount`·`formatViewers` 는 Intl 표기기 재사용으로 바꿈(Rust 2.5µs 보다 JS 0.2µs 가 빠름, 게다가 치지직 콘텐츠 스크립트에는 엔진이 없어 준비 0.9ms 가 더 들어요). 나머지 하한 ≥ JS |
| `src/modules/chzzk/lib/following.js` | 30 | 0 | 함수 4개, 최대 0.41µs (`nextDelay`) | 4/4개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.41µs) |
| `src/modules/chzzk/lib/guard.js` | 25 | 11 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 확장 다시 불러오기 뒤 옛 스크립트 멈추기(타이머·관찰자 감싸기). 계산 없음 |
| `src/modules/chzzk/lib/ns.js` | 41 | 6 | - | - | 자바스크립트 | 치지직 설정 키 앞에 `chzzk.` 붙여 저장소 부르기(연결) |
| `src/modules/chzzk/lib/player.js` | 281 | 2 | 함수 30개, 최대 8.20µs (`pickSkipElement`) | 28/30개 반드시 느림, 나머지(restoreAudioState, pickSkipElement)는 근거 칸 | 자바스크립트 | `pickSkipElement`·`restoreAudioState` 등은 실제로 화면 요소(video·button)를 받아 고쳐요(DOM, Rust 로 넘길 수 없음). 글자 판단 함수들은 하한 ≥ JS |
| `src/modules/chzzk/lib/quality.js` | 33 | 0 | 함수 3개, 최대 0.53µs (`pickQualityIndex`) | 3/3개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.53µs) |
| `src/modules/chzzk/lib/retrytimer.js` | 64 | 0 | 함수 11개, 최대 1.14µs (`waitTotal`) | 11/11개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 1.14µs) |
| `src/modules/chzzk/lib/watch.js` | 40 | 0 | 함수 4개, 최대 1.65µs (`parseChannelInput`) | 3/4개 반드시 느림, 나머지(parseChannelInput)는 근거 칸 | 자바스크립트 | `parseChannelInput` 실제 주소 JS 0.86µs < 하한 1.51µs. `detectTransitions` 채널 200개 22µs 는 객체 목록을 넘겨야 함. 나머지 하한 ≥ JS |
| `src/modules/chzzk/lib/wide.js` | 34 | 0 | 함수 2개, 최대 0.32µs (`scoreCandidate`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.32µs) |
| `src/modules/chzzk/noop.js` | 2 | 0 | - | - | 자바스크립트 | 빈 파일(광고 스크립트 자리) |
| `src/modules/chzzk/popup.js` | 99 | 32 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 팝업 화면(DOM 32회). 판단은 `lib/watch.js` |
| `src/modules/chzzk/watch-background.js` | 81 | 6 | 함수 2개, 최대 0.77µs (`newlyLive`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.77µs), 나머지는 브라우저 기능 6회 |
| `src/modules/chzzk/wide-fullscreen.js` | 209 | 38 | 연결 함수 1개 | - | 자바스크립트 | 크롬 전체 화면(F11) 바꾸기·탭 소유권(크롬 windows API·저장소). 계산 없음 |
| `src/modules/chzzk-register.ts` | 149 | 23 | 연결 함수 2개 | - | 자바스크립트 | 치지직 콘텐츠 스크립트 등록·다시 넣기(크롬 scripting·tabs API 23회) |
| `src/modules/core-modules.js` | 29 | 3 | 함수 1개, 최대 0.22µs (`normalizeModules`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.22µs), 나머지는 브라우저 기능 3회 |
| `src/modules/core-wasm.js` | 166 | 0 | 함수 5개, 최대 0.05µs (`coreCall`) | 2/5개 반드시 느림, 나머지(coreCall, coreCallRaw, coreCallText)는 근거 칸 | Rust로 옮김 | Rust 공통 엔진으로 가는 다리 자체(`coreCall`·`coreCallRaw`·`coreCallText`·`coreExtractZip`). WebAssembly 를 불러오고 메모리에 글자를 쓰는 일은 JS 로만 돼요 |
| `src/modules/dark/contrast.js` | 440 | 27 | 함수 10개, 최대 25.85µs (`readableColor`) | 8/10개 반드시 느림, 나머지(readableColor, readableColorJs)는 근거 칸 | Rust로 옮김 | 색 대비 `readableColor`·`textPaint` 는 Rust(`native/dark-pixels`). `readableColorJs`·`repairTextColorJs` 는 WebAssembly 를 못 쓰는 사이트용 예전 길(rust-first: 예전 길은 남겨요). 나머지는 색 글자 읽기·컨트롤러(DOM) |
| `src/modules/dark/css-resource.js` | 38 | 0 | 함수 2개, 최대 1.52µs (`darkStylesheetPermission`) | 0/2개 반드시 느림, 나머지(darkStylesheetOrigins, darkStylesheetPermission)는 근거 칸 | 자바스크립트 | `darkStylesheetOrigins` JS 1.28µs < 하한 1.37µs, `darkStylesheetPermission` 1.29µs < 1.46µs(실제 주소) |
| `src/modules/dark/dark-wasm.js` | 57 | 0 | 함수 4개, 최대 0.07µs (`darkChannel`) | 4/4개 반드시 느림 | Rust로 옮김 | Rust 색 대비 엔진을 불러오는 다리(WebAssembly 불러오기는 JS로만 돼요) |
| `src/modules/dark/early-guard.js` | 65 | 9 | 함수 1개, 최대 0.05µs (`earlyDarkCss`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.05µs), 나머지는 브라우저 기능 9회 |
| `src/modules/dark/frame-host.js` | 18 | 0 | 함수 1개, 최대 0.88µs (`darkFrameHost`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.88µs) |
| `src/modules/dark/hairline-contrast.js` | 107 | 2 | - | - | 자바스크립트 | 가는 선(::before/::after) 색 고치기 컨트롤러(getComputedStyle·스타일). 색 대비 계산은 이미 Rust(`contrast.js` 경유) |
| `src/modules/dark/icon-contrast.js` | 279 | 27 | 함수 2개, 최대 0.06µs (`recolorSvgDataUrl`) | 2/2개 반드시 느림 | Rust로 옮김 | 픽셀 보정 `repairIconPixels` 는 Rust. 남은 것은 이미지 읽기·SVG 바꾸기(DOM·canvas) |
| `src/modules/dark/icon-pixels.js` | 36 | 0 | 함수 2개, 최대 0.04µs (`iconPixelsEngine`) | 2/2개 반드시 느림 | Rust로 옮김 | Rust 픽셀 엔진으로 가는 다리 |
| `src/modules/dark/image-resource.js` | 23 | 0 | 함수 1개, 최대 1.41µs (`darkImageOrigins`) | 0/1개 반드시 느림, 나머지(darkImageOrigins)는 근거 칸 | 자바스크립트 | `darkImageOrigins` 실제 주소 JS 1.11µs < 하한 1.29µs |
| `src/modules/dark/mail-theme.js` | 123 | 12 | 함수 1개, 최대 0.05µs (`mapMailGradient`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.05µs), 나머지는 브라우저 기능 12회 |
| `src/modules/dark/native-dark.js` | 150 | 10 | 함수 4개, 최대 0.89µs (`withNativeDark`) | 4/4개 반드시 느림 | 자바스크립트 | `classifyNativeDark` 0.12µs, `sampleNativeColors` 는 화면 색 읽기(getComputedStyle) |
| `src/modules/dark/paint-guard.js` | 159 | 29 | 함수 1개, 최대 0.08µs (`createImageBlendGuard`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.08µs), 나머지는 브라우저 기능 29회 |
| `src/modules/dark/proxy.js` | 454 | 13 | 연결 함수 1개 | - | 자바스크립트 | DarkReader 원본에서 가져온 페이지 끼우기 코드(CSSOM·DOM 가로채기). 우리 계산 없음 |
| `src/modules/dark/pseudo-contrast.js` | 149 | 8 | 연결 함수 1개 | - | 자바스크립트 | 작은 CSS 기호 색 고치기 컨트롤러(DOM·스타일). 색 대비 계산은 이미 Rust |
| `src/modules/dark/settings.js` | 112 | 0 | 함수 5개, 최대 4.13µs (`darkThemeForSite`) | 5/5개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 4.13µs) |
| `src/modules/dark/site-fixes.js` | 189 | 0 | 함수 2개, 최대 4.39µs (`withTranslationColors`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 4.39µs) |
| `src/modules/dark/stale-guard.js` | 61 | 6 | 연결 함수 1개 | - | 자바스크립트 | 업데이트 뒤 남은 옛 다크 스크립트 멈추기(메시지·타이머). 계산 없음 |
| `src/modules/diagnose.js` | 70 | 23 | 연결 함수 1개 | - | 자바스크립트 | 오른쪽 클릭 화면 진단 정보 모으기(getComputedStyle·DOM 23회). 사용자가 누를 때 한 번 |
| `src/modules/downloads/settings.js` | 105 | 0 | 함수 6개, 최대 4.84µs (`makeDownloadFilename`) | 4/6개 반드시 느림, 나머지(expandBatchUrls, makeDownloadFilename)는 근거 칸 | 자바스크립트 | `expandBatchUrls` 실험(Rust url 부품, 5,000개 같음): 크롬 100줄 142 → 96µs 로 빠르지만 url 부품이 엔진을 234 → 520KB 로 키워 엔진 준비가 0.9 → 2.1ms(서비스 워커가 깰 때마다)이고 다운로드 화면에는 엔진이 없어요(누를 때 한 번 46µs 아끼려고 1~2ms). `makeDownloadFilename` JS 2.1µs < 하한 4.1µs |
| `src/modules/downloads/toolbar-spinner.js` | 76 | 2 | 함수 1개, 최대 0.07µs (`summarizeDownloads`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.07µs), 나머지는 브라우저 기능 2회 |
| `src/modules/downloads/video.js` | 46 | 10 | 연결 함수 1개 | - | 자바스크립트 | 영상 보조 프로그램(이미 Rust `native/video-rs`)을 부르는 네이티브 메시징 연결 |
| `src/modules/downloads/video-history.js` | 21 | 0 | 함수 4개, 최대 0.17µs (`addVideoHistory`) | 4/4개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.17µs) |
| `src/modules/downloads/video-menu.js` | 9 | 0 | 함수 1개, 최대 3.34µs (`videoSaveTarget`) | 0/1개 반드시 느림, 나머지(videoSaveTarget)는 근거 칸 | 자바스크립트 | `videoSaveTarget` 실제 입력 JS 0.67µs < 하한 2.05µs |
| `src/modules/fx/background.js` | 28 | 3 | 연결 함수 1개 | - | 자바스크립트 | 환율 배지 시세 받기 주기(알람·네트워크). 계산은 `convert.js`·`tradingview.js` |
| `src/modules/fx/convert.js` | 200 | 0 | 함수 20개, 최대 18.16µs (`formatMoney`) | 18/20개 반드시 느림, 나머지(availableCurrencyCodes, formatMoney)는 근거 칸 | 자바스크립트 | `formatMoney` 실험: Rust 판(숫자 25만 개 같음) 2.5µs < 예전 JS 11µs 이지만, Intl 표기기를 한 번만 만드는 JS 가 0.23µs 로 더 빨라 그걸로 바꿈(테스트 2만 개 같음). `availableCurrencyCodes` 통화 340개 JS 59µs < 하한 88µs. 나머지 하한 ≥ JS |
| `src/modules/fx/currency-names.js` | 344 | 0 | - | - | 자바스크립트 | 통화 이름 표 데이터(계산 없음) |
| `src/modules/fx/refresh.js` | 50 | 0 | 연결 함수 1개 | - | 자바스크립트 | 시세 다시 받기(네트워크·저장소). 읽기는 `convert.js` `parseRatePayload` |
| `src/modules/fx/tradingview.js` | 156 | 1 | 함수 5개, 최대 0.22µs (`encodeTv`) | 5/5개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.22µs), 나머지는 브라우저 기능 1회 |
| `src/modules/gmail/account-style.js` | 27 | 0 | 함수 2개, 최대 0.50µs (`accountColor`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.50µs) |
| `src/modules/gmail/actions.js` | 185 | 0 | 함수 8개, 최대 5.33µs (`parseGmailTokens`) | 6/8개 반드시 느림, 나머지(parseGmailTokens, profileFromHtml)는 근거 칸 | Rust로 옮김 | 프로필 사진 찾기 `profileFromHtml` 을 Rust(`profile.rs`)로: 메일 주소를 모르는 1만 자 이상 페이지만(크롬 1만 자 0.052 → 0.024ms, 200만 자 11.3 → 4.7ms, 무작위 2만 개 같음). 메일을 알면 JS 가 빠름(200만 자 1.9 vs 4.5ms). `parseGmailTokens` 는 실제 크기 HTML 로 재 보니 토큰이 있으면 JS 0.002~0.33ms < 글자 넘기기 하한 0.26~0.58ms → 옮기면 느림 |
| `src/modules/gmail/atom.js` | 78 | 0 | 함수 6개, 최대 1.20µs (`emailFromTitle`) | 6/6개 반드시 느림 | Rust로 옮김 | 피드 읽기 `atom.rs`: 20통 약 1.7배. 1,000자 미만은 다리 비용이 커서 JS |
| `src/modules/gmail/auto-read.js` | 154 | 1 | 함수 5개, 최대 3.60µs (`isAliExpressSender`) | 3/5개 반드시 느림, 나머지(isAliExpressSender, senderDomain)는 근거 칸 | 자바스크립트 | 실제 보낸 사람 주소: `senderDomain` JS 0.19~0.32µs < 하한 0.65~0.87µs, `isAliExpressSender` 0.25~0.32µs < 0.62~0.71µs |
| `src/modules/gmail/background.js` | 586 | 38 | 함수 1개, 최대 1.01µs (`accountUrl`) | 1/1개 반드시 느림 | 자바스크립트 | 크롬 API 연결(탭·알림·숨은 화면·쿠키 토큰·소리). 순수 계산 함수 없음 |
| `src/modules/gmail/open.js` | 57 | 0 | 함수 6개, 최대 2.44µs (`accountIndex`) | 6/6개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 2.44µs) |
| `src/modules/gmail/otp.js` | 82 | 0 | 함수 2개, 최대 2.42µs (`extractMailOtp`) | 2/2개 반드시 느림 | Rust로 옮김 | 인증번호 찾기 `otp.rs`: 16만 자 메일 약 2배, 보통 메일 약 1.6배 |
| `src/modules/gmail/otp-paste.js` | 40 | 0 | 연결 함수 1개 | - | 자바스크립트 | 인증번호를 워커 메모리에 잠깐 들고 있기(타이머). 계산 없음 |
| `src/modules/gmail/otp-paste-bridge.js` | 62 | 11 | 연결 함수 1개 | - | 자바스크립트 | 인증번호 붙여넣기 탭 연결(크롬 tabs·scripting 11회) |
| `src/modules/gmail/otp-paste-watch.js` | 35 | 9 | 연결 함수 1개 | - | 자바스크립트 | 붙여넣기 칸 감시(콘텐츠 스크립트 DOM 이벤트 9회) |
| `src/modules/gmail/otp-toast.js` | 24 | 26 | 연결 함수 2개 | - | 자바스크립트 | 닫힌 Shadow DOM 안내 띄우기(DOM 26회) |
| `src/modules/gmail/sound.js` | 52 | 0 | 함수 3개, 최대 0.14µs (`soundFile`) | 3/3개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.14µs) |
| `src/modules/gmail/watch.js` | 176 | 0 | 함수 18개, 최대 228.03µs (`nextWaitMs`) | 16/18개 반드시 느림, 나머지(mailTabBadge, orderAccounts)는 근거 칸 | 자바스크립트 | 실제 입력(4계정×20통): `mailTabBadge` JS 0.34µs < 하한 85µs, `orderAccounts` JS 1.1µs < 하한 107µs(계정 객체를 넘겨야 함). `nextWaitMs`·`notificationId` 0.00µs |
| `src/modules/image/paste.js` | 179 | 4 | 함수 11개, 최대 1.04µs (`nativeUploadStarted`) | 11/11개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 1.04µs), 나머지는 브라우저 기능 4회 |
| `src/modules/image/toolbar.js` | 92 | 0 | 함수 9개, 최대 7.07µs (`originalImageUrl`) | 7/9개 반드시 느림, 나머지(filenameFromUrl, originalImageUrl)는 근거 칸 | 자바스크립트 | `originalImageUrl` 실험(Rust url 부품, 3만 3천 건 같음): 크롬 3.16 → 2.50µs(누를 때 한 번 0.66µs)인데 url 부품 때문에 엔진 준비가 매번 +1.2ms → 1,800번 눌러야 본전. `filenameFromUrl` JS 1.28µs < 하한 1.45µs |
| `src/modules/image/toolbar-background.js` | 241 | 24 | 함수 1개, 최대 0.19µs (`sniffImageMime`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.19µs), 나머지는 브라우저 기능 24회 |
| `src/modules/naver-mail/background.js` | 51 | 21 | 연결 함수 1개 | - | 자바스크립트 | 네이버 메일 확인 주기(알람·저장소 21회). 읽기는 `client.js`(2.9µs) |
| `src/modules/naver-mail/client.js` | 70 | 2 | 함수 2개, 최대 0.21µs (`naverId`) | 2/2개 반드시 느림 | 자바스크립트 | `parseList` 30통 2.9µs, `parseMessage` 0.02µs, 나머지 네트워크 |
| `src/modules/naver-mail/message.js` | 38 | 14 | 함수 1개, 최대 1.32µs (`safeMailUrl`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 1.32µs), 나머지는 브라우저 기능 14회 |
| `src/modules/rightclick/background.js` | 63 | 8 | 연결 함수 2개 | - | 자바스크립트 | 오른쪽 클릭 허용 사이트 등록(크롬 scripting·저장소) |
| `src/modules/rightclick/inject.js` | 75 | 16 | 연결 함수 2개 | - | 자바스크립트 | 페이지의 오른쪽 클릭·복사 막기 풀기(DOM 이벤트 16회) |
| `src/modules/rightclick/origin.js` | 20 | 0 | 함수 3개, 최대 1.26µs (`originOf`) | 3/3개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 1.26µs) |
| `src/modules/settings-io.ts` | 165 | 7 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 설정 내보내기·가져오기(저장소). `planImport` 는 가져오기 버튼 때 한 번, 키 정리는 `onlyDcKeys`(키 300개 30.5µs) |
| `src/modules/shop/background.js` | 219 | 13 | 함수 1개, 최대 0.05µs (`takeQuietShopDownload`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.05µs), 나머지는 브라우저 기능 13회 |
| `src/modules/shop/read-page.js` | 51 | 25 | 연결 함수 1개 | - | 자바스크립트 | 상품 페이지에서 이름·사진·가격 글자 읽기(DOM 25회). 가격 해석은 `shop.js`(0.7~1.3µs) |
| `src/modules/shop/shop.js` | 221 | 1 | 함수 14개, 최대 19.36µs (`formatPrice`) | 10/14개 반드시 느림, 나머지(chartPath, formatPrice, originalProductImage, recordPrice)는 근거 칸 | 자바스크립트 | `formatPrice` 는 Intl 표기기 재사용으로 바꿈(Rust 2.5µs 보다 JS 0.23µs 가 빠름). `originalProductImage` 실험(url 부품, 같음 0건 다름): 크롬 Rust 2.23µs > JS 1.93µs. `chartPath` 가격 60개 JS 17µs < 하한 38µs, `recordPrice` JS 13µs < 하한 135µs |
| `src/modules/theme/contrast.js` | 34 | 0 | 함수 5개, 최대 0.72µs (`composite`) | 5/5개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.72µs) |
| `src/modules/theme/tokens.js` | 95 | 0 | - | - | 자바스크립트 | 디자인 색·글꼴 표 데이터(계산 없음) |
| `src/modules/theme/ui.js` | 54 | 21 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 화면 도우미(DOM 이벤트·MutationObserver). 계산은 퍼센트 한 줄 |
| `src/modules/toolbar-badge.js` | 110 | 9 | 함수 3개, 최대 0.12µs (`toolbarBadgeText`) | 3/3개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.12µs), 나머지는 브라우저 기능 9회 |
| `src/modules/trans/background.js` | 488 | 37 | 연결 함수 2개 | - | 자바스크립트 | 번역 메뉴·탭·사이트 허용 연결(크롬 API 37회) |
| `src/modules/trans/content/content.js` | 2266 | 176 | 함수 15개, 최대 33.63µs (`planWiperOrder`) | 14/15개 반드시 느림, 나머지(planWiperOrder)는 근거 칸 | 자바스크립트 | 실험: `planWiperOrder` Rust(3,000개 같음) 크롬 300상자 30 → 239µs(7.8배 느림). `isAlreadyTargetLanguage` Rust(unicode-script) 는 크롬과 177글자가 달라요(유니코드 판 차이, 모든 글자 667만 건 비교) + 2~5배 느림. 번역 화면 스크립트(DOM 176회)는 엔진이 없는 곳이라 준비 0.9ms 도 더 들어요 |
| `src/modules/trans/lib/badge.js` | 29 | 0 | 함수 2개, 최대 0.12µs (`formatBadgeCount`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.12µs) |
| `src/modules/trans/lib/cache.js` | 217 | 3 | 연결 함수 2개 | - | 자바스크립트 | IndexedDB 번역 캐시. 캐시 키는 브라우저 WebCrypto(이미 가장 빠름) |
| `src/modules/trans/lib/cache-policy.js` | 138 | 0 | 함수 9개, 최대 0.74µs (`utf8Bytes`) | 9/9개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.74µs) |
| `src/modules/trans/lib/chunk.js` | 18 | 0 | 함수 1개, 최대 0.64µs (`chunkTexts`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.64µs) |
| `src/modules/trans/lib/deepl.js` | 106 | 2 | 함수 2개, 최대 0.20µs (`deeplTarget`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.20µs), 나머지는 브라우저 기능 2회 |
| `src/modules/trans/lib/errors.js` | 10 | 0 | - | - | 자바스크립트 | 오류 이름 상수(계산 없음) |
| `src/modules/trans/lib/gemini.js` | 450 | 3 | 함수 5개, 최대 1.31µs (`classifyHttpError`) | 5/5개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 1.31µs), 나머지는 브라우저 기능 3회 |
| `src/modules/trans/lib/messages.js` | 38 | 0 | 함수 1개, 최대 0.18µs (`withDetail`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.18µs) |
| `src/modules/trans/lib/origin-permission.js` | 13 | 0 | 함수 1개, 최대 1.18µs (`originPermissionPattern`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 1.18µs) |
| `src/modules/trans/lib/prompt.js` | 73 | 0 | 함수 2개, 최대 1.60µs (`buildPrompt`) | 2/2개 반드시 느림 | 자바스크립트 | `buildPrompt` 50문장 5.5µs, `parseTranslations` 7.5µs(내장 JSON) |
| `src/modules/trans/lib/settings.js` | 201 | 0 | 함수 11개, 최대 2.26µs (`serializeSettings`) | 10/11개 반드시 느림, 나머지(serializeSettings)는 근거 칸 | 자바스크립트 | `serializeSettings` = JSON.stringify(넘기려면 같은 JSON 바꾸기가 필요, 하한 3.16µs ≈ JS 3.31µs), `parseSettingsImport` 2.95µs(내장 JSON.parse) |
| `src/modules/trans/lib/settings-store.js` | 13 | 2 | 연결 함수 2개 | - | 자바스크립트 | 번역 설정 저장소 읽기·쓰기(13줄) |
| `src/modules/trans/lib/toggle-state.js` | 31 | 0 | 함수 4개, 최대 0.11µs (`refreshToggle`) | 4/4개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.11µs) |
| `src/modules/trans/lib/translation-quality.js` | 21 | 0 | 함수 2개, 최대 0.42µs (`incompleteTranslationError`) | 2/2개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.42µs) |
| `src/modules/trans/lib/translator.js` | 252 | 0 | 연결 함수 1개 | - | 자바스크립트 | 번역 요청 묶음·동시 실행·캐시 순서 정하기(비동기 Promise 관리). 계산은 묶기 `chunk.js`(300문장 2.5µs)와 키 문자열 만들기 |
| `src/modules/trans/options/options.js` | 282 | 78 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 번역 설정 화면(DOM 78회) |
| `src/modules/trans/popup/popup.js` | 217 | 41 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 번역 팝업 화면(DOM·탭 41회) |
| `src/modules/trans/toolbar-progress.js` | 143 | 4 | 연결 함수 3개 | - | 자바스크립트 | 번역 중 아이콘 그리기(OffscreenCanvas 몇 장, 크롬 action API). 그림 몇 장이라 GPU·Rust 이득 없음 |
| `src/modules/usage/background.js` | 141 | 9 | 연결 함수 5개 | - | 자바스크립트 | Claude·ChatGPT 사용량 받기(네트워크·쿠키). 읽기는 `usage.js`(1.6µs) |
| `src/modules/usage/usage.js` | 113 | 0 | 함수 9개, 최대 1.10µs (`parseClaudeUsage`) | 9/9개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 1.10µs) |
| `src/modules/youtube/background.js` | 39 | 4 | 연결 함수 1개 | - | 자바스크립트 | 유튜브 자동 재생 막기 등록(크롬 scripting) |
| `src/modules/youtube/hold.js` | 55 | 4 | 함수 1개, 최대 0.06µs (`shouldHold`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 0.06µs), 나머지는 브라우저 기능 4회 |
| `src/platform/effects.js` | 43 | 3 | 연결 함수 2개 | - | 자바스크립트 | 탭 열기·네트워크를 한곳에 모은 연결 객체(시험용 가짜와 짝) |
| `src/platform/popup-actions.js` | 41 | 1 | 연결 함수 2개 | - | 자바스크립트 | 팝업이 밖에서 하는 일 연결(effects 경유) |
| `src/storage/migration.ts` | 255 | 6 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | `normalizeStorageData` 0.57ms(차단 3,000개+메모 2,000개)인데 Rust로 넘기기만 0.54ms(JSON 바꾸기), 결과도 JS 객체. 설치·가져오기 때 한 번. `planUpdateKeyMigration` 0.35µs |
| `src/storage/namespace.ts` | 18 | 0 | 함수 2개, 최대 12.01µs (`onlyDcKeys`) | 1/2개 반드시 느림, 나머지(onlyDcKeys)는 근거 칸 | 자바스크립트 | `onlyDcKeys` 키 300개: JS 32µs < 하한 246µs(객체를 넘기고 받아야 함) |
| `src/storage/wxtStorage.ts` | 100 | 0 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 저장소 항목 정의(WXT storage). 계산 없음 |
| `src/utils/ban.ts` | 49 | 1 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | `buildBanReverseIndex` 2.85ms(5만 개)인데 넘기기 1.17ms + 결과를 JS Map 으로 받기 9.65ms. `getBan` 0.00µs |
| `src/utils/comment.ts` | 160 | 5 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 디시 댓글 보내기(네트워크·DOM). `decode`·`secretKey` 는 댓글을 보낼 때 한 번 하는 짧은 글자 처리 |
| `src/utils/dcinsideTab.ts` | 38 | 3 | 함수 1개, 최대 1.13µs (`isDcContentScriptUrl`) | 1/1개 반드시 느림 | 자바스크립트 | 내보내는 순수 함수 모두 Rust 하한(주고받기만, 계산 0)이 JS 보다 커서 어떤 Rust 구현도 이길 수 없어요(가장 긴 함수 1.13µs), 나머지는 브라우저 기능 3회 |
| `src/utils/ip.ts` | 68 | 1 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | `format` 0.00µs, 나머지 저장소 읽기 |
| `src/utils/ipIsp.ts` | 105 | 1 | 함수 3개, 최대 0.14µs (`prefixKey`) | 3/3개 반드시 느림 | 자바스크립트 | `lookupPrefix` 0.17µs, 나머지 네트워크 |
| `src/utils/memoAsk.ts` | 162 | 38 | 연결 함수 1개 | - | 자바스크립트 | 메모 입력 창(DOM 38회) |
| `src/utils/sanitizeHtml.ts` | 121 | 5 | 함수 2개, 최대 1.69µs (`safeHttpUrlOrEmpty`) | 2/2개 반드시 느림 | 자바스크립트 | 브라우저 DOMParser·DOM 직렬화가 필요 |
| `src/utils/toast.ts` | 70 | 8 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | 안내 띄우기(DOM) |
| `src/utils/types.ts` | 6 | 0 | - | - | 자바스크립트 | 타입 선언만(실행 코드 없음) |
| `src/utils/user.ts` | 207 | 7 | 불러오면 바로 브라우저 기능을 씀 | - | 자바스크립트 | `getType` 0.03µs, 나머지 저장소 읽기 |
| `src/utils/userDataInsert.ts` | 107 | 14 | - | - | 자바스크립트 | 닉네임 옆에 정보 끼워 넣기(DOM 14회) |

합계: 옮긴 기능은 9가지(zip 풀기, 설치 순서 정렬, 업데이트 우선 파일 찾기, 메일 인증번호, Gmail 피드, 프로필 사진 찾기, 다크 픽셀, 다크 색 대비, 영상 보조 프로그램)예요. 세는 단위가 달라요: 기능 9가지 중 8가지가 src 의 파일 7개(zip.ts, installPlan.ts(정렬·우선 파일 찾기 둘), otp.js, atom.js, actions.js, contrast.js, icon-contrast.js)에 들어 있고, 여기에 Rust 로 가는 다리 파일 3개(core-wasm.js, dark-wasm.js, icon-pixels.js)를 더해 'Rust 를 쓰는 파일' 10개예요. 영상 보조 프로그램은 src 밖(`native/video-rs`)이에요. 나머지 250개 파일은 자바스크립트로 둬요(파일 260개).

 앞의 표가 파일마다 판정과 근거를 보여 줘요. 브라우저 밖 프로그램 중 영상 보조 프로그램(`native/video-rs`)도 Rust로 옮겼어요. 가져온 외부 코드(`public/` 의 Checker Plus 메일 엔진·DarkReader·Chrono 다운로더·Autolinker)는 우리 코드가 아니라서 판정에서 뺐어요.

다시 판정하는 법: 새 파일이 생기거나 계산이 무거워지면 이 표에 한 줄을 더하고, 한 번 처리 시간이 Rust 다리 실비용(16~20µs)보다 확실히 길고 결과를 똑같이 만들 수 있으면 `native/core-wasm` 으로 옮겨 골든 테스트를 붙여요.
