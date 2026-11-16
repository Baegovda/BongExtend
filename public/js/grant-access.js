"use strict";

function closeWindow() {
    setTimeout(() => {
        document.body.append(getMessage("done"), createBR(), createBR(), `이제 이 창을 닫아도 돼요.`);

        try {
            window.close();
        } catch (error) {
            console.warn("couldn't close window: ", error);
        }
    }, 500);
}

(async () => {
    await initUI();

    byId("email-account").textContent = getUrlValue("email");

    onClick("#grant-access", async function () {
        const tokenResponse = await requestPermission({
            email: getUrlValue("email"),
            useGoogleAccountsSignIn: true
        });

        if (tokenResponse) {
            await sendMessageToBG("initOauthHybridAccount", {tokenResponse: tokenResponse});
            hideLoading();
            try {
                await BongExtendCheckerPlusAction.openPopup();
            } catch (error) {
                console.error("error opening popup", error);
                // for firefox cause it requires a user gesture
                await niceAlert("확장 아이콘을 눌러 메일 창을 열어 주세요.");
                BongExtendCheckerPlusAction.openPopup();
            }
            await niceAlert("눌러서 이 창을 닫아 주세요.", true);
            closeWindow();
        }
    });

})();