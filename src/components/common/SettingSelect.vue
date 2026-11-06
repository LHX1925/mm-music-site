<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  icon: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'change']);

const label = computed(() => {
  const hit = props.options.find((o) => o.value === props.modelValue);
  return hit ? hit.label : props.modelValue || props.placeholder;
});

function pick(v) {
  emit('update:modelValue', v);
  emit('change', v);
}
</script>

<template>
  <el-dropdown trigger="click" :disabled="disabled" max-height="280px" @command="pick">
    <button class="set-pill" :disabled="disabled">
      <Icon v-if="icon" :name="icon" :size="14" color="var(--kg-text-2)" />
      <span class="val">{{ label }}</span>
      <Icon name="arrow-right" :size="12" color="var(--kg-text-3)" class="chev" />
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="o in options" :key="String(o.value)" :command="o.value" :disabled="o.disabled">
          {{ o.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
