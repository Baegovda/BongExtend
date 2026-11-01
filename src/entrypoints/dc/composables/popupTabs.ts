export const POPUP_TABS = [
    {id: 0, label: "일반"},
    {id: 1, label: "고급"},
    {id: 2, label: "차단"},
    {id: 3, label: "메모"},
    {id: 4, label: "모듈"},
    {id: 6, label: "데이터"}
] as const;

export type PopupTabId = (typeof POPUP_TABS)[number]["id"];

const POPUP_TAB_IDS: ReadonlySet<number> = new Set(POPUP_TABS.map((item) => item.id));

// id가 0부터 빈칸 없이 이어지지 않는다. 데이터 탭은 6이라, 개수(6)보다 작은지만 보면 저장값을 버린다.
export const isValidPopupTab = (value: number): value is PopupTabId =>
    Number.isInteger(value) && POPUP_TAB_IDS.has(value);
