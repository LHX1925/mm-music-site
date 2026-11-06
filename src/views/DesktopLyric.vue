<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from '@/components/common/Icon.vue';
import { LYRIC_COLORS, addLyricFav, readLyricCfg, saveLyricCfg } from '@/utils/desktopLyric';
import { useThemeSync } from '@/composables/useThemeSync';

const { mode } = useThemeSync();

const data = ref({ text: '萌萌音乐 · 桌面歌词', tr: '', next: '', song: '', singer: '', playing: false });
const locked = ref(false);
const topmost = ref(true);
const hover = ref(false);
const cfg = ref(readLyricCfg());
const colorOpen = ref(false);
const toast = ref('');
let toastTimer = null;
let offs = [];

const playing = computed(() => Boolean(data.value.playing));
const vertical = computed(() => cfg.value.direction === 'vertical');
const fontSize = computed(() => Number(cfg.value.size) || 30);
const textColor = computed(() => cfg.value.color || (mode.value === 'dark' ? '#ffffff' : '#171a20'));
/** 动画 key：整行文本变化时重新挂载，触发上跳动画 */
const lineKey = computed(() => `${data.value.song}_${data.value.text}`);

function flash(msg) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), 1600);
}

function patch(p) {
  cfg.value = saveLyricCfg(p);
  if ('direction' in p) {
    window.kg?.lyric?.resize?.({ mode: cfg.value.direction === 'vertical' ? 'vertical' : 'horizontal' });
  }
}

function setFont(step) {
  patch({ size: Math.min(72, Math.max(16, fontSize.value + step)) });
}

function setColor(c) {
  patch({ color: c });
  colorOpen.value = false;
}

function toggleSingle() {
  patch({ single: !cfg.value.single });
}

function toggleDirection() {
  patch({ direction: vertical.value ? 'horizontal' : 'vertical' });
}

function toggleAnimate() {
  patch({ animate: !cfg.value.animate });
}

function toggleLock() {
  locked.value = !locked.value;
  window.kg?.lyric.ignoreMouse(locked.value);
}
function toggleTop() {
  topmost.value = !topmost.value;
  window.kg?.lyric.topmost(topmost.value);
}
function command(cmd) {
  window.kg?.lyric.command(cmd);
}
function favorite() {
  if (!data.value.text) return;
  addLyricFav({ song: data.value.song, singer: data.value.singer, text: data.value.text });
  flash('已收藏这句歌词');
}
function close() {
  window.kg?.lyric.close();
}

function onStorage(e) {
  if (!e.key || e.key === 'kg-desktop-lyric-cfg') cfg.value = readLyricCfg();
}

onMounted(() => {
  if (!window.kg) return;
  document.body.style.background = 'transparent';
  window.kg.lyric.resize({ mode: vertical.value ? 'vertical' : 'horizontal' });
  offs.push(
    window.kg.on('lyric:data', (payload) => {
      if (!payload) return;
      data.value = { ...data.value, ...payload };
      if (payload.cfg) cfg.value = { ...cfg.value, ...payload.cfg };
    }),
    window.kg.on('lyric:unlocked', () => {
      locked.value = false;
    }),
    window.kg.on('lyric:config', (next) => {
      if (!next) return;
      cfg.value = { ...cfg.value, ...next };
      if (next.direction) {
        window.kg?.lyric?.resize?.({ mode: next.direction === 'vertical' ? 'vertical' : 'horizontal' });
      }
    })
  );
  window.addEventListener('storage', onStorage);
  offs.push(() => window.removeEventListener('storage', onStorage));
});

onBeforeUnmount(() => {
  offs.forEach((fn) => fn?.());
  clearTimeout(toastTimer);
});
</script>

<template>
  <div
    class="lyric-window"
    :class="{ locked, hover, vertical, single: cfg.single }"
    @mouseenter="hover = true"
    @mouseleave="hover = false; colorOpen = false"
  >
    <!-- 拖拽层：空白处按住即可移动窗口 -->
    <div class="drag-layer" />

    <div class="topbar">
      <span class="song ellipsis">
        <Icon name="note" :size="12" />
        {{ data.song || '未在播放' }}<template v-if="data.singer"> · {{ data.singer }}</template>
      </span>

      <div class="tools">
        <button class="tool" title="上一首" @click="command('prev')"><Icon name="prev" :size="14" /></button>
        <button class="tool main" :title="playing ? '暂停' : '播放'" @click="command('toggle')">
          <Icon :name="playing ? 'pause' : 'play'" :size="14" />
        </button>
        <button class="tool" title="下一首" @click="command('next')"><Icon name="next" :size="14" /></button>
        <span class="divider" />
        <button class="tool" title="缩小歌词" @click="setFont(-2)"><Icon name="minus" :size="14" /></button>
        <span class="fs">{{ fontSize }}</span>
        <button class="tool" title="放大歌词" @click="setFont(2)"><Icon name="plus" :size="14" /></button>
        <span class="divider" />
        <span class="color-wrap">
          <button class="tool" title="歌词字体颜色" @click="colorOpen = !colorOpen">
            <i class="color-dot" :style="{ background: textColor }" />
          </button>
          <transition name="pop">
            <div v-if="colorOpen" class="color-pop">
              <button
                v-for="c in LYRIC_COLORS"
                :key="c.value"
                class="swatch"
                :class="{ on: textColor === c.value }"
                :style="{ background: c.value }"
                :title="c.label"
                @click="setColor(c.value)"
              />
              <button class="swatch auto" title="跟随主题" @click="setColor('')">自动</button>
            </div>
          </transition>
        </span>
        <button class="tool" :class="{ on: cfg.single }" :title="cfg.single ? '显示翻译与下一句' : '单行歌词'" @click="toggleSingle">
          <Icon name="list" :size="14" />
        </button>
        <button class="tool" :class="{ on: vertical }" :title="vertical ? '切回横排' : '竖排歌词（竖屏）'" @click="toggleDirection">
          <Icon name="fullscreen" :size="14" />
        </button>
        <button class="tool" :class="{ on: cfg.animate }" :title="cfg.animate ? '关闭歌词跳跃动画' : '开启歌词跳跃动画'" @click="toggleAnimate">
          <Icon name="fire" :size="14" />
        </button>
        <button class="tool" title="收藏这句歌词" @click="favorite"><Icon name="heart" :size="14" /></button>
        <span class="divider" />
        <button class="tool" :class="{ on: topmost }" :title="topmost ? '已置顶，点击取消' : '置顶显示'" @click="toggleTop">
          <Icon name="top" :size="14" />
        </button>
        <button class="tool" :class="{ on: locked }" :title="locked ? '解锁（Ctrl+Alt+L）' : '锁定：鼠标穿透，不挡操作'" @click="toggleLock">
          <Icon :name="locked ? 'unlock' : 'lock'" :size="14" />
        </button>
        <button class="tool danger" title="关闭桌面歌词" @click="close">
          <Icon name="close-small" :size="14" />
        </button>
      </div>
    </div>

    <div class="line-wrap">
      <transition :name="cfg.animate ? 'jump' : 'fade'" mode="out-in">
        <div class="main-line" :key="lineKey" :style="{ fontSize: fontSize + 'px', color: textColor }">{{ data.text }}</div>
      </transition>
      <div v-if="data.tr && !cfg.single" class="tr-line">{{ data.tr }}</div>
      <div v-if="data.next && !cfg.single" class="next-line">{{ data.next }}</div>
    </div>

    <transition name="fade">
      <div v-if="toast" class="fav-toast">{{ toast }}</div>
    </transition>

    <div v-if="locked" class="lock-hint">已锁定，按 Ctrl + Alt + L 解锁</div>
  </div>
</template>

<style scoped>
.lyric-window {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 34px 26px 14px;
  border-radius: 16px;
  /* 跟随主题的玻璃底，避免在浅色桌面糊成一块黑 */
  background: rgba(255, 255, 255, 0.34);
  backdrop-filter: blur(18px) saturate(1.5);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 12px 34px rgba(20, 26, 38, 0.16);
  overflow: hidden;
  user-select: none;
  position: relative;
  transition: background 0.2s ease;
}
html[data-theme='dark'] .lyric-window {
  background: rgba(12, 14, 19, 0.46);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.42);
}
.lyric-window.hover {
  background: rgba(255, 255, 255, 0.52);
}
html[data-theme='dark'] .lyric-window.hover {
  background: rgba(12, 14, 19, 0.6);
}
.lyric-window.locked {
  background: rgba(255, 255, 255, 0.18);
  border-color: transparent;
  box-shadow: none;
}
html[data-theme='dark'] .lyric-window.locked {
  background: rgba(12, 14, 19, 0.28);
}
.drag-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  -webkit-app-region: drag;
}
.topbar {
  position: absolute;
  top: 6px;
  left: 14px;
  right: 10px;
  height: 26px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 2;
  -webkit-app-region: no-drag;
}
.song {
  font-size: 11px;
  color: #6f7684;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  pointer-events: none;
}
html[data-theme='dark'] .song {
  color: rgba(255, 255, 255, 0.62);
}
.tools {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 5px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(15, 20, 30, 0.06);
  opacity: 0.5;
  transition: opacity 0.16s ease, background 0.16s ease;
}
html[data-theme='dark'] .tools {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.1);
}
.lyric-window:hover .tools {
  opacity: 1;
}
.tool {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #4b515c;
  -webkit-app-region: no-drag;
  transition: background 0.14s ease, transform 0.12s ease, color 0.14s ease;
}
html[data-theme='dark'] .tool {
  color: #fff;
}
.tool:hover {
  background: rgba(15, 20, 30, 0.1);
}
html[data-theme='dark'] .tool:hover {
  background: rgba(255, 255, 255, 0.22);
}
.tool:active {
  transform: scale(0.92);
}
.tool.main {
  background: rgba(15, 20, 30, 0.08);
}
html[data-theme='dark'] .tool.main {
  background: rgba(255, 255, 255, 0.2);
}
.tool.on {
  background: var(--kg-accent);
  color: #fff;
}
.tool.danger:hover {
  background: rgba(229, 72, 77, 0.9);
  color: #fff;
}
.divider {
  width: 1px;
  height: 12px;
  background: rgba(120, 127, 140, 0.3);
  margin: 0 3px;
}
.fs {
  font-size: 10px;
  color: #6f7684;
  width: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
html[data-theme='dark'] .fs {
  color: rgba(255, 255, 255, 0.7);
}
.color-wrap {
  position: relative;
  display: flex;
}
.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(150, 158, 172, 0.7);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5) inset;
}
.color-pop {
  position: absolute;
  top: 26px;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  padding: 9px;
  border-radius: 10px;
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
  box-shadow: 0 12px 30px rgba(15, 20, 30, 0.18);
  z-index: 9;
}
.swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(120, 127, 140, 0.35);
}
.swatch.on {
  box-shadow: 0 0 0 2px var(--kg-accent);
}
.swatch.auto {
  grid-column: span 4;
  width: 100%;
  height: 20px;
  border-radius: 6px;
  font-size: 10px;
  color: var(--kg-text-2);
  background: var(--kg-panel);
}

.line-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  overflow: hidden;
}
.main-line {
  font-weight: 700;
  text-align: center;
  line-height: 1.35;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
  letter-spacing: 0.5px;
  pointer-events: none;
  word-break: break-word;
  max-width: 100%;
  white-space: pre-wrap;
}
.tr-line {
  margin-top: 4px;
  font-size: 14px;
  color: #5c636e;
  text-align: center;
  text-shadow: 0 1px 8px rgba(255, 255, 255, 0.5);
  pointer-events: none;
}
html[data-theme='dark'] .tr-line {
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
}
.next-line {
  margin-top: 8px;
  font-size: 13px;
  color: #8a9099;
  text-align: center;
  pointer-events: none;
}
html[data-theme='dark'] .next-line {
  color: rgba(255, 255, 255, 0.4);
}
.lock-hint {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  font-size: 10.5px;
  color: #6f7684;
  pointer-events: none;
}
html[data-theme='dark'] .lock-hint {
  color: rgba(255, 255, 255, 0.55);
}
.fav-toast {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(15, 20, 30, 0.78);
  color: #fff;
  font-size: 11px;
  z-index: 5;
}

/* 竖排（竖屏）模式 */
.lyric-window.vertical {
  padding: 40px 10px 16px;
  align-items: center;
  justify-content: flex-start;
}
.lyric-window.vertical .topbar {
  flex-direction: column;
  height: auto;
  right: 6px;
  left: 6px;
  gap: 6px;
}
.lyric-window.vertical .song {
  display: none;
}
.lyric-window.vertical .tools {
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  border-radius: 12px;
}
.lyric-window.vertical .line-wrap {
  flex: 1;
  justify-content: center;
  /* 竖排时工具栏会折成两三行，给它留出足够高度，避免歌词被盖住 */
  margin-top: 116px;
}
.lyric-window.vertical .main-line {
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 2px;
  max-height: 100%;
  line-height: 1.25;
}
.lyric-window.vertical .tr-line,
.lyric-window.vertical .next-line {
  display: none;
}

/* 歌词跳跃动画：新的一句从下方弹入，旧的一句向上淡出 */
.jump-enter-active {
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease;
}
.jump-leave-active {
  transition: transform 0.2s ease, opacity 0.18s ease;
  position: absolute;
}
.jump-enter-from {
  transform: translateY(60%) scale(0.96);
  opacity: 0;
}
.jump-leave-to {
  transform: translateY(-55%) scale(0.96);
  opacity: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}
</style>
