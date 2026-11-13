<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import ProgressSlider from '@/components/common/ProgressSlider.vue';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { useAppStore } from '@/stores/app';
import { useSongActions } from '@/composables/useSongActions';

const player = usePlayerStore();
const library = useLibraryStore();
const ui = useUiStore();
const app = useAppStore();
const router = useRouter();
const { openAddToPlaylist } = useSongActions();

const lyricBox = ref(null);
const dragging = ref(false);
const dragValue = ref(0);
const lyricOpen = ref(true);

const cover = computed(() => player.current?.coverBig || player.current?.cover || '');
const liked = computed(() => library.isFavorite(player.current));
const progressValue = computed({
  get: () => (dragging.value ? dragValue.value : player.progress),
  set: (v) => (dragValue.value = v),
});

watch(
  () => player.lyricIndex,
  async () => {
    await nextTick();
    const box = lyricBox.value;
    const el = box?.querySelector('.line.active');
    if (!el || !box) return;
    const offset = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
  }
);

function seekTo(line) {
  player.seek(line.time);
}

function close() {
  ui.showPlayer = false;
}

function openComments() {
  if (!player.current) return;
  ui.commentSong = player.current;
  ui.showComments = true;
}

function toArtist() {
  const id = player.current?.singerIds?.[0];
  if (id) {
    ui.showPlayer = false;
    router.push(`/artist/${id}`);
  }
}
</script>

<template>
  <div class="full-player">
    <div class="bg" :style="{ backgroundImage: cover ? `url(${cover})` : '' }" />
    <div class="bg-mask" />

    <header class="fp-head">
      <button class="fold" @click="close">
        <Icon name="chevron-down" :size="18" />
      </button>
      <div class="fp-title">
        <div class="name ellipsis">{{ player.current?.name || '未在播放' }}</div>
        <div class="singer ellipsis" @click="toArtist">{{ player.current?.singer || '' }}</div>
      </div>
      <button class="fold" :title="lyricOpen ? '收起歌词' : '展开歌词'" @click="lyricOpen = !lyricOpen">
        <Icon :name="lyricOpen ? 'list' : 'note'" :size="17" />
      </button>
      <button class="fold" @click="openAddToPlaylist(player.current)"><Icon name="plus" :size="17" /></button>
    </header>

    <div class="fp-body" :class="{ 'no-lyric': !lyricOpen }">
      <div class="left">
        <div class="disc" :class="{ spinning: player.playing }">
          <CoverImage :src="cover" :size="286" :radius="143" />
        </div>
        <div class="song-title">{{ player.current?.name || '听我想听' }}</div>
        <div class="song-sub">
          <span>{{ player.current?.album || '酷狗音乐' }}</span>
          <span class="dot">·</span>
          <span>{{ player.qualityLabel }}</span>
        </div>
        <div class="fp-actions">
          <button class="act" :class="{ on: liked }" @click="library.toggleFavorite(player.current)">
            <Icon name="heart" :size="18" :filled="liked" />
            <span>喜欢</span>
          </button>
          <button class="act" @click="openComments">
            <Icon name="comment" :size="18" />
            <span>评论</span>
          </button>
          <button v-if="player.hasMv" class="act" @click="ui.openMv(player.current)">
            <Icon name="mv" :size="18" />
            <span>MV</span>
          </button>
        </div>
      </div>

      <div class="right" v-show="lyricOpen">
        <div ref="lyricBox" class="lyric-box" :style="{ '--lyric-size': (app.settings.lyricSize || 26) + 'px' }">
          <div v-if="!player.lyricLines.length" class="no-lyric">
            {{ player.lyricLoading ? '歌词加载中…' : '暂无歌词，好好听歌吧' }}
          </div>
          <div
            v-for="(line, i) in player.lyricLines"
            :key="i"
            class="line"
            :class="{ active: i === player.lyricIndex }"
            @click="seekTo(line)"
          >
            <div class="text">{{ line.text }}</div>
            <div v-if="line.tr" class="tr">{{ line.tr }}</div>
          </div>
        </div>
      </div>
    </div>

    <footer class="fp-foot">
      <div class="fp-controls">
        <button class="ctl" @click="player.setMode()" :title="player.playModeLabel">
          <Icon :name="player.mode === 'single' ? 'repeat-one' : player.mode === 'shuffle' ? 'shuffle' : 'repeat'" :size="18" />
        </button>
        <button class="ctl" @click="player.prev()"><Icon name="prev" :size="20" /></button>
        <button class="big-play" @click="player.toggle()">
          <Icon :name="player.playing ? 'pause' : 'play'" :size="24" color="#fff" :filled="!player.playing" />
        </button>
        <button class="ctl" @click="player.next()"><Icon name="next" :size="20" /></button>
        <button class="ctl" @click="ui.showQueue = true"><Icon name="queue" :size="18" /></button>
      </div>
      <div class="fp-progress">
        <span class="time">{{ player.progressText }}</span>
        <ProgressSlider
          v-model="progressValue"
          :max="player.duration || player.current?.duration || 0"
          :buffered="player.buffered"
          :climax="player.climax"
          @dragstart="dragging = true; dragValue = player.progress"
          @change="dragging = false; player.seek($event)"
        />
        <span class="time">{{ player.durationText }}</span>
        <el-dropdown trigger="click" @command="player.setRate">
          <button class="rate">{{ player.rate === 1 ? '1.0x' : `${player.rate}x` }}</button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="r in [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]" :key="r" :command="r">
                {{ r === 1 ? '正常速度' : `${r}x` }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.full-player {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--kg-text);
  background: var(--kg-panel-2);
}
.bg {
  position: absolute;
  inset: -40px;
  background-size: cover;
  background-position: center;
  filter: blur(70px) saturate(1.3);
  transform: scale(1.2);
  opacity: 0.55;
}
.bg-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(248, 249, 251, 0.95) 45%, #fbfbfc 85%);
  backdrop-filter: blur(2px);
}
/* 深色主题：遮罩与控件一起变深，不再永远是白底 */
[data-theme='dark'] .bg-mask {
  background: linear-gradient(180deg, rgba(16, 18, 24, 0.86), rgba(20, 23, 30, 0.94) 45%, #14161c 85%);
}
[data-theme='dark'] .fold {
  background: rgba(255, 255, 255, 0.1);
  color: #eceef3;
}
[data-theme='dark'] .rate,
[data-theme='dark'] .ctl:hover {
  background: rgba(255, 255, 255, 0.09);
}
[data-theme='dark'] .line.active {
  text-shadow: 0 2px 18px rgba(var(--kg-accent-rgb), 0.45);
}
.fp-head {
  position: relative;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  flex: 0 0 64px;
}
.fold {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.65);
  display: grid;
  place-items: center;
  color: #2b2f37;
}
.fp-title {
  flex: 1;
  min-width: 0;
  text-align: center;
}
.fp-title .name {
  font-size: 13.5px;
  font-weight: 600;
}
.fp-title .singer {
  font-size: 11px;
  color: var(--kg-text-2);
  margin-top: 2px;
  cursor: pointer;
}
.fp-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.05fr 1.2fr;
  gap: 24px;
  padding: 6px 54px 10px;
  align-items: center;
}
.fp-body.no-lyric {
  grid-template-columns: 1fr;
}
.fp-body.no-lyric .left {
  transform: scale(1.04);
}
.rate {
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 10.5px;
  color: var(--kg-text-2);
  border: 1px solid var(--kg-line-2);
  background: rgba(255, 255, 255, 0.6);
  margin-left: 4px;
  font-variant-numeric: tabular-nums;
}
.left {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.disc {
  position: relative;
  border-radius: 50%;
  box-shadow: 0 24px 60px rgba(20, 24, 32, 0.22);
}
.disc.spinning {
  animation: spin 26s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.song-title {
  margin-top: 22px;
  font-size: 19px;
  font-weight: 700;
  text-align: center;
  max-width: 320px;
}
.song-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--kg-text-2);
  display: flex;
  gap: 6px;
  align-items: center;
}
.dot {
  color: #b9bec7;
}
.fp-actions {
  display: flex;
  gap: 26px;
  margin-top: 20px;
}
.act {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: #5a606b;
}
.act.on {
  color: var(--kg-accent-dark);
}
.act:hover {
  color: var(--kg-text);
}
.right {
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
}
.lyric-box {
  height: 100%;
  max-height: 380px;
  width: 100%;
  overflow-y: auto;
  padding: 150px 0;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent, #000 18%, #000 82%, transparent);
}
.lyric-box::-webkit-scrollbar {
  display: none;
}
.line {
  padding: 9px 4px;
  text-align: left;
  color: var(--kg-text-3);
  font-size: calc(var(--lyric-size, 26px) * 0.58);
  line-height: 1.55;
  transition: color 0.2s ease, transform 0.2s ease;
  cursor: pointer;
}
.line:hover {
  color: var(--kg-text-2);
}
.line.active {
  /* 当前播放行：主色 + 加粗放大，浅色/深色下都一眼能认出来 */
  color: var(--kg-accent);
  font-weight: 800;
  font-size: calc(var(--lyric-size, 26px) * 0.82);
  text-shadow: 0 2px 14px rgba(var(--kg-accent-rgb), 0.28);
  transform: translateX(6px);
}
.line .tr {
  font-size: calc(var(--lyric-size, 26px) * 0.46);
  margin-top: 3px;
  opacity: 0.75;
  font-weight: 400;
}
.no-lyric {
  padding: 60px 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--kg-text-3);
}
.fp-foot {
  position: relative;
  padding: 0 54px 26px;
  flex: 0 0 auto;
}
.fp-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
  margin-bottom: 10px;
}
.ctl {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
}
.ctl:hover {
  background: rgba(255, 255, 255, 0.7);
}
.big-play {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: var(--kg-accent);
  display: grid;
  place-items: center;
  box-shadow: 0 10px 24px rgba(var(--kg-accent-rgb), 0.3);
}
.fp-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 720px;
  margin: 0 auto;
}
.time {
  font-size: 11px;
  color: var(--kg-text-2);
  width: 38px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
