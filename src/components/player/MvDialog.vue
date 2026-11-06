<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import Icon from '@/components/common/Icon.vue';
import { mvOfSong, mvStream, videoUrl } from '@/api';
import { useAppStore } from '@/stores/app';
import { usePlayerStore } from '@/stores/player';
import { useUiStore } from '@/stores/ui';
import { formatDuration } from '@/utils/format';

const app = useAppStore();
const ui = useUiStore();
const player = usePlayerStore();

const list = ref([]);
const active = ref(null);
const url = ref('');
const loading = ref(false);
const playing = ref(false);
const videoEl = ref(null);
const errorMsg = ref('');
/** 右下角小窗模式 */
const mini = ref(false);

watch(
  mini,
  (v) => {
    document.body.classList.toggle('mv-mini-mode', v);
  },
  { immediate: false }
);

function toggleMini() {
  mini.value = !mini.value;
}

/** 系统级画中画：窗口可以拖到任意位置，包括右下角 */
async function togglePip() {
  const v = videoEl.value;
  if (!v) return;
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await v.requestPictureInPicture();
  } catch {
    errorMsg.value = '当前环境不支持画中画，可以试试「小窗」';
  }
}

function fullscreen() {
  const v = videoEl.value;
  if (!v) return;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else v.requestFullscreen?.().catch(() => {});
}

onBeforeUnmount(() => {
  document.body.classList.remove('mv-mini-mode');
});

const song = computed(() => ui.mvSong || {});
const title = computed(() => song.value.name || 'MV');
const total = computed(() => list.value.length);
const poster = computed(() => active.value?.thumb || active.value?.hdpic || song.value.coverBig || song.value.cover || '');

function pic(u) {
  return String(u || '').replace('{size}', '400');
}

function formatWan(n) {
  const v = Number(n) || 0;
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)} 亿`;
  if (v >= 10000) return `${(v / 10000).toFixed(1)} 万`;
  return String(v);
}

/** 看 MV 时把正在播放的歌曲暂停，避免两个音源叠在一起 */
function pauseSong() {
  if (player.playing) player.pause();
}

async function load() {
  list.value = [];
  active.value = null;
  url.value = '';
  errorMsg.value = '';
  pauseSong();
  if (!song.value?.albumAudioId && !song.value?.mvHash) {
    errorMsg.value = '这首歌暂时没有 MV';
    return;
  }
  loading.value = true;
  try {
    const res = await mvOfSong(song.value.albumAudioId, app.platform).catch(() => []);
    list.value = (Array.isArray(res) ? res : []).map((m) => ({
      ...m,
      videoId: m.video_id || m.videoId,
      name: m.mv_name || song.value.name,
      thumb: pic(m.thumb || m.hdpic),
      hdpic: pic(m.hdpic),
      duration: Number(m.duration || 0) / 1000,
      playTimes: Number(m.play_times || m.hit || 0),
      remark: m.remark || '',
      publishTime: m.publish_time || '',
    }));
    active.value = list.value[0] || null;
    await play();
  } finally {
    loading.value = false;
  }
}

async function play(item = null) {
  if (item) active.value = item;
  url.value = '';
  playing.value = false;
  errorMsg.value = '';
  pauseSong();
  const target = active.value;
  // 优先按 video_id 取（列表接口不给 hash）；再退回歌曲自带的 MvHash
  if (target?.videoId) {
    const res = await mvStream(target.videoId, app.platform).catch(() => ({ url: '' }));
    if (res.url) {
      url.value = res.url;
      return;
    }
  }
  if (song.value.mvHash) {
    try {
      const data = await videoUrl(song.value.mvHash, app.platform);
      const item2 = data?.[String(song.value.mvHash).toLowerCase()] || Object.values(data || {})[0] || {};
      const u = item2.downurl || (Array.isArray(item2.backupdownurl) ? item2.backupdownurl[0] : '');
      if (u) {
        url.value = u;
        return;
      }
    } catch {}
  }
  errorMsg.value = '这个 MV 暂时拿不到播放地址';
}

function toggle() {
  const v = videoEl.value;
  if (!v) return;
  if (v.paused) v.play().catch(() => {});
  else v.pause();
}

function stop() {
  try {
    videoEl.value?.pause();
    videoEl.value && (videoEl.value.currentTime = 0);
  } catch {}
}

watch(
  () => [ui.showMv, ui.mvSong?.hash],
  ([open]) => {
    if (open) load();
    else {
      stop();
      list.value = [];
      url.value = '';
      mini.value = false;
    }
  }
);
</script>

<template>
  <el-dialog
    v-model="ui.showMv"
    :width="mini ? 360 : 880"
    :modal="!mini"
    :show-close="!mini"
    :lock-scroll="!mini"
    :close-on-click-modal="false"
    align-center
    append-to-body
    :class="['mv-dialog', { 'mv-mini': mini }]"
    @closed="stop"
  >
    <template #header>
      <div class="mv-head">
        <span class="mv-head-title ellipsis">{{ active?.name || title }}</span>
        <span class="mv-badge">MV</span>
        <span class="mv-head-sub ellipsis">{{ active?.singer || song.singer }}</span>
      </div>
    </template>

    <div class="mv-body">
      <div class="stage">
        <video
          v-if="url"
          ref="videoEl"
          :src="url"
          :poster="poster"
          controls
          autoplay
          playsinline
          @play="playing = true; pauseSong()"
          @pause="playing = false"
          @error="errorMsg = '视频加载失败，换个版本试试'"
        />
        <div v-else class="placeholder" v-loading="loading">
          <Icon name="mv" :size="36" color="rgba(255,255,255,.5)" />
          <span>{{ loading ? '正在查找 MV…' : errorMsg || '暂无可用 MV' }}</span>
        </div>
      </div>

      <div class="mv-info">
        <img v-if="poster" class="mv-thumb" :src="poster" alt="" />
        <div class="mv-meta">
          <div class="mv-name">
            <span class="ellipsis">{{ active?.name || song.name }}</span>
            <span v-if="active?.remark" class="mv-remark ellipsis">· {{ active.remark }}</span>
          </div>
          <div class="mv-sub">
            <span>歌手：{{ active?.singer || song.singer || '-' }}</span>
            <span v-if="active?.publishTime">发布：{{ String(active.publishTime).slice(0, 10) }}</span>
            <span v-if="active?.duration">时长：{{ formatDuration(active.duration) }}</span>
            <span v-if="active?.playTimes">播放：{{ formatWan(active.playTimes) }}</span>
          </div>
        </div>
        <div class="mv-actions">
          <button class="act" @click="toggle">
            <Icon :name="playing ? 'pause' : 'play'" :size="14" />
            {{ playing ? '暂停' : '播放' }}
          </button>
          <button class="act" :class="{ on: mini }" :title="mini ? '恢复正常窗口' : '缩成右下角小窗'" @click="toggleMini">
            <Icon name="restore" :size="14" />
            {{ mini ? '放大' : '小窗' }}
          </button>
          <button class="act" title="系统画中画（可拖到右下角置顶）" @click="togglePip">
            <Icon name="display" :size="14" />
            画中画
          </button>
          <button v-if="!mini" class="act" title="全屏" @click="fullscreen">
            <Icon name="fullscreen" :size="14" />
          </button>
          <button v-if="mini" class="act" @click="ui.showMv = false">
            <Icon name="close-small" :size="14" />
          </button>
          <button v-else class="act" @click="ui.showMv = false">
            <Icon name="close-small" :size="14" />
            关闭
          </button>
        </div>
      </div>

      <div v-if="list.length > 1" class="mv-versions">
        <span class="ver-label">相关版本（{{ total }}）</span>
        <button
          v-for="(m, i) in list"
          :key="m.videoId || i"
          class="ver"
          :class="{ on: active?.videoId === m.videoId }"
          :title="m.name + (m.remark ? ` · ${m.remark}` : '')"
          @click="play(m)"
        >
          {{ m.remark || m.name || `版本 ${i + 1}` }}
        </button>
      </div>

      <div v-if="!list.length && !loading && !errorMsg" class="mv-empty">
        这首歌暂无 MV，去酷狗客户端看看？
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:global(body .el-dialog.mv-dialog) {
  background: #ffffff !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-radius: 14px;
  padding: 0 0 16px;
  overflow: hidden;
}
:global(body[data-theme='dark'] .el-dialog.mv-dialog) {
  background: #14161c !important;
}
:global(.el-dialog.mv-dialog .el-dialog__header) {
  padding: 14px 18px 10px;
  margin-right: 0;
}
:global(.el-dialog.mv-dialog .el-dialog__body) {
  padding: 0 18px;
}
.mv-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.mv-head-title {
  font-size: 14px;
  font-weight: 600;
  max-width: 46%;
}
.mv-badge {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--kg-accent-dark);
  border: 1px solid rgba(var(--kg-accent-rgb), 0.42);
  border-radius: 3px;
  padding: 0 3px;
  line-height: 13px;
}
.mv-head-sub {
  font-size: 11.5px;
  color: var(--kg-text-3);
  min-width: 0;
}
.mv-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stage {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #0b0d12;
  border-radius: 10px;
  overflow: hidden;
  display: grid;
  place-items: center;
}
.stage video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  display: block;
}
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  width: 100%;
  height: 100%;
  justify-content: center;
}
.mv-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
}
.mv-thumb {
  width: 64px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex: 0 0 64px;
  background: var(--kg-panel);
}
.mv-meta {
  flex: 1;
  min-width: 0;
}
.mv-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  min-width: 0;
}
.mv-remark {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--kg-text-3);
  max-width: 200px;
}
.mv-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 5px;
}
.mv-actions {
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
}
.act {
  height: 30px;
  padding: 0 12px;
  border-radius: 15px;
  border: 1px solid var(--kg-line-2);
  background: var(--kg-surface);
  color: var(--kg-text-2);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.act:hover {
  color: var(--kg-accent-dark);
  border-color: var(--kg-accent);
}
.mv-versions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.ver-label {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.ver {
  max-width: 220px;
  height: 26px;
  padding: 0 10px;
  border-radius: 13px;
  background: var(--kg-panel);
  font-size: 11.5px;
  color: var(--kg-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ver.on {
  background: var(--kg-accent-soft);
  color: var(--kg-accent-dark);
  font-weight: 600;
}
.mv-empty {
  font-size: 12px;
  color: var(--kg-text-3);
  padding: 6px 2px;
}

/* ---------------- 右下角小窗 ---------------- */
/* 小窗模式下遮罩层不再挡鼠标，主窗口可以继续操作 */
:global(body.mv-mini-mode .el-overlay) {
  pointer-events: none;
  background: transparent !important;
}
:global(body .el-dialog.mv-mini) {
  position: fixed !important;
  right: 18px !important;
  bottom: 104px !important;
  top: auto !important;
  left: auto !important;
  margin: 0 !important;
  width: 360px !important;
  padding: 0 0 10px;
  border-radius: 12px;
  overflow: hidden;
  pointer-events: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  z-index: 3000;
}
:global(body .el-dialog.mv-mini .el-dialog__header) {
  padding: 8px 10px 6px;
}
:global(body .el-dialog.mv-mini .el-dialog__body) {
  padding: 0 10px;
}
:global(body .el-dialog.mv-mini .mv-head-title) {
  font-size: 12.5px;
  max-width: 72%;
}
:global(body .el-dialog.mv-mini .mv-head-sub) {
  display: none;
}
:global(body .el-dialog.mv-mini .mv-body) {
  gap: 0;
}
:global(body .el-dialog.mv-mini .stage) {
  border-radius: 8px;
}
:global(body .el-dialog.mv-mini .mv-thumb),
:global(body .el-dialog.mv-mini .mv-meta),
:global(body .el-dialog.mv-mini .mv-versions),
:global(body .el-dialog.mv-mini .mv-empty) {
  display: none;
}
:global(body .el-dialog.mv-mini .mv-info) {
  padding: 6px 2px 0;
  background: transparent;
  border: none;
}
:global(body .el-dialog.mv-mini .mv-actions) {
  width: 100%;
  justify-content: space-between;
}
:global(body .el-dialog.mv-mini .act) {
  height: 26px;
  padding: 0 9px;
  font-size: 11.5px;
}
.act.on {
  color: var(--kg-accent-dark);
  border-color: var(--kg-accent);
  background: var(--kg-accent-soft);
}
</style>
