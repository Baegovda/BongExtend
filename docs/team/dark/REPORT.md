# 네이버 다크 모드 작업 보고

- 기준: main `170575a`, 앱 `1.2.49`예요. 총괄의 기존 변경을 보존했어요.
- 변경: `src/modules/dark/site-fixes.js`, 해당 단위 시험, `scripts/verify-naver-dark-browser.cjs`, 새 `scripts/verify-naver-note-dark-browser.cjs`예요.
- 공개 메인 CSS `https://pm.pstatic.net/resources/css/main.4ea4a5b1.css`에서 MyView 프로필 설정/이전·다음과 SettingView 고정 버튼이 단색 sprite pseudo-element임을 확인했어요.
- 해당 아이콘만 밝게 하고 계정 닉네임/탭/쪽지 링크, 날씨 위치/시간/설명의 중립 글자색을 한정 보정했어요. 사진·브랜드·날씨 그림·상태색은 일괄 반전하지 않아요.
- 공식 원본 `https://github.com/darkreader/darkreader/blob/main/src/config/dynamic-theme-fixes.config`에는 검색 페이지 보정만 있고 쪽지 전용 보정은 없었어요.
- 쪽지 공개 접근은 nid.naver.com 로그인 페이지로 이동했어요. 로그인·개인 쪽지 열람/전송/읽음 변경은 하지 않았어요.
- 사진만으로 실제 중앙 누락 원인을 확정하지 못했어요. note 전용 proxy 예외나 display/visibility 강제는 추가하지 않았어요.
- 수정 전 합성 note: 일반 문서/URL iframe은 배경 rgb(24,26,27), sync 있음, fallback CSS 빈 문자열, hidden은 계속 display:none이었어요.
- 수정 전 합성 srcdoc: hostname 빈 문자열, sync 없음, 흰 배경을 재현했어요. 실제 쪽지가 해당 프레임을 쓰는지는 미확인이에요.
- 초기 fixture의 전체 미적용은 wildcard 시험 권한 불일치와 등록 대기를 수정해 해소했어요. 제품 결함으로 오인하지 않아요.
- 공유 통합: 총괄이 frame-host helper, `dark.content.ts`, background CSS sender.origin 처리를 완료했다고 전달했어요. 담당은 해당 공유 파일을 직접 수정하지 않았어요.
- 새 note 검사는 일반URL/srcdoc/about:blank 테마 적용·본문 visibility·hidden 유지·끄기 복원을 assert하도록 정리했어요. 총괄이 1.2.50 빌드에서 note/CSP 최종 검사를 실행 중이며 결과는 총괄 기록이 기준이에요.
- 실행한 검사: 관련 단위 7개 통과, build 1회 통과, 실제 Chrome 공개 네이버 검사 통과, 수정 전 note 합성 진단 통과예요.
- UI 직접 확인: `C:/Users/REVAPT~1/AppData/Local/Temp/be-naver-dark-nzESK8/naver-account-fixture-dark.png` (공개 메인+합성 계정)이에요.
- 같은 폴더의 `naver-dark.png`는 합성 계정 추가 후 새로고침한 공개 메인 최종 화면이에요. 두 이미지는 담당 변경 당시 1.2.49 빌드 증거예요.
- 수정 전 프레임 증거: `C:/Users/REVAPT~1/AppData/Local/Temp/be-note-dark-aNeVEj/note-synthetic-dark.png`예요. 한글 인코딩이 깨져 새 fixture에 utf-8을 명시했어요. 최종 검사 시 새 캡처 경로가 출력돼요.
- 개인 브라우저/계정은 사용하지 않았어요. 버전·CHANGELOG·커밋·푸시·배포는 수행하지 않았어요.
- 남은 한계: 실제 로그인 쪽지 빈 화면 해결 완료는 미확인이에요. 마지막 정리는 보고서만 수정했으며 추가 코드 변경·빌드·중복 검사는 하지 않았어요.

## 총괄 최종 통합 검증

- 1.2.50: frame-host helper와 content 진입점에서 srcdoc/blank의 상위 사이트 설정을 적용했고, CSS 중계는 Chrome sender.origin을 검증해요.
- 전체 시험 238개·타입 검사·ZIP·eval·권한 검사, strict CSP 검사 통과예요. 공개 메인 검사는 위 담당 증거를 재사용했어요.
- 최종 합성 쪽지 검사에서 URL/srcdoc/blank 본문과 글자 대비, srcdoc 외부 CSS 중계, 숨김 유지, 모드 해제 복원이 통과했어요. inline-only 문서는 sync 스타일 존재 대신 실제 테마와 계산된 색으로 검사해요.
- 총괄이 직접 확인한 최종 화면: `C:/Users/Revaptor_FX/AppData/Local/Temp/be-note-dark-hsq3No/note-synthetic-dark.png`.
- 실제 로그인 쪽지 전체 원인·수신 목록의 정상 로딩은 여전히 미확인이에요. 개인 계정에는 접근하지 않았어요.
