# Gmail 캐시 복구 후속 — 2026-11-09

- 기준 main `1e7532b`, 앱 `1.2.52`, 시작 작업 트리는 깨끗했어요.
- 실패 선행 재현: 의심 원문 캐시의 재사용, fresh 원문 성공, 실패한 캐시 복구의 성공 처리 3개 시험이 수정 전에 실패했어요.
- translator.js와 새 translation-quality.js: ko + 원문에 Firefox Relay 문맥 + 원문/결과에 같은 확인 구절이 남은 경우만 불완전으로 판정해요.
- 검사 구절은 `Forwarded from`, `Email trackers removed`, `Manage this mask`예요. URL·메일 주소는 검사에서 제외해요. 브랜드/SKU/짧은 이름/한국어와 다른 목표 언어는 기존대로 처리해요.
- 의심 IDB hit만 miss로 취급해 translateFn을 1회 호출해요. 성공 때 같은 키를 정상 번역으로 덮고 실패 때 기존 값을 보존해요. 전체 삭제·캐시 버전 변경은 없어요.
- fresh 결과에도 같은 구절이 남으면 `INCOMPLETE_TRANSLATION`을 반환하고 그 batch는 성공 저장/완료 처리하지 않아요. 기존 UI 오류 메시지 경로를 사용해요.
- 실패한 문장 키는 메모리에 30초(최대 5000개) 보관해 중복 호출을 억제해요. 시간이 지난 뒤 새 요청이 올 때만 다시 시도하며 자동 retry/timer/batch 재요청은 없어요.
- 동시 동일 문장은 기존 inflight로 합쳐져 성공/실패 모두 1회 호출이에요. 기존 모델 내부 네트워크 retry/fallback 정책은 바꾸지 않았어요.
- 검사: 관련 단위 60개와 합성 Chrome Gmail fixture 통과, diff --check 통과했어요. 실제 createTranslator→page bridge로 캐시 복구 1회→한국어→done=1, fresh 불완전→오류·busy=false·done=0과 즉시 수동 재시도 시 API 1회 유지를 확인했어요.
- 분할 노드: 위 세 구절 자체와 정확히 일치하는 노드는 브랜드 문맥 없이 검사해요. 각 구절의 캐시 복구/새 원문 거부 시험을 통과했어요.
- 한계: 일반 영어 전체를 판정하지 않아요. 더 작은 단어 단위 분할·다른 미번역 구절은 놓칠 수 있어요. 정상 인용으로 해당 구절을 보여줘야 하는 문장은 오탐할 수 있어 총괄 검수가 필요해요.
- 최신 합성 오류 UI 증거: `C:/Users/REVAPT~1/AppData/Local/Temp/be-gmail-translation-Bh83GY/incomplete.png`를 직접 열어 확인했어요.
- echo를 삭제하거나 부분 문자열을 잘라내지 않아요. 오류 batch의 정상 항목도 완료되지 않아 사용자 재시도 시 다시 요청될 수 있어요.
- 실제 Gmail/유료 Gemini·사용자 캐시·설치 적용은 미검증이에요. 본문 수집·프리즘 코드는 변경하지 않았어요. 전체 시험/빌드/커밋/배포는 총괄 소유예요.

## 이전 배정 기록

### 총괄 최종 검수

- Relay를 언급하며 영어 버튼 이름을 인용하는 정상 한국어 문장이 오류가 되는 오탐을 실패 시험으로 확인했어요. 일반 Relay 언급 대신 실제 전달 안내 시작/제목 구분자 뒤의 안내 또는 독립 UI 문구로 제한해 해결했고 해당 시험도 통과했어요.
- 1.2.53 전체 시험 247개·타입·ZIP·eval·권한 검사와 실제 translator를 연결한 합성 Chrome의 캐시 복구/오류 검증이 통과했어요.
- 총괄이 `C:/Users/Revaptor_FX/AppData/Local/Temp/be-gmail-translation-RPDFfa/incomplete.png`를 직접 확인하고 오류 닫기 버튼이 세로로 줄바꿈되지 않게 보완했어요.
- 사용자 실제 DOM·저장값·모델 결과를 읽은 것이 아니므로 원인 전체의 확정이나 실제 설치 적용은 주장하지 않아요.

- 현재 기준: main `23d90a4`, 앱 `1.2.51`, 시작 작업 트리는 깨끗했어요.
- 사진은 한국어 제목 뒤 영어 snippet 잔존이에요. 동일 문장의 이중 표시로 단정할 근거는 없어요.
- 가상 주소를 쓴 합성 Gmail DOM에서 긴 Relay 문장·분할 문장 모두 sendBatch로 전송되고 한국어로 대체됐어요.
- 기존 본문 수집·동일 원문 재렌더 복원·프리즘 cleanup 실패는 이 구조에서 재현되지 않았어요. 주증상을 해결했다고 단정하지 않아요.
- 확정 실패: 혼합 한국어+영어 title이 이미 한국어라고 판정돼 요청을 생략했어요. 수정 전 브라우저 assertion 실패를 확인했어요.
- content/content.js: URL·메일 주소를 제외한 Latin이 있으면 목표 언어 완료 판정을 하지 않도록 수정했어요. 본문에는 이 판정이 적용되지 않아요.
- prompt.js: 혼합 언어/메일 전달·개인정보 안내/동작 문구도 번역하고 주소·브랜드만 보존하며 원문 병기를 금지하도록 명확히 했어요.
- translator.js 검토: 원문 그대로 또는 원문+번역 응답도 캐시에 저장되고 hit 때 그대로 재사용될 수 있어요. 사용자 실제 응답·캐시는 미확인이에요.
- 캐시 삭제·무효화·추가 API 요청·자동 재시도는 추가하지 않았어요. 프롬프트 변경은 기존 캐시 hit에는 효과가 없어요.
- echo 정리 제안: 전체 source와 정확히 일치하는 prefix + 줄바꿈 등 명확 구분자 + 목표 언어 번역만 남은 경우로 제한하고 cache hit와 fresh response 모두에 같은 정리를 적용할 수 있어요.
- 다만 실제 echo 예시가 없고 정상 인용문 오탐 가능성이 있어 이번에는 구현하지 않았어요. 원문 그대로 캐시의 자동 우회는 추가 비용이 생겨 도입하지 않았어요.
- 변경 파일: content/content.js, lib/prompt.js, test/content-session.test.js, scripts/verify-gmail-translation-browser.cjs, 이 보고서예요.
- 검증: 관련 단위 53개, 합성 Chrome 브라우저 검사, git diff --check 통과했어요.
- 브라우저: queue 입력·모든 문장 대체·분할 노드·재렌더·원문 토글·끄기 복원·최종 overlay 0개·입력/SKU 보존을 확인했어요.
- 증거를 직접 열어 최종 한국어·잔상 없음을 확인했어요: `C:/Users/REVAPT~1/AppData/Local/Temp/be-gmail-translation-pkNgLG/translated.png`.
- 실제 Gmail DOM·실제 모델 응답·사용자 캐시·설치 적용은 미검증이에요. 개인 브라우저/유료 API 접근과 전체 시험·빌드·커밋·배포는 하지 않았어요.

## 최초 준비 기록

총괄 통합: 1.2.52 전체 시험 239개·타입·ZIP·eval·권한 검사 통과. 합성 최종 화면을 직접 검수했어요. 실제 본문 영어 잔존의 완전 해결은 주장하지 않으며 회전 표시 완료 후에도 남았는지 사용자 확인이 필요해요.

- 역할: Gemini 번역, 프리즘 애니메이션, 번역 캐시·설정, 항상 번역 권한과 번역 전용 화면을 총괄의 명시 배정 범위에서 담당해요.
- 기준: `main`, HEAD `ae2dfd6`, `package.json` 앱 버전 `1.2.49`을 확인했어요.
- 실제 Git 루트: `C:/Users/Revaptor_FX/Documents/Codex/2026-11-04/https-github-com-baegovda-bongextend-https/work/BongExtend`이에요.
- 주요 진입점: `src/modules/trans/background.js`, `content/content.js`, `lib/gemini.js`, `lib/translator.js`예요.
- 관련 범위: `lib/{settings,settings-store,prompt,chunk,errors,cache,cache-policy,origin-permission,toggle-state,badge}.js`, `toolbar-progress.js`, `popup/`, `options/`, `test/`예요.
- 공유 의존: `src/entrypoints/background.ts`, 전체 팝업 셸, `wxt.config.ts`, 권한·등록, `package.json`, `CHANGELOG.md`는 총괄 소유이며 직접 수정하지 않아요.
- 계약 주의: 콘텐츠 스크립트는 비모듈 IIFE이고 본문은 `nodeValue`, 툴팁은 `title`만 사용해요. Gemini 키와 `GET_PREFS` 허용 필드도 기존 계약을 유지해요.
- 데이터·권한 주의: `trans.*` local 저장소와 `page-translator` IndexedDB를 보존하고, 항상 번역은 대상 사이트의 선택 권한만 요청해요.
- 이번 초기 배정에서는 앱 소스를 수정하지 않았고, 앱 시험·빌드·커밋·푸시·릴리스도 실행하지 않았어요.
- 기존 작업 트리에 총괄/다른 담당의 준비 문서 변경이 있어 보존했어요.
- 다음 총괄의 구체적 목표와 편집 허용 파일 배정을 기다려요.
