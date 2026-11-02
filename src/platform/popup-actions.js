// 팝업이 밖에서 하는 일. effects 를 바꾸면 테스트에서 실제 브라우저를 부르지 않는다.

export const openUrl = (effects, url) => effects.tabsCreate({url});

export const loadJson = async (effects, url) => {
    const response = await effects.fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
};

export const sendExtension = (effects, message) => effects.sendMessage(message);

export const gmailAct = (effects, account, thread, action) =>
    effects.sendMessage({type: "gmail-act", account, thread, action});
