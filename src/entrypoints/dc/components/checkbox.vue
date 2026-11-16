<template>
  <div
      :class="{ disabled }"
      :data-on="isOn"
      class="refresher-checkbox"
      @click="toggle"
  >
    <div
        :style="transformStyle"
        class="selected"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerout="handlePointerOut"
        @pointerup="handlePointerUp"
    />
  </div>
</template>

<script lang="ts" setup>
import {computed, ref, watch} from "vue";

interface Props {
  modelValue?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [value: boolean];
}>();

const isOn = ref(props.modelValue);
const isDown = ref(false);
const translateX = ref<number | undefined>(undefined);
const onceOut = ref(false);

watch(() => props.modelValue, (newValue) => {
  isOn.value = newValue;
});

const transformStyle = computed(() => ({
  transform: `translateX(${translateX.value ?? (isOn.value ? 20 : 0)}px)`
}));

const toggle = () => {
  if (props.disabled) return;

  if (onceOut.value) {
    onceOut.value = false;
    return;
  }

  isOn.value = !isOn.value;
  emit("update:modelValue", isOn.value);
  emit("change", isOn.value);
};

const handlePointerMove = (ev: PointerEvent) => {
  if (props.disabled || !isDown.value) return;
  translateX.value = Math.max(0, Math.min(20, Math.ceil(ev.offsetX)));
};

const handlePointerDown = () => {
  if (!props.disabled) isDown.value = true;
};

const handlePointerUp = () => {
  if (props.disabled) return;
  isDown.value = false;
  translateX.value = undefined;
};

const handlePointerOut = () => {
  if (props.disabled || !isDown.value) return;
  isDown.value = false;
  translateX.value = undefined;
  toggle();
  onceOut.value = true;
};
</script>

<style lang="scss" scoped>
.refresher-checkbox {
  background: var(--be-control-bg, #e0e0e0);
  box-shadow: inset 0 0 0 1px var(--be-control-border, transparent);
  border-radius: 999px;
  cursor: pointer;
  display: flex;
  flex: 0 0 auto;
  height: 26px;
  position: relative;
  transition: background-color 150ms ease-out;
  width: 46px;

  &[data-on="true"] {
    background: var(--be-switch-gradient, #4c8afe);
    box-shadow: none;
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .selected {
    background-color: white;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    cursor: grab;
    height: 20px;
    left: 3px;
    position: absolute;
    top: 3px;
    transition: transform 150ms ease-out;
    width: 20px;

    &:active {
      cursor: grabbing;
    }
  }


}

@media (prefers-color-scheme: dark) {
  .refresher-checkbox {
    .selected {
      background-color: #ffffff;
    }
  }
}
</style>