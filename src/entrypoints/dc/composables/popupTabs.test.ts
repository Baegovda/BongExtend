import {describe, expect, test} from "bun:test";
import {isValidPopupTab, POPUP_TABS} from "./popupTabs";

describe("isValidPopupTab", () => {
    test("지금 있는 탭 id는 모두 복원돼요", () => {
        for (const item of POPUP_TABS) {
            expect(isValidPopupTab(item.id)).toBe(true);
        }
    });

    test("데이터 탭(6)은 탭 개수보다 작지 않아도 복원돼요", () => {
        expect(POPUP_TABS.length).toBe(6);
        expect(6 < POPUP_TABS.length).toBe(false);
        expect(isValidPopupTab(6)).toBe(true);
    });

    test("없는 id와 범위 밖 값은 복원하지 않아요", () => {
        expect(isValidPopupTab(5)).toBe(false);
        expect(isValidPopupTab(-1)).toBe(false);
        expect(isValidPopupTab(7)).toBe(false);
        expect(isValidPopupTab(1.5)).toBe(false);
        expect(isValidPopupTab(Number.NaN)).toBe(false);
    });
});
