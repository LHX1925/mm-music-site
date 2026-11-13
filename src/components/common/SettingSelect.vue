<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  icon: { type: String, default: '' },
  /** 下拉顶部的分组标题，例如「选择音质」 */
  title: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'change']);

const label = computed(() => {
  const hit = props.options.find((o) => String(o.value) === String(props.modelValue));
  return hit ? hit.label : props.modelValue || props.placeholder;
});

function isCurrent(o) {
  return String(o.value) === String(props.modelValue);
}

function pick(v) {
  emit('update:modelValue', v);
  emit('change', v);
}
</script>

<template>
  <el-dropdown trigger="click" :disabled="disabled" max-height="320px" @command="pick">
    <button class="set-pill" :disabled="disabled">
      <Icon v-if="icon" :name="icon" :size="14" color="var(--kg-text-2)" />
      <span class="val">{{ label }}</span>
      <Icon name="arrow-right" :size="12" color="var(--kg-text-3)" class="chev" />
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <div v-if="title" class="set-menu-title">{{ title }}</div>
        <el-dropdown-item
          v-for="o in options"
          :key="String(o.value)"
          :command="o.value"
          :disabled="o.disabled"
          :class="{ 'is-current': isCurrent(o) }"
        >
          <Icon v-if="isCurrent(o)" name="check" :size="13" class="set-menu-check" />
          <span v-else class="set-menu-check" />
          <span class="set-menu-label">{{ o.label }}</span>
          <span v-if="o.tag" class="set-menu-tag">{{ o.tag }}</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.set-menu-title {
  padding: 4px 10px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--kg-text-3);
  border-bottom: 1px solid var(--kg-line);
  margin-bottom: 5px;
}
.set-menu-check {
  width: 13px;
  flex: 0 0 13px;
  display: inline-flex;
  align-items: center;
  color: var(--kg-accent-dark);
}
.set-menu-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.set-menu-tag {
  flex: 0 0 auto;
  font-size: 10px;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  color: var(--kg-gold);
  background: var(--kg-gold-soft);
  border: 1px solid var(--kg-gold-line);
}
</style>
