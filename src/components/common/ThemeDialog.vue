<script setup>
import { ref } from 'vue';
import Icon from '@/components/common/Icon.vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const colors = [
  { key: '#00d26a', label: '酷狗绿' },
  { key: '#2f80ed', label: '晴空蓝' },
  { key: '#7c5cff', label: '暮光紫' },
  { key: '#ff7043', label: '暖阳橙' },
  { key: '#e8436b', label: '樱花粉' },
];

const size = ref(app.settings.lyricSize);

function setColor(c) {
  app.updateSettings({ accent: c });
  app.applyAccent();
}

function set(patch) {
  app.updateSettings(patch);
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
  <el-dialog v-model="ui.showTheme" title="主题与音效" width="420" align-center append-to-body>
    <div class="block">
      <div class="label">主题色</div>
      <div class="colors">
        <button
          v-for="c in colors"
          :key="c.key"
          class="color"
          :class="{ active: (app.settings.accent || '#00d26a') === c.key }"
          :style="{ background: c.key }"
          :title="c.label"
          @click="setColor(c.key)"
        >
          <Icon v-if="(app.settings.accent || '#00d26a') === c.key" name="check" :size="13" color="#fff" />
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

    <div class="block row">
      <div class="label">深色模式</div>
      <el-switch :model-value="app.settings.appearance === 'dark'" @change="toggleDark" />
    </div>

    <div class="block row">
      <div class="label">
        液态玻璃
        <span class="value">{{ app.settings.glass ? '半透明毛玻璃' : '纯色界面' }}</span>
      </div>
      <el-switch :model-value="app.settings.glass" @change="set({ glass: $event })" />
    </div>

    <div class="block row">
      <div class="label">深色模式</div>
      <el-switch :model-value="app.settings.appearance === 'dark'" @change="toggleDark" />
    </div>

    <div class="block row">
      <div class="label">
        液态玻璃
        <span class="value">{{ app.settings.glass ? '半透明毛玻璃' : '纯色界面' }}</span>
      </div>
      <el-switch :model-value="app.settings.glass" @change="set({ glass: $event })" />
    </div>

    <div class="block row">
      <div class="label">显示歌词翻译</div>
      <el-switch :model-value="app.settings.showTranslation" @change="app.updateSettings({ showTranslation: $event })" />
    </div>

    <div class="block row">
      <div class="label">列表显示播放量</div>
      <el-switch :model-value="app.settings.showPlayCount" @change="app.updateSettings({ showPlayCount: $event })" />
    </div>

    <div class="tip">主题色、深色模式与液态玻璃都会立即生效，更多外观选项在「设置 → 外观与主题」。</div>
  </el-dialog>
</template>

<style scoped>
.block {
  margin-bottom: 18px;
}
.block.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label {
  font-size: 12.5px;
  color: var(--kg-text);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.value {
  font-size: 11px;
  color: var(--kg-text-3);
}
.colors {
  display: flex;
  gap: 10px;
}
.color {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  border: 2px solid transparent;
  transition: transform 0.15s ease;
}
.color:hover {
  transform: scale(1.06);
}
.color.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.12);
}
.tip {
  font-size: 11px;
  color: var(--kg-text-3);
  line-height: 1.6;
}
</style>
