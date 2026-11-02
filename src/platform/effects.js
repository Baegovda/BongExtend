// 탭을 열거나 네트워크로 보내는 일은 이 객체로만 한다. 테스트는 가짜를 넣는다.

export const createChromeEffects = (chromeApi = globalThis.chrome, fetchImpl = globalThis.fetch.bind(globalThis)) => ({
    tabsCreate: (options) => chromeApi.tabs.create(options),
    tabsQuery: (query) => chromeApi.tabs.query(query),
    fetch: (url, init) => fetchImpl(url, init),
    sendMessage: (message) => chromeApi.runtime.sendMessage(message),
    getURL: (path) => chromeApi.runtime.getURL(path),
    getManifest: () => chromeApi.runtime.getManifest(),
    runtimeId: () => chromeApi.runtime.id,
    storageGet: (keys) => chromeApi.storage.local.get(keys),
    storageSet: (items) => chromeApi.storage.local.set(items),
    storageOnChanged: (listener) => chromeApi.storage.onChanged.addListener(listener),
    permissionsRequest: (permissions) => chromeApi.permissions.request(permissions),
    permissionsRemove: (permissions) => chromeApi.permissions.remove(permissions)
});

export const createFakeEffects = () => {
    const calls = {tabsCreate: 0, tabsQuery: 0, fetch: 0, sendMessage: 0, storageGet: 0, storageSet: 0, permissionsRequest: 0, permissionsRemove: 0};
    const effects = {
        tabsCreate: async (options) => { calls.tabsCreate += 1; return {id: 1, ...options}; },
        tabsQuery: async () => { calls.tabsQuery += 1; return [{id: 1, url: "https://example.com/page", active: true}]; },
        fetch: async (url) => {
            calls.fetch += 1;
            return {ok: true, status: 200, url, json: async () => ({date: "2026-11-02", krw: {usd: 0.0007}})};
        },
        sendMessage: async (message) => { calls.sendMessage += 1; return {ok: true, message}; },
        getURL: (path) => `chrome-extension://test${path}`,
        getManifest: () => ({version: "1.1.3"}),
        runtimeId: () => "test",
        storageGet: async () => { calls.storageGet += 1; return {}; },
        storageSet: async () => { calls.storageSet += 1; },
        storageOnChanged: () => {},
        permissionsRequest: async () => { calls.permissionsRequest += 1; return true; },
        permissionsRemove: async () => { calls.permissionsRemove += 1; }
    };
    return {effects, calls};
};
