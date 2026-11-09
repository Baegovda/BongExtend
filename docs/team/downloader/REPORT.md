# 다운로더 UI 리메이크 보고 (2026-11-10)

## 총괄 통합 1.2.55 — 아래 중간 제한 대체

- 최종 1.2.55 패키지 검사 통과: 빈 목록, 실제 paused 작업1/행1, 선택·검색·ID조회·완료개수0, 밝음/어두움·734/440px와 검색/휴지통 아이콘 대비. `C:/Users/REVAPT~1/AppData/Local/Temp/be-manager-iER7R5/manager-item-dark.png` 직접 확인했어요. 마지막 toolbar 색보완 후 재검수한 근거예요.
- 원인 확정: pinned ui.min.js의 wf.eg(4/8/13)가 기대하는 `globalThis.__cdexp_$0` export가 패키지에서 없었어요. 그래서 목록 조회가 조용히 []로 대체됐고 원본 화면도 비었어요. CSS나 선택 권한 문제가 아니에요.
- 총괄이 download-module.js에 native IndexedDB **readonly** 조회 adapter(전체/ID/완료·중단·누락 개수)를 연결했어요. vendor 본체, DB 버전/데이터/파일/권한은 변경하지 않았어요. tasks-v2의 숫자 state3/4와 recycled/exists 의미를 원본 코드로 확인했어요.
- 검색은 focus로 열린 직후 click으로 닫히던 원본 이벤트 순서를 mouse-down 기본 focus 방지로 보정했어요. 키보드 focus는 유지해요.
- 실제 엔진 메시지로 추가한 임시 paused 작업이 관리자 행으로 표시되고, 선택/검색 결과 없음/검색 지우기 복원/ID 조회와 밝음·어두움/734·440px 검사가 통과했어요. 아래 초기 row0/미검증은 이 수정 전 기록이에요.
- 최소 권한 제품 검사에서 2MiB 파일의 시작·일시정지·재개·재시작·완료 바이트 일치, 완료 작업 개수 조회, 목록 제거 뒤 실파일 보존, 메일 설정 저장과 페이지/worker 오류0을 확인했어요. `C:/Users/REVAPT~1/AppData/Local/Temp/be-download-test-27eVpV`.
- 최근 목록→설정→관리자→복귀/설정 토글/다크 설정 화면 통과. 기존 shell fixture가 최근 화면에서 숨겨진 상단 버튼을 누르던 검사는 보이는 설정 아이콘을 사용하도록 고쳤어요. `C:/Users/REVAPT~1/AppData/Local/Temp/be-downloader-shell-LhBP2p`.
- 공통 glass 설정 면, 파일명/보조글/선택행/검색·휴지통 아이콘 대비도 총괄이 최종 통합했어요. 실제 사용자 다운로드나 native host에는 접근하지 않았어요.

- 기준: `main / 118f4f5 / 1.2.54`, 지정 UI 작업을 마쳤어요.
- 변경: `public/download-module.css`, `public/download-module.js`, `public/recent-downloads.css`, `scripts/verify-downloader-manager-browser.cjs`, 이 보고서예요.
- 관리자 북쪽 패널 64px, 560px 미만에서는 108px 두 줄 도구 모음으로 바꿨어요. 최소 800px 제한을 제거했어요.
- 원본 vendor 파일 없이 jQuery layout 공개 옵션으로 사이드바 폭·창 크기 변경을 연결했어요.
- 기존 버튼 ID·클릭 처리 유지, PNG 아이콘을 로컬 Material 아이콘으로 교체하고 새 다운로드 라벨을 넣었어요.
- 사이드바·본문·하단·상세 패널 색/경계, hover·선택·disabled·focus·빈 목록을 공통 테마에 맞췄어요.
- 최근 다운로드 목록도 반투명 카드·그라데이션 배경으로 정리했어요. 목록 구조와 이벤트는 유지해요.
- 검증: `node scripts/verify-downloader-manager-browser.cjs --source` 통과. 폐기용 Chrome, 734×500 밝음/어두움, 440×620 좁은 창과 가로 넘침 검사예요.
- 최신 공통 theme.css를 임시 확장에 복사해 조합했어요. 이미지 직접 검수: 어두운 734px, 밝은 440px의 빈 목록이에요.
- 증거 폴더: `C:/Users/Revaptor_FX/AppData/Local/Temp/be-manager-m54rZ6`.
- 후속 검증: 최신 checkpoint 빌드와 소스 공통 glass/canvas 토큰을 조합했어요. 734/440px의 모든 표시 도구 버튼 경계와 aria-label·기존 tooltip 검사를 통과했어요. title은 원본 엔진이 tooltip으로 옮기므로 tooltip 내용도 이름 증거로 검사해요.
- 비활성 표시는 HTML disabled와 `.disabled`·aria-disabled 상태에 모두 적용해요. 실제 비활성 엔진 버튼도 밝음/어두움 캡처에서 확인했어요.
- 후속 제한: 실제 `new_task` 메시지(add_paused) 응답은 y, IndexedDB 작업 수는 1이지만 관리자 `.slick-row` 수는 0이에요. 새로고침·모든 작업 재선택 후에도 같았어요. 엔진/DB 수정은 하지 않았어요.
- 최종 스크립트는 빈 화면/toolbar 검사까지 PASS, 실제 작업 행 존재 assertion에서 FAIL해요. 선택·검색 검사는 작성했으나 앞 단계 실패로 실행되지 않았어요. 전체 통과로 해석하면 안 돼요.
- 선택 권한을 임시 manifest에 추가해도 결과가 같아 해당 확대는 제거했어요. paused 작업은 시작하지 않으며 네트워크 파일 저장도 하지 않아요. 로그는 응답·작업 수·행 수 등 짧은 정보만 남겨요.
- 최신 검수 증거: `C:/Users/Revaptor_FX/AppData/Local/Temp/be-manager-PISbg8`. 어두운 734px와 밝은 440px를 직접 확인했어요.
- 최근 목록 CSS는 정적 변경이며 별도 화면 검수는 아직 하지 않았어요. 실제 사용자 브라우저·네이티브 호스트는 접근하지 않았어요.
- 전체 시험·빌드·버전 변경·커밋·푸시·릴리스는 실행하지 않았어요. 다른 담당의 공유 변경을 보존했어요.
- 공통 토큰 추가 요청은 없어요. 설정/팝업에 영향을 줄 관리자 배치 규칙은 `#dy_tot_wrap` 등으로 한정했어요.

## 이전 초기 준비 기록

### 마지막 독립 비교 진단

- `--source --diagnose`와 `--source --diagnose --vendor`를 각각 새 임시 프로필에서 한 번 비교했어요. vendor는 download-module CSS/JS 어댑터만 제거해요.
- 두 경우 모두 actual paused task DB 1개, `.slick-row` 0개예요. 모든 작업 필터(`filter_str="true"`)를 다시 선택해도 같았어요. 엔진 내부 필터 평가 함수까지 추적하지 않았어요.
- 어댑터: `#dy_tb` 328×479, `.slick-viewport`/`.grid-canvas` 328×478, display block. 원본: 625×507 / 625×506, display block. 0 높이 회귀는 아니에요.
- 두 경우 JS pageerror는 없고 콘솔 오류는 Chrono promo.json CORS/네트워크 실패만 각각 2회예요. 작업 행 누락과 인과관계는 확인되지 않았어요.
- 비교 증거: 어댑터 `C:/Users/Revaptor_FX/AppData/Local/Temp/be-manager-qRtCaa`, 원본 `C:/Users/Revaptor_FX/AppData/Local/Temp/be-manager-8YQC0E`.
- 결론: 원본에서도 재현되어 이번 UI 어댑터 회귀로 볼 근거가 없어요. 엔진 코드 원인 위치는 확정하지 않았고 원본 vendor·DB는 수정하지 않았어요. 요청된 독립 비교로 진단을 마쳐요.

- 상태: 준비 완료, 다음 명시 배정을 기다려요.
- 기준: `main`, `ae2dfd6`, 앱 버전 `1.2.49` (`package.json` 확인).
- 실제 Git 루트: `C:/Users/Revaptor_FX/Documents/Codex/2026-11-04/https-github-com-baegovda-bongextend-https/work/BongExtend`.
- 역할: 다운로더 목록, Chrono 연결, 저장 규칙, 영상 받기와 PC 영상 보조 프로그램을 배정된 범위에서만 맡아요.

## 확인한 담당 진입점

- `src/modules/downloads/`, `src/entrypoints/downloads/`, `src/modules/chrono-register.ts`
- `public/recent-downloads.{html,css,js}`, `public/download-module.{css,js}`, `public/video-downloader.{html,css,js}`
- `public/chrono-worker.js`, `public/js/chrono-action-bridge.js`, Chrono 원본 관리자·설정 파일
- `native/video/host.py`, `native/video/Launcher.cs`, `scripts/package-video-helper.ps1`

## 공유 경계와 상태

- 공유 파일 `src/entrypoints/background.ts`, 팝업 공통 셸, manifest·권한, `wxt.config.ts`, 버전·변경 기록은 총괄과 조정해요.
- `core.video:history`, `core.video:status`와 Chrono 출처·라이선스 표시는 보존해요.
- 사용자 실제 확장 ID 등록·네이티브 호스트 연결·영상 저장 성공은 아직 미검증으로 유지해요.
- 이번 초기 배정에서는 앱 코드 수정, 테스트, 빌드, 커밋, 푸시, 릴리스를 하지 않았어요.
- 작업 시작 전 상태에서 다른 작업자의 변경(`AGENTS.md`, `.cursor/agents/`, `.cursor/rules/module-team.mdc`, `docs/team/`)을 보존했어요.
