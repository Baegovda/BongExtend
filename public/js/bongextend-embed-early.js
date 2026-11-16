// BongExtend: 메일 탭 안에 들어간 메일 화면은 첫 화면을 그리기 전에 앱 테마를 입혀요.
// 예전에는 페이지가 다 불러와진 뒤(load)에 테마를 붙여서, 그 사이 원래 메일 앱의 흰 화면이 잠깐 보였어요.
// <head> 맨 앞에서 동기로 실행돼요. 따로 연 창(메일 탭 밖)에서는 아무것도 하지 않아요.
(() => {
	let embedded = false;
	try {
		embedded = window.top !== window && new URLSearchParams(location.search).get("source") === "bongextend";
	} catch (error) {}
	if (!embedded) return;
	const root = document.documentElement;
	root.classList.add("bongextend-checkerplus-embedded");
	try {
		// 앱(바깥 팝업)이 정한 밝은/어두운 모드를 그대로 따라요.
		root.style.colorScheme = getComputedStyle(window.parent.document.documentElement).colorScheme;
	} catch (error) {}
	// 파서가 넣은 스타일시트라서 다 불러올 때까지 첫 화면을 그리지 않아요(흰 화면이 끼지 않음).
	document.write('<link rel="stylesheet" href="/theme/theme.css"><link rel="stylesheet" href="/checkerplus-embed.css">');
})();
