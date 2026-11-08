BongExtend Windows 영상 다운로드 보조 프로그램

1. Python 3.10 이상이 설치되어 있어야 해요.
2. BongExtend의 다운로더 → 동영상 받기 → 연결 파일 받기를 눌러요.
3. 이 ZIP을 풀고 install.cmd를 실행해요. 관리자 권한은 필요하지 않아요.
4. BongExtend로 돌아가 연결 확인을 눌러요.

설치 위치: %LOCALAPPDATA%\BongExtend\video-helper
다운로드 위치: 사용자 다운로드 폴더\BongExtend
Chrome을 완전히 종료하면 진행 중인 작업도 중단돼요.

공식 배포처에서 공개 SHA256을 확인하고 yt-dlp, FFmpeg를 설치해요.
Node가 없으면 Deno도 설치해요. 각 도구에는 원래 라이선스가 적용돼요.
https://github.com/yt-dlp/yt-dlp (Unlicense; Windows 실행 파일의 종속성은 해당 프로젝트 안내 참고)
https://github.com/yt-dlp/FFmpeg-Builds (GPL 배포 구성)
https://github.com/denoland/deno (MIT)

BongExtend 보조 프로그램: GPL-3.0-only, 동봉 LICENSE 참고
전체 소스와 빌드 스크립트: https://github.com/Baegovda/BongExtend/tree/main/native/video

세로 탭 기능: 치지직의 활성 Chrome 창에서만 Ctrl+Shift+L을 전달해요. 창을 활성화하거나 이동하지 않아요. 이미 접힌 상태가 확인되면 건너뛰고, 사용자가 다른 키를 누르는 중이면 입력하지 않아요. 이 기능을 사용하려면 이번 보조 프로그램으로 다시 설치해 주세요.
