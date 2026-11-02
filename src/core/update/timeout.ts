// 업데이트 확인이 네트워크나 죽은 서비스 워커에서 영원히 기다리지 않게 한다.

export const UPDATE_FETCH_TIMEOUT_MS = 15_000;
export const UPDATE_UI_TIMEOUT_MS = 20_000;
export const UPDATE_TIMEOUT_MESSAGE = "업데이트 확인이 너무 오래 걸려 멈췄어요. 잠시 후 다시 시도해 주세요.";
export const UPDATE_UNREACHABLE_MESSAGE = "확장 프로그램이 응답하지 않아요. chrome://extensions 에서 BongExtend를 새로고침한 뒤 다시 눌러 주세요.";
export const UPDATE_UNKNOWN_MESSAGE = "업데이트 정보를 가져오지 못했어요.";

export const isTimeoutError = (error: unknown): boolean => {
    const name = error instanceof Error ? error.name : "";
    return name === "TimeoutError" || name === "AbortError";
};

export const promiseWithTimeout = <T>(promise: Promise<T>, ms: number, message = UPDATE_TIMEOUT_MESSAGE): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
};

export const describeUpdateError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : "";
    if (/Receiving end does not exist|Could not establish connection|message port closed/i.test(message)) {
        return UPDATE_UNREACHABLE_MESSAGE;
    }
    return message || UPDATE_UNKNOWN_MESSAGE;
};
