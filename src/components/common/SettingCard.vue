<script setup>
import Icon from './Icon.vue';

defineProps({
  icon: { type: String, default: 'settings' },
  title: { type: String, default: '' },
  help: { type: String, default: '' },
  span: { type: Boolean, default: false },
});
</script>

<template>
  <section class="set-card" :class="{ span }">
    <header class="set-head">
      <Icon :name="icon" :size="16" color="var(--kg-accent)" />
      <span class="set-title">{{ title }}</span>
      <el-tooltip v-if="help" :content="help" placement="top" effect="dark" popper-class="set-tip">
        <span class="set-help">?</span>
      </el-tooltip>
    </header>
    <div class="set-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.set-card {
  background: var(--kg-card, #fff);
  border: 1px solid var(--kg-line);
  border-radius: 14px;
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  backdrop-filter: blur(12px);
}
.set-card.span {
  grid-column: span 2;
}
.set-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.set-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--kg-text);
  flex: 1;
  min-width: 0;
}
.set-help {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--kg-line-2);
  color: var(--kg-text-2);
  font-size: 10px;
  display: grid;
  place-items: center;
  cursor: help;
  font-weight: 700;
}
.set-body {
  min-width: 0;
}

/* 统一控件样式：胶囊按钮 / 开关 */
:deep(.set-pill) {
  width: 100%;
  height: 38px;
  border-radius: 10px;
  background: var(--kg-panel);
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  font-size: 12.5px;
  color: var(--kg-text);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
:deep(.set-pill:hover) {
  background: var(--kg-hover);
  border-color: var(--kg-line-2);
}
:deep(.set-pill .val) {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.set-pill .chev) {
  color: var(--kg-text-3);
}
:deep(.set-switch) {
  width: 100%;
  height: 38px;
  border-radius: 10px;
  background: var(--kg-panel);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12.5px;
  color: var(--kg-text);
}
:deep(.set-switch.on) {
  color: var(--kg-text);
}
:deep(.set-switch .track) {
  width: 38px;
  height: 20px;
  border-radius: 10px;
  background: #d9dce2;
  position: relative;
  transition: background 0.18s ease;
  flex: 0 0 38px;
}
:deep(.set-switch .track::after) {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--kg-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.18s ease;
}
:deep(.set-switch.on .track) {
  background: var(--kg-accent);
}
:deep(.set-switch.on .track::after) {
  transform: translateX(18px);
}
:deep(.set-hint) {
  font-size: 11px;
  color: var(--kg-text-3);
  line-height: 1.5;
  margin-top: 8px;
}
</style>
