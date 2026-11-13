<script setup>
import { computed, ref, watch } from 'vue';
import Icon from '@/components/common/Icon.vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { ACCENT_THEMES, resolveAccent } from '@/utils/themeColors';

const app = useAppStore();
const ui = useUiStore();

const active = computed(() => resolveAccent(app.settings.accent));
const size = ref(app.settings.lyricSize);

watch(
  () => app.settings.lyricSize,
  (v) => {
    size.value = v;
  }
);

function setColor(key) {
  app.updateSettings({ accent: key });
  app.applyAccent();
}

function toggleDark(v) {
  app.updateSettings({ appearance: v ? 'dark' : 'light' });
  app.applyAppearance();
  app.applyAccent();
}

function applySize(v) {
  app.updateSettings({ lyricSize: v });
}
</script>

<template>
  <el-dialog v-model="ui.showTheme" title="主题与音效" width="440" align-center append-to-body class="theme-dialog">
    <div class="block">
      <div class="label">
        主题色
        <span class="value">{{ active.label }}</span>
      </div>
      <div class="theme-grid">
        <button
          v-for="t in ACCENT_THEMES"
          :key="t.key"
          class="theme-item"
          :class="{ active: active.key === t.key }"
          :title="t.label"
          @click="setColor(t.key)"
        >
          <span class="theme-swatch" :style="{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)` }">
            <Icon v-if="active.key === t.key" name="check" :size="13" color="#fff" />
          </span>
          <span class="theme-name">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <div class="block">
      <div class="label">
        歌词字号
        <span class="value">{{ size }}px</span>
      </div>
      <el-slider :model-value="size" :min="18" :max="40" :step="1" @input="size = $event" @change="applySize" />
    </div>

    <div class="rows">
      <div class="row">
        <span class="row-label">深色模式</span>
        <el-switch :model-value="app.settings.appearance === 'dark'" @change="toggleDark" />
      </div>
      <div class="row">
        <span class="row-label">
          液态玻璃
          <i>{{ app.settings.glass ? '半透明毛玻璃' : '纯色界面' }}</i>
        </span>
        <el-switch :model-value="app.settings.glass" @change="app.updateSettings({ glass: $event })" />
      </div>
      <div class="row">
        <span class="row-label">显示歌词翻译</span>
        <el-switch
          :model-value="app.settings.showTranslation"
          @change="app.updateSettings({ showTranslation: $event })"
        />
      </div>
      <div class="row">
        <span class="row-label">列表显示播放量</span>
        <el-switch
          :model-value="app.settings.showPlayCount"
          @change="app.updateSettings({ showPlayCount: $event })"
        />
      </div>
    </div>

    <div class="tip">所有改动即时生效；背景、字体等更多选项在「设置 → 外观与主题」。</div>
  </el-dialog>
</template>

<style scoped>
.block + .block {
  margin-top: 18px;
}
.label {
  font-size: 12.5px;
  color: var(--kg-text);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.value {
  font-size: 11px;
  font-weight: 400;
  color: var(--kg-text-3);
}
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}
.theme-item {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 40px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--kg-line-2);
  background: var(--kg-panel-2);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.theme-item:hover {
  border-color: var(--kg-accent);
}
.theme-item.active {
  border-color: var(--kg-accent);
  background: var(--kg-accent-soft);
}
.theme-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex: 0 0 22px;
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.theme-name {
  font-size: 11.5px;
  color: var(--kg-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.theme-item.active .theme-name {
  color: var(--kg-text);
  font-weight: 600;
}
.rows {
  margin-top: 18px;
  border-top: 1px solid var(--kg-line);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--kg-line);
}
.row:last-child {
  border-bottom: none;
}
.row-label {
  font-size: 12.5px;
  color: var(--kg-text);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row-label i {
  font-style: normal;
  font-size: 10.5px;
  color: var(--kg-text-3);
}
.tip {
  margin-top: 14px;
  font-size: 11px;
  color: var(--kg-text-3);
  line-height: 1.6;
}
</style>
