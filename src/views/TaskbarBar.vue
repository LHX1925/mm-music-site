<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useThemeSync } from '@/composables/useThemeSync';

useThemeSync();

const data = ref({ name: '', singer: '', cover: '', playing: false, lyric: '', nextLyric: '' });
let offs = [];
let timer = null;

const playing = computed(() => Boolean(data.value.playing));
/** 任务栏很矮时切紧凑排版（隐藏副标题、缩小封面） */
const short = ref(false);
function onResize() {
  short.value = window.innerHeight < 40;
}
const CREDIT = /^(作词|作曲|编曲|曲|词|制作人|监制|混音|母带|吉他|贝斯|鼓|和声|录音|发行|出品|OP|SP|统筹|企划)[：:]/;
const line = computed(() => {
  const l = String(data.value.lyric || '');
  if (l && !CREDIT.test(l)) return l;
  return data.value.name || '萌萌音乐';
});
const sub = computed(() => {
  const l = String(data.value.lyric || '');
  if (l && !CREDIT.test(l)) {
    return [data.value.name, data.value.singer].filter(Boolean).join(' · ');
  }
  return data.value.singer || '';
});

function cmd(c) {
  window.kg?.tray?.command(c);
}

/* 任务栏穿透：整条默认忽略鼠标事件（点击直接落到任务栏），
   只有指针停在按钮上时才接管，避免挡住开始菜单 / 任务栏图标 */
let ignoring = true;
function setIgnore(on) {
  if (on === ignoring) return;
  ignoring = on;
  window.kg?.bar?.interactive?.(!on);
}

function onMove(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  setIgnore(!el?.closest('button'));
}

function onLeave() {
  setIgnore(true);
}

function openMain() {
  window.kg?.tray?.action('show');
}

onMounted(async () => {
  if (!window.kg) return;
  document.body.style.background = 'transparent';
  onResize();
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseleave', onLeave);
  // 初始穿透，避免启动瞬间挡住任务栏
  window.kg?.bar?.interactive?.(false);
  const last = await window.kg.tray.get().catch(() => null);
  if (last && last.name) data.value = { ...data.value, ...last };
  offs.push(
    window.kg.on('tray:data', (p) => {
      if (p) data.value = { ...data.value, ...p };
    })
  );
  // 歌词定期刷新一次，避免长时间无事件
  timer = setInterval(async () => {
    const cur = await window.kg.tray.get().catch(() => null);
    if (cur && cur.name) data.value = { ...data.value, ...cur };
  }, 4000);
});

onBeforeUnmount(() => {
  offs.forEach((fn) => fn?.());
  clearInterval(timer);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('mousemove', onMove);
  document.removeEventListener('mouseleave', onLeave);
});
</script>

<template>
  <div class="bar" :class="{ short }">
    <button class="cover" title="打开萌萌音乐" @click="openMain">
      <CoverImage :src="data.cover" :size="short ? 26 : 34" :radius="short ? 7 : 9" :letter="data.name ? data.name.slice(0, 1) : ''" />
    </button>

    <div class="text" @click="openMain">
      <div class="line ellipsis">{{ line }}</div>
      <div v-if="sub && !short" class="sub ellipsis">{{ sub }}</div>
    </div>

    <div class="ctrls">
      <button class="btn" title="上一首" @click="cmd('prev')"><Icon name="prev" :size="short ? 13 : 15" /></button>
      <button class="btn play" :title="playing ? '暂停' : '播放'" @click="cmd('toggle')">
        <Icon :name="playing ? 'pause' : 'play'" :size="short ? 13 : 15" :filled="!playing" />
      </button>
      <button class="btn" title="下一首" @click="cmd('next')"><Icon name="next" :size="short ? 13 : 15" /></button>
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100vw;
  height: 100vh;
  padding: 0 8px;
  border-radius: 11px;
  /* 跟随主题：浅色主题是浅色毛玻璃，深色主题才是深色，避免糊一层「遮罩」 */
  background: rgba(252, 253, 255, 0.86);
  border: 1px solid rgba(15, 20, 30, 0.07);
  box-shadow: 0 8px 22px rgba(20, 26, 38, 0.16);
  backdrop-filter: blur(18px) saturate(1.6);
  -webkit-backdrop-filter: blur(18px) saturate(1.6);
  color: #14161a;
  overflow: hidden;
  user-select: none;
  transition: background 0.2s ease, color 0.2s ease;
}
html[data-theme='dark'] .bar {
  background: rgba(20, 22, 28, 0.88);
  border-color: rgba(255, 255, 255, 0.09);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
  color: #eceef3;
}
.cover {
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
.text {
  flex: 1;
  min-width: 0;
}
.line {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: inherit;
}
.sub {
  margin-top: 2px;
  font-size: 10.5px;
  color: #8b909b;
}
html[data-theme='dark'] .sub {
  color: rgba(255, 255, 255, 0.45);
}
.ctrls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.btn {
  width: 25px;
  height: 25px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #3f454f;
  background: rgba(15, 20, 30, 0.08);
  transition: background 0.14s ease, color 0.14s ease;
}
.btn:hover {
  background: rgba(15, 20, 30, 0.14);
  color: #14161a;
}
html[data-theme='dark'] .btn {
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.08);
}
html[data-theme='dark'] .btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}
.btn.play {
  background: var(--kg-accent);
  color: #fff;
}
.btn.play:hover {
  background: var(--kg-accent-dark);
  color: #fff;
  filter: brightness(1.04);
}
.bar.short {
  gap: 6px;
  padding: 0 6px;
}
.bar.short .cover {
  flex: 0 0 26px;
  width: 26px;
  height: 26px;
}
.bar.short .btn {
  width: 22px;
  height: 22px;
}
.bar.short .line {
  font-size: 12px;
}
</style>
