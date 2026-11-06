<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  onLabel: { type: String, default: '打开' },
  offLabel: { type: String, default: '关闭' },
  icon: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change']);

function toggle() {
  const next = !props.modelValue;
  emit('update:modelValue', next);
  emit('change', next);
}
</script>

<template>
  <button class="set-switch" :class="{ on: modelValue }" type="button" @click="toggle">
    <span class="txt">{{ modelValue ? onLabel : offLabel }}</span>
    <i class="track" />
  </button>
</template>
