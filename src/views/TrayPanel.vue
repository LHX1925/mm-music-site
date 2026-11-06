<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useThemeSync } from '@/composables/useThemeSync';

useThemeSync();

const data = ref({
  name: '未在播放',
  singer: '',
  cover: '',
  playing: false,
  progress: 0,
  duration: 0,
  lyric: '',
  nextLyric: '',
  version: '',
});
const toast = ref('');
let toastTimer = null;
let offs = [];

const CREDIT = /^(作词|作曲|编曲|曲|词|制作人|监制|混音|母带|吉他|贝斯|鼓|和声|录音|发行|出品|OP|SP|统筹|企划)[：:]/;
const cleanLyric = computed(() => (CREDIT.test(String(data.value.lyric || '')) ? '' : data.value.lyric || ''));

const pct = computed(() => {
  const d = data.value.duration || 0;
  if (!d) return 0;
  return Math.min(100, Math.max(0, (data.value.progress / d) * 100));
});

const cur = computed(() => fmt(data.value.progress));
const total = computed(() => fmt(data.value.duration));

function fmt(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function flash(msg) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), 2000);
}

function cmd(c) {
  window.kg?.tray?.command(c);
}

async function act(name) {
  if (name === 'update') {
    const res = await window.kg?.tray?.action('update');
    flash(`当前已是最新版本 v${res?.version || data.value.version || '1.1.0'}`);
    return;
  }
  window.kg?.tray?.action(name);
}

function onKey(e) {
  if (e.code === 'Space') {
    e.preventDefault();
    cmd('toggle');
  } else if (e.code === 'ArrowRight' && e.ctrlKey) {
    cmd('next');
  } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
    cmd('prev');
  } else if (e.key === 'Escape') {
    window.kg?.tray?.action('close-panel');
  }
}

onMounted(async () => {
  if (!window.kg) return;
  document.body.style.background = 'transparent';
  const last = await window.kg.tray.get().catch(() => null);
  if (last && last.name) data.value = { ...data.value, ...last };
  offs.push(
    window.kg.on('tray:data', (payload) => {
      if (payload) data.value = { ...data.value, ...payload };
    })
  );
  window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  offs.forEach((fn) => fn?.());
  window.removeEventListener('keydown', onKey);
  clearTimeout(toastTimer);
});
</script>

<template>
  <div class="tray-panel">
    <!-- 歌曲信息 -->
    <div class="song-row">
      <div class="cover">
        <CoverImage :src="data.cover" :size="54" :radius="11" :letter="data.name ? data.name.slice(0, 1) : ''" />
      </div>
      <div class="meta">
        <div class="name ellipsis" :title="data.name">{{ data.name || '未在播放' }}</div>
        <div class="singer ellipsis">{{ data.singer || '萌萌音乐' }}</div>
      </div>
    </div>

    <!-- 进度 -->
    <div class="progress">
      <div class="bar"><i :style="{ width: pct + '%' }" /></div>
      <div class="times">
        <span>{{ cur }}</span>
        <span>{{ total }}</span>
      </div>
    </div>

    <!-- 歌词 -->
    <div class="lyric">
      <div class="lyric-cur ellipsis">{{ cleanLyric || (data.name ? '纯音乐，请欣赏' : '点一首歌开始吧') }}</div>
      <div class="lyric-next ellipsis">{{ data.nextLyric }}</div>
    </div>

    <!-- 播放控制 -->
    <div class="controls">
      <button class="ctl" title="上一首" @click="cmd('prev')">
        <Icon name="prev" :size="20" />
      </button>
      <button class="ctl play" :title="data.playing ? '暂停' : '播放'" @click="cmd('toggle')">
        <Icon :name="data.playing ? 'pause' : 'play'" :size="22" filled />
      </button>
      <button class="ctl" title="下一首" @click="cmd('next')">
        <Icon name="next" :size="20" />
      </button>
    </div>

    <div class="divider" />

    <!-- 菜单 -->
    <div class="menu">
      <button class="item" @click="act('update')">
        <span class="ico"><Icon name="refresh" :size="15" /></span>
        <span class="label">检查更新</span>
      </button>
      <button class="item" @click="act('relaunch')">
        <span class="ico"><Icon name="power" :size="15" /></span>
        <span class="label">重启应用</span>
      </button>
      <button class="item" @click="act('toggle-window')">
        <span class="ico"><Icon name="fullscreen" :size="15" /></span>
        <span class="label">显示 / 隐藏</span>
        <span class="key">Ctrl + Shift + S</span>
      </button>
      <button class="item danger" @click="act('quit')">
        <span class="ico"><Icon name="logout" :size="15" /></span>
        <span class="label">退出程序</span>
        <span class="key">Ctrl + Q</span>
      </button>
    </div>

    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.tray-panel {
  position: relative;
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  padding: 13px 12px 10px;
  border-radius: 14px;
  /* 跟随主题：浅色为浅色玻璃，深色为深色玻璃，不再是一层固定的黑遮罩 */
  background: rgba(253, 254, 255, 0.9);
  border: 1px solid rgba(15, 20, 30, 0.07);
  box-shadow: 0 16px 40px rgba(20, 26, 38, 0.18);
  color: #14161a;
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  transition: background 0.2s ease, color 0.2s ease;
}
html[data-theme='dark'] .tray-panel {
  background: rgba(21, 23, 29, 0.92);
  border-color: rgba(255, 255, 255, 0.09);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.5);
  color: #eceef3;
}
.song-row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 0 4px;
}
.cover {
  width: 54px;
  height: 54px;
  border-radius: 11px;
  overflow: hidden;
  flex: 0 0 54px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
}
.meta {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: inherit;
}
.singer {
  margin-top: 3px;
  font-size: 11px;
  color: #868c98;
}
html[data-theme='dark'] .singer {
  color: rgba(255, 255, 255, 0.5);
}

.progress {
  margin-top: 11px;
  padding: 0 4px;
}
.bar {
  height: 3px;
  border-radius: 99px;
  background: rgba(15, 20, 30, 0.08);
  overflow: hidden;
}
html[data-theme='dark'] .bar {
  background: rgba(255, 255, 255, 0.14);
}
.bar i {
  display: block;
  height: 100%;
  background: var(--kg-accent);
  border-radius: 99px;
  transition: width 0.25s linear;
}
.times {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10.5px;
  color: #9aa0ab;
  font-variant-numeric: tabular-nums;
}
html[data-theme='dark'] .times {
  color: rgba(255, 255, 255, 0.45);
}

.lyric {
  margin: 8px 4px 0;
  min-height: 30px;
}
.lyric-cur {
  font-size: 11.5px;
  color: #3d434d;
  font-weight: 600;
}
html[data-theme='dark'] .lyric-cur {
  color: rgba(255, 255, 255, 0.88);
}
.lyric-next {
  margin-top: 3px;
  font-size: 11px;
  color: #a8aeba;
}
html[data-theme='dark'] .lyric-next {
  color: rgba(255, 255, 255, 0.35);
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
}
.ctl {
  width: 54px;
  height: 42px;
  border-radius: 12px;
  background: rgba(15, 20, 30, 0.05);
  color: #4b515c;
  display: grid;
  place-items: center;
  transition: background 0.15s ease, transform 0.1s ease;
}
html[data-theme='dark'] .ctl {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}
.ctl:hover {
  background: rgba(15, 20, 30, 0.09);
}
html[data-theme='dark'] .ctl:hover {
  background: rgba(255, 255, 255, 0.14);
}
.ctl:active {
  transform: scale(0.96);
}
.ctl.play {
  background: var(--kg-accent);
  color: #fff;
  box-shadow: 0 8px 22px rgba(var(--kg-accent-rgb), 0.28);
}
.ctl.play:hover {
  filter: brightness(1.06);
}

.divider {
  height: 1px;
  background: rgba(15, 20, 30, 0.07);
  margin: 11px 6px;
}
html[data-theme='dark'] .divider {
  background: rgba(255, 255, 255, 0.08);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow: hidden;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 8px;
  border-radius: 10px;
  color: inherit;
  transition: background 0.14s ease;
}
.item:hover {
  background: rgba(15, 20, 30, 0.05);
}
html[data-theme='dark'] .item:hover {
  background: rgba(255, 255, 255, 0.07);
}
.ico {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(15, 20, 30, 0.05);
  color: #5d636e;
  display: grid;
  place-items: center;
  flex: 0 0 26px;
}
html[data-theme='dark'] .ico {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.label {
  flex: 1;
  text-align: left;
  font-size: 12.5px;
  font-weight: 600;
}
.key {
  font-size: 9.5px;
  color: #9aa0ab;
  border: 1px solid rgba(15, 20, 30, 0.12);
  border-radius: 6px;
  padding: 3px 7px;
}
html[data-theme='dark'] .key {
  color: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.14);
}
.item.danger .label {
  color: #e5484d;
}
.item.danger .ico {
  background: rgba(229, 72, 77, 0.12);
  color: #e5484d;
}
.item.danger:hover {
  background: rgba(229, 72, 77, 0.1);
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  padding: 7px 14px;
  border-radius: 8px;
  background: rgba(15, 20, 30, 0.82);
  font-size: 11.5px;
  color: #fff;
  white-space: nowrap;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
