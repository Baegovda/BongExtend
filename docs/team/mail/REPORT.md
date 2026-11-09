# 메일 담당 준비 보고

- 역할: Gmail·네이버 메일 감지, 계정 표시, 메일 상세 UI, 알림음·OTP의 명시 배정을 처리해요.
- 기준: `main`, `ae2dfd6`, `package.json` 앱 버전 `1.2.49`이에요.
- 현재 작업 트리에는 팀 초기 준비 문서 관련 미커밋 변경이 있으며, 보존했어요.
- 메일 진입점: `src/modules/gmail/`, `src/entrypoints/gmail.content.ts`, `src/modules/naver-mail/`이에요.
- Checker Plus 연결: `public/checkerplus-popup.html`, `public/js/popup.js`, `public/js/background.js`, 계정 헬퍼예요.
- 자체 UI·컨텍스트: `public/checkerplus-embed.css`, `public/js/bongextend-mail-ui.js`, `bongextend-mail-reader.js`, 프로필·세션·작성 컨텍스트 파일이에요.
- 설정 화면: `src/entrypoints/popup/mail-settings.ts`, `src/entrypoints/popup/naver-mail.ts`예요.
- 공유 의존: `src/entrypoints/background.ts`, 팝업 공통 셸, 공통 테마·배지·설정 입출력, manifest·WXT·패키지·릴리스 파일은 총괄 소유예요.
- 공통 파일 변경이 필요하면 대상과 최소 변경안을 총괄에 먼저 보고해요.
- 이번 초기 배정에서는 앱 소스를 수정하지 않았고, 테스트·빌드·패키징·커밋·푸시·릴리스를 실행하지 않았어요.
- 로그인 계정, 개인 브라우저, 실메일, OTP, 키에는 접근하지 않았어요.
- 다음 총괄의 구체적인 목표와 허용 파일 범위를 기다려요.
