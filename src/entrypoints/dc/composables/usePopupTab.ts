import {ref, watch} from "vue";
import {popupLastTabStorage} from "@/storage/wxtStorage";
import {isValidPopupTab, POPUP_TABS, type PopupTabId} from "./popupTabs";

export {POPUP_TABS, isValidPopupTab};
export type {PopupTabId};

export const usePopupTab = () => {
    const tab = ref<PopupTabId>(0);

    void popupLastTabStorage.getValue().then((saved) => {
        if (isValidPopupTab(saved)) {
            tab.value = saved;
        }
    });

    watch(tab, (value) => {
        void popupLastTabStorage.setValue(value);
    });

    return {tab, tabs: POPUP_TABS};
};
