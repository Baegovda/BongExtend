// 파일 열기 권한은 해당 동작을 누를 때만 요청해요.
(() => {
    const nativeOpen = chrome.downloads.open?.bind(chrome.downloads);
    if (!nativeOpen) return;
    let canOpen = false;
    chrome.permissions.contains({permissions: ["downloads.open"]}).then(value => {canOpen = value;});
    chrome.downloads.open = (id, callback) => {
        if (canOpen) return nativeOpen(id, callback);
        return chrome.permissions.request({permissions: ["downloads.open"]}).then(granted => {
            if (!granted) throw new Error("파일 열기 권한을 허용해 주세요.");
            canOpen = true;
            return nativeOpen(id, callback);
        });
    };
})();
