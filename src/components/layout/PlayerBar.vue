<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import Icon from '@/components/common/Icon.vue';
import ProgressSlider from '@/components/common/ProgressSlider.vue';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { useAppStore } from '@/stores/app';
import { useVipStore } from '@/stores/vip';
import { useSongActions } from '@/composables/useSongActions';
import { songFlagsOf } from '@/utils/songFlags';

const player = usePlayerStore();
const library = useLibraryStore();
const ui = useUiStore();
const app = useAppStore();
const vip = useVipStore();
const { openAddToPlaylist } = useSongActions();
const router = useRouter();

const volumeOpen = ref(false);
const dragging = ref(false);
const dragValue = ref(0);
const volPercent = computed(() => (player.muted ? 0 : Math.round(player.volume * 100)));

/** 音量竖向拖动：只有按住滑块才改音量，点按钮本身只负责开合浮层 */
function volRatio(e, el) {
  const rect = el.getBoundingClientRect();
  return Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / rect.height));
}

function onVolDown(e) {
  const el = e.currentTarget;
  player.setVolume(volRatio(e, el));
  const move = (ev) => player.setVolume(volRatio(ev, el));
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

const cover = computed(() => player.current?.cover || '');
const liked = computed(() => library.isFavorite(player.current));

const progressValue = computed({
  get: () => (dragging.value ? dragValue.value : player.progress),
  set: (v) => (dragValue.value = v),
});

function onSeekEnd(v) {
  dragging.value = false;
  player.seek(v);
}

function toArtist() {
  const id = player.current?.singerIds?.[0];
  if (id) router.push(`/artist/${id}`);
}

/** 点歌名：搜这首歌的相关内容 */
function searchSong() {
  const s = player.current;
  if (!s?.name) return;
  const kw = [s.name, s.singer].filter(Boolean).join(' ').trim();
  router.push({ name: 'search', query: { keywords: kw } });
}

function openFull() {
  if (player.current) ui.showPlayer = true;
}

function openComments() {
  if (!player.current) return;
  ui.commentSong = player.current;
  ui.showComments = true;
}

function toggleDesktopLyric() {
  app.updateSettings({ showDesktopLyric: !app.settings.showDesktopLyric });
}

/** 跳到高潮（副歌）起点 */
function toClimax() {
  const c = player.climax;
  if (!c) return;
  player.seek(c.start + 0.2);
}

function toggleTaskbarLyric() {
  app.updateSettings({ showTaskbarLyric: !app.settings.showTaskbarLyric });
}

/** 一键看 MV：无论列表里有没有 mvHash，都交给 MV 面板自动探测 */
function openMv() {
  if (!player.current) return;
  ui.openMv(player.current);
}

function closeVolume(e) {
  if (!e.target.closest?.('.vol-wrap')) volumeOpen.value = false;
}

onMounted(() => document.addEventListener('click', closeVolume));
onBeforeUnmount(() => document.removeEventListener('click', closeVolume));

/** 和设置页保持同一套档位：蝰蛇三档需要超级 VIP，取不到音源时播放器会自动降级 */
const qualityOptions = [
  { key: '128', label: '标准音质', desc: '128kbps' },
  { key: '320', label: '高品音质', desc: '320kbps' },
  { key: 'flac', label: '无损音质', desc: 'FLAC' },
  { key: 'high', label: 'Hi-Res', desc: '24bit' },
  { key: 'viper_clear', label: '蝰蛇超清', desc: '超级VIP', vip: true },
  { key: 'viper_atmos', label: '蝰蛇全景声', desc: '超级VIP', vip: true },
  { key: 'viper_tape', label: '蝰蛇母带', desc: '超级VIP', vip: true },
];

/** 蝰蛇三档需要超级 VIP：没有时只提示、不切换音质 */
function onQuality(key) {
  const opt = qualityOptions.find((o) => o.key === key);
  if (opt?.vip && !vip.hasPremium) {
    ElMessage.warning('蝰蛇音质需要超级 VIP，当前账号暂不支持');
    return;
  }
  player.setQuality(key);
}
</script>

<template>
  <footer class="playerbar">
    <div class="p-left">
      <div class="cover" :class="{ playing: player.playing }" title="点击进入歌词页" @click="openFull">
        <img v-if="cover" :src="cover" alt="" />
        <div v-else class="cover-empty"><Icon name="note" :size="18" color="#b6bbc4" /></div>
      </div>
      <!-- 「歌名 - 歌手」单行 + 下面一行放徽标和操作：
           徽标不再插在歌名后面，窄窗口也不会把歌名挤成一个「我…」 -->
      <div class="meta">
        <div class="title-row">
          <span
            class="song-name"
            :title="player.current?.name ? `点击搜索「${player.current.name}」` : ''"
            @click="searchSong"
          >{{ player.current?.name || '听我想听' }}</span>
          <span
            v-if="player.current?.singer"
            class="song-singer"
            :title="player.current.singer"
            @click="toArtist"
          > - {{ player.current.singer }}</span>
        </div>
        <div class="sub-row">
          <template v-if="player.current">
            <span v-if="songFlagsOf(player.current).isOriginal" class="badge-orig" title="原创作品">原创</span>
            <span v-if="songFlagsOf(player.current).isVip" class="badge-vip" title="VIP 专享">VIP</span>
            <span v-if="songFlagsOf(player.current).hasMv" class="mv-tag" title="有 MV">MV</span>
            <span v-if="player.trial" class="trial-tag">试听</span>
          </template>
          <div class="quick-actions">
            <button class="mini-btn" :class="{ liked }" title="喜欢" @click="library.toggleFavorite(player.current)">
              <Icon name="heart" :size="15" :filled="liked" :color="liked ? 'var(--kg-accent)' : 'currentColor'" />
            </button>
            <button class="mini-btn" title="添加到歌单" @click="openAddToPlaylist(player.current)">
              <Icon name="plus" :size="15" />
            </button>
            <button class="mini-btn comment-btn" title="评论" @click="openComments">
              <Icon name="comment" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="p-center">
      <div class="controls">
        <button class="ctl" :title="player.playModeLabel" @click="player.setMode()">
          <Icon :name="player.mode === 'single' ? 'repeat-one' : player.mode === 'shuffle' ? 'shuffle' : 'repeat'" :size="16" />
        </button>
        <button class="ctl" title="上一首" @click="player.prev()"><Icon name="prev" :size="17" /></button>
        <button class="ctl play-btn" :title="player.playing ? '暂停' : '播放'" @click="player.toggle()">
          <Icon v-if="player.loading" name="refresh" :size="18" class="spin" />
          <Icon v-else :name="player.playing ? 'pause' : 'play'" :size="19" />
        </button>
        <button class="ctl" title="下一首" @click="player.next()"><Icon name="next" :size="17" /></button>
        <button class="ctl" title="播放列表" @click="ui.showQueue = !ui.showQueue"><Icon name="list" :size="16" /></button>
      </div>
      <div class="progress-row">
        <span class="time">{{ player.progressText }}</span>
        <ProgressSlider
          v-model="progressValue"
          :max="player.duration || player.current?.duration || 0"
          :buffered="player.buffered"
          :disabled="!player.current"
          :climax="player.climax"
          @dragstart="dragging = true; dragValue = player.progress"
          @change="onSeekEnd"
        />
        <span class="time">{{ player.durationText }}</span>
      </div>
    </div>

    <div class="p-right">
      <div class="vol-wrap">
        <button class="ctl vol-trigger" :title="player.muted ? '已静音，点击恢复' : '音量'" @click.stop="volumeOpen = !volumeOpen">
          <Icon :name="player.muted || player.volume === 0 ? 'volume-mute' : 'volume'" :size="16" />
          <span class="vol-text">{{ volPercent }}</span>
        </button>
        <transition name="pop">
          <div v-if="volumeOpen" class="vol-pop" @click.stop>
            <button class="vol-mute" :title="player.muted ? '取消静音' : '静音'" @click="player.toggleMute()">
              <Icon :name="player.muted ? 'volume-mute' : 'volume'" :size="14" />
            </button>
            <div class="vol-slider" @pointerdown="onVolDown">
              <div class="vol-rail">
                <div class="vol-fill" :style="{ height: volPercent + '%' }" />
                <i class="vol-knob" :style="{ bottom: `calc(${volPercent}% - 6px)` }" />
              </div>
            </div>
            <span class="vol-num">{{ volPercent }}%</span>
          </div>
        </transition>
      </div>

      <el-dropdown class="opt" trigger="click" @command="player.setRate">
        <button class="rate-btn">{{ player.rate === 1 ? '倍速' : `${player.rate}x` }}</button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="r in [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]" :key="r" :command="r">
              {{ r === 1 ? '正常速度' : `${r}x` }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-dropdown trigger="click" @command="onQuality">
        <button class="quality-btn">{{ player.qualityLabel }}</button>
        <template #dropdown>
          <el-dropdown-menu class="quality-menu">
            <el-dropdown-item
              v-for="(q, i) in qualityOptions"
              :key="q.key"
              :command="q.key"
              :divided="i === 4"
              :class="{ 'is-current': q.key === player.quality }"
            >
              <div class="q-item">
                <Icon v-if="q.key === player.quality" name="check" :size="13" />
                <span class="q-label">{{ q.label }}</span>
                <span class="q-desc" :class="{ vip: q.vip }">{{ q.desc }}</span>
              </div>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <button
        v-if="player.climax"
        class="climax-btn opt"
        title="跳到高潮"
        @click="toClimax"
      >
        高潮
      </button>

      <button
        class="ctl"
        :class="{ on: app.settings.showDesktopLyric }"
        :title="app.settings.showDesktopLyric ? '关闭桌面歌词' : '开启桌面歌词'"
        @click="toggleDesktopLyric"
      >
        <span class="word">词</span>
      </button>
      <button
        class="ctl"
        :class="{ on: app.settings.showTaskbarLyric, off: !app.settings.showTaskbarLyric }"
        :title="app.settings.showTaskbarLyric ? '关闭任务栏歌词' : '开启任务栏歌词'"
        @click="toggleTaskbarLyric"
      >
        <Icon name="lyricbar" :size="17" />
      </button>
      <button class="ctl mv-btn" title="一键观看 MV" :disabled="!player.current" @click="openMv">
        <Icon name="mv" :size="17" />
      </button>
      <button class="ctl" title="播放队列" @click="ui.showQueue = true"><Icon name="queue" :size="17" /></button>
    </div>
  </footer>
</template>

<style scoped>
.playerbar {
  /* 用 flex 而不是带最小宽的 grid：窗口变窄时左右两侧先收缩文字，
     不会再出现「初始化时中间进度条被挤掉」的情况 */
  height: 84px;
  flex: 0 0 84px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-top: 1px solid var(--kg-line-2);
  background: var(--kg-surface);
  min-width: 0;
  box-sizing: border-box;
}
.p-left {
  flex: 1 1 30%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}
.cover {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--kg-panel);
  flex: 0 0 46px;
  cursor: pointer;
  position: relative;
  transition: box-shadow 0.16s ease;
}
.cover:hover {
  box-shadow: 0 0 0 2px var(--kg-accent-soft);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-empty {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}
.meta {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
/* 歌名与歌手同一行，像「甲乙丙丁 - 李佳薇」那样一直显示完整 */
.title-row {
  display: flex;
  align-items: baseline;
  gap: 0;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.song-name {
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-singer {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 12px;
  color: var(--kg-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.song-name:hover,
.song-singer:hover {
  color: var(--kg-accent-dark);
}
.sub-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  height: 20px;
  overflow: hidden;
}
.trial-tag {
  font-size: 9px;
  color: #c26b00;
  border: 1px solid #f3d1a0;
  background: #fff8ec;
  border-radius: 3px;
  padding: 0 3px;
  line-height: 13px;
  flex: 0 0 auto;
}
.quick-actions {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: 3px;
  flex: 0 0 auto;
}
.mini-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-text-3);
}
.mini-btn:hover {
  background: var(--kg-hover);
  color: var(--kg-text);
}
.mini-btn.liked {
  color: var(--kg-accent);
}

.p-center {
  flex: 1 1 42%;
  min-width: 200px;
  max-width: 620px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.controls {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ctl {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
  transition: background 0.15s ease, color 0.15s ease;
  flex: 0 0 auto;
}
.ctl:hover {
  background: var(--kg-hover);
  color: var(--kg-text);
}
.ctl:disabled {
  opacity: 0.4;
}
.word {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}
/* 播放/暂停跟上一首、下一首同款：纯图标按钮，不再是一个实心彩色圆 */
.play-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: transparent;
  color: var(--kg-text);
  box-shadow: none;
  display: grid;
  place-items: center;
  transition: background 0.15s ease, color 0.15s ease;
  flex: 0 0 auto;
}
.play-btn:hover {
  background: var(--kg-hover);
  color: var(--kg-text);
}
.spin {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0 2px;
}
.time {
  font-size: 10.5px;
  color: var(--kg-text-3);
  width: 34px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  flex: 0 0 34px;
}

.p-right {
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  min-width: 0;
}
.quality-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11.5px;
  color: var(--kg-text-2);
  border: 1px solid var(--kg-line-2);
  background: var(--kg-surface);
  white-space: nowrap;
}
.quality-btn:hover {
  border-color: var(--kg-line-2);
}
.rate-btn {
  height: 24px;
  padding: 0 7px;
  border-radius: 6px;
  font-size: 11px;
  color: var(--kg-text-2);
  border: 1px solid var(--kg-line-2);
  background: var(--kg-surface);
  white-space: nowrap;
}
.rate-btn:hover {
  border-color: var(--kg-line-2);
}
.climax-btn {
  height: 22px;
  padding: 0 8px;
  border-radius: 11px;
  font-size: 11px;
  font-weight: 600;
  color: var(--kg-accent-dark);
  background: var(--kg-accent-soft);
  border: 1px solid rgba(var(--kg-accent-rgb), 0.28);
  transition: filter 0.15s ease;
  flex: 0 0 auto;
}
.climax-btn:hover {
  filter: brightness(1.05);
}
.q-item {
  display: flex;
  width: 168px;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
}
.q-label {
  flex: 1;
  min-width: 0;
}
.q-desc {
  font-size: 10.5px;
  color: var(--kg-text-3);
  flex: 0 0 auto;
}
.q-desc.vip {
  font-size: 10px;
  color: #a8791f;
  background: linear-gradient(135deg, #fff2d3, #f7dfa6);
  border-radius: 4px;
  padding: 1px 5px;
}
[data-theme='dark'] .q-desc.vip {
  color: #e7c483;
  background: rgba(220, 170, 80, 0.16);
}
.ctl.on {
  color: var(--kg-accent-dark);
}
.ctl.off {
  color: var(--kg-text-3);
}

/* 音量浮层 */
.vol-wrap {
  position: relative;
  display: flex;
}
.vol-trigger {
  width: auto;
  min-width: 28px;
  padding: 0 5px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.vol-text {
  font-size: 10px;
  color: var(--kg-text-3);
  font-variant-numeric: tabular-nums;
}
.vol-pop {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  width: 58px;
  padding: 8px 0 9px;
  border-radius: 12px;
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
  box-shadow: 0 12px 30px rgba(20, 26, 38, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 40;
}
.vol-mute {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
  background: var(--kg-panel);
}
.vol-mute:hover {
  color: var(--kg-accent-dark);
}
.vol-slider {
  height: 92px;
  width: 26px;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 4px 0;
}
.vol-rail {
  position: relative;
  width: 4px;
  height: 100%;
  border-radius: 99px;
  background: var(--kg-line-2);
}
.vol-fill {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  background: var(--kg-accent);
  border-radius: 99px;
  transition: height 0.08s linear;
}
.vol-knob {
  position: absolute;
  left: 50%;
  width: 11px;
  height: 11px;
  margin-left: -5.5px;
  border-radius: 50%;
  background: var(--kg-surface);
  border: 2px solid var(--kg-accent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.vol-num {
  font-size: 10px;
  color: var(--kg-text-2);
  font-variant-numeric: tabular-nums;
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}

/* 窄窗口优先隐藏次要按钮，保证进度条与主控永远不被挤掉 */
@media (max-width: 1240px) {
  .quick-actions .opt,
  .p-right .climax-btn {
    display: none;
  }
}
@media (max-width: 1120px) {
  .p-right .rate-btn {
    display: none;
  }
}
@media (max-width: 1040px) {
  .playerbar {
    gap: 10px;
    padding: 0 12px;
  }
  /* 评论按钮常驻，其余次要按钮在窄窗口收起 */
  .quick-actions .mini-btn:not(.comment-btn) {
    display: none;
  }
}
</style>
