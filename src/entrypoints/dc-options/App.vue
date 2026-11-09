<template>
  <div id="refresher-app" class="options-page refresher-app-shell">
    <BlockDialog
        :block-detect-mode-type-names="blockDetectModeTypeNames"
        :block-key-names="blockKeyNames"
        :current-block-type="currentBlockType"
        :form-data="blockFormData"
        :visible="showBlockDialog"
        @close="closeBlockDialog"
        @confirm="confirmAddBlock"
    />

    <div class="refresher-title-zone">
      <div class="be-title">
        <h3>디시 설정</h3>
        <span class="be-sub">디시인사이드 편의 기능</span>
      </div>
      <nav class="be-subnav float-right" aria-label="디시 설정 분류">
        <button
            v-for="tabItem in tabs"
            :key="tabItem.id"
            type="button"
            :aria-pressed="tab === tabItem.id"
            :class="{ active: tab === tabItem.id }"
            @click="() => (tab = tabItem.id)"
        >
          {{ tabItem.label }}
        </button>
      </nav>
      <p class="dc-flow-hint" role="status">{{ tab === 2 ? '차단할 대상을 추가하고, 목록에서 관리해요.' : tab === 3 ? '닉네임에 남길 메모를 추가하고 관리해요.' : tab === 6 ? '설정을 옮기기 전 먼저 백업해 주세요.' : '분류를 선택하고 필요한 기능을 조정해요.' }}</p>
    </div>

    <transition-group name="refresher-slide-left">
      <GeneralTab
          v-if="tab === 0"
          key="tab1"
      />
      <AdvancedTab
          v-else-if="tab === 1"
          key="tab2"
      />
      <BlockTab
          v-else-if="tab === 2"
          key="tab3"
      />
      <MemoTab
          v-else-if="tab === 3"
          key="tab4"
      />
      <ModuleTab
          v-else-if="tab === 4"
          key="tab5"
      />
      <DataTab
          v-else-if="tab === 6"
          key="tab7"
      />
    </transition-group>
  </div>
</template>

<script lang="ts" setup>
import {provide} from "vue";

import BlockDialog from "../dc/components/BlockDialog.vue";
import GeneralTab from "../dc/tabs/GeneralTab.vue";
import AdvancedTab from "../dc/tabs/AdvancedTab.vue";
import BlockTab from "../dc/tabs/BlockTab.vue";
import MemoTab from "../dc/tabs/MemoTab.vue";
import ModuleTab from "../dc/tabs/ModuleTab.vue";
import DataTab from "../dc/tabs/DataTab.vue";

import {useBlocks} from "../dc/composables/useBlocks";
import {useMemos} from "../dc/composables/useMemos";
import {useSettings} from "../dc/composables/useSettings";
import {useData} from "../dc/composables/useData";
import {usePopupTab} from "../dc/composables/usePopupTab";

const {tab, tabs} = usePopupTab();

const blocksComposable = useBlocks();
const memosComposable = useMemos();
const settingsComposable = useSettings();
const dataComposable = useData();

const {
  blockKeyNames,
  blockDetectModeTypeNames,
  currentBlockType,
  blockFormData,
  showBlockDialog,
  closeBlockDialog,
  confirmAddBlock
} = blocksComposable;

const {moveToModuleTab: moveToModuleTabRaw} = settingsComposable;

const moveToModuleTab = (moduleName: string) => {
  tab.value = 4;
  moveToModuleTabRaw(moduleName);
};

provide("blocks", blocksComposable);
provide("memos", memosComposable);
provide("settings", settingsComposable);
provide("data", dataComposable);
provide("updateUserSetting", settingsComposable.updateUserSetting);
provide("typeWrap", settingsComposable.typeWrap);
provide("moveToModuleTab", moveToModuleTab);
</script>

<style lang="scss" src="../dc/popup.scss"></style>

<style lang="scss">
/* options 페이지 전용 - popup 고정 크기/위치 제거 */
html, body {
  height: auto;
  min-height: 100vh;
  overflow-y: auto;
  margin: 0;
  padding: 0;
}

#refresher-app.options-page {
  width: 100% !important;
  height: auto !important;
  min-height: 100vh;
  max-width: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  overflow: visible;
  display: block;

  .refresher-title-zone {
    position: relative !important;
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
    padding: 24px 24px 12px !important;
    box-sizing: border-box;
    z-index: auto;
  }

  .tab {
    position: relative !important;
    width: 100% !important;
    max-width: 1040px;
    margin: 0 auto;
    padding: 20px 24px 40px !important;
    height: auto !important;
    box-sizing: border-box;
    overflow-y: visible;
  }

  @media (max-width: 600px) {
    .refresher-title-zone { padding: 16px 12px 10px !important; }
    .tab { padding: 12px 12px 28px !important; }
  }
}
</style>
