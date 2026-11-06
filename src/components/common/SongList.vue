<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from './Icon.vue';
import CoverImage from './CoverImage.vue';
import { useSongActions } from '@/composables/useSongActions';
import { formatDuration } from '@/utils/format';
import { useUiStore } from '@/stores/ui';
import { songFlagsOf } from '@/utils/songFlags';

const props = defineProps({
  songs: { type: Array, default: () => [] },
  showCover: { type: Boolean, default: true },
  showAlbum: { type: Boolean, default: true },
  showIndex: { type: Boolean, default: true },
  showHeader: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: '暂无歌曲' },
  highlight: { type: Boolean, default: true },
});

const emit = defineEmits(['play', 'remove']);

const router = useRouter();
const ui = useUiStore();
const { player, library, play, toggleFav, playNext, addToQueue, openAddToPlaylist, download, copyName } =
  useSongActions();

function openMv(song) {
  ui.openMv(song);
}

const menuFor = ref(-1);

const list = computed(() => props.songs || []);

const gridTemplate = computed(() => {
  const cols = ['30px'];
  if (props.showCover) cols.push(props.compact ? '42px' : '48px');
  cols.push('minmax(0, 1.5fr)');
  if (props.showAlbum) cols.push('minmax(0, 1fr)');
  cols.push('54px', '108px');
  return cols.join(' ');
});

function isCurrent(song) {
  return (
    props.highlight &&
    player.current &&
    player.current.hash === song.hash &&
    player.current.albumAudioId === song.albumAudioId
  );
}

function rowClick(song, i) {
  emit('play', { song, index: i });
  play(song, list.value);
}

function onDocClick() {
  menuFor.value = -1;
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

function toggleMenu(i, e) {
  e.stopPropagation();
  menuFor.value = menuFor.value === i ? -1 : i;
}

function toAlbum(song) {
  if (song.albumId) router.push(`/album/${song.albumId}`);
}

function toArtist(song) {
  const id = song.singerIds?.[0];
  if (id) router.push(`/artist/${id}`);
}
</script>

<template>
  <div class="song-list" :class="{ compact }" :style="{ '--cols': gridTemplate }">
    <div v-if="showHeader" class="row head">
      <div class="idx">#</div>
      <div v-if="showCover" class="cover-sp" />
      <div class="name">歌曲</div>
      <div v-if="showAlbum" class="album">专辑</div>
      <div class="dur">时长</div>
      <div class="ops" />
    </div>

    <div
      v-for="(song, i) in list"
      :key="`${song.hash}-${song.albumAudioId}-${i}`"
      class="row"
      :class="{ active: isCurrent(song) }"
      @dblclick="rowClick(song, i)"
    >
      <div class="idx">
        <span v-if="!isCurrent(song)" class="num">{{ i + 1 }}</span>
        <span v-else class="playing-bars"><i /><i /><i /></span>
        <button class="idx-play" @click.stop="play(song, list)">
          <Icon name="play" :size="12" filled />
        </button>
      </div>

      <div v-if="showCover" class="cover-wrap">
        <CoverImage :src="song.cover" :size="compact ? 34 : 40" :radius="5" />
        <button class="cover-play" @click.stop="play(song, list)">
          <Icon name="play" :size="14" color="#fff" filled />
        </button>
      </div>

      <div class="name">
        <div class="name-line">
          <span class="song-name ellipsis" :title="song.name">{{ song.name }}</span>
          <span v-if="songFlagsOf(song).isOriginal" class="badge-orig" title="原创作品">原创</span>
          <span v-if="songFlagsOf(song).isVip" class="badge-vip" title="VIP 专享">VIP</span>
          <span v-if="songFlagsOf(song).hasMv" class="mv-tag" title="有 MV">MV</span>
        </div>
        <div class="singer ellipsis">
          <span class="singer-link" @click.stop="toArtist(song)">{{ song.singer }}</span>
        </div>
      </div>

      <div v-if="showAlbum" class="album ellipsis" :title="song.album" @click.stop="toAlbum(song)">
        {{ song.album || '—' }}
      </div>

      <div class="dur">{{ formatDuration(song.duration) }}</div>

      <div class="ops">
        <button class="op" :class="{ liked: library.isFavorite(song) }" title="喜欢" @click.stop="toggleFav(song)">
          <Icon name="heart" :size="15" :filled="library.isFavorite(song)" />
        </button>
        <button class="op" title="添加到歌单" @click.stop="openAddToPlaylist([song])">
          <Icon name="plus" :size="15" />
        </button>
        <button class="op" title="下载" @click.stop="download(song)">
          <Icon name="download" :size="15" />
        </button>
        <div class="more-wrap">
          <button class="op" title="更多" @click="toggleMenu(i, $event)">
            <Icon name="more" :size="16" />
          </button>
          <transition name="fade">
            <div v-if="menuFor === i" class="menu" @click.stop>
              <button @click="playNext(song); menuFor = -1">下一首播放</button>
              <button @click="addToQueue(song); menuFor = -1">加入播放队列</button>
              <button @click="openAddToPlaylist([song]); menuFor = -1">添加到歌单</button>
              <button @click="download(song); menuFor = -1">下载歌曲</button>
              <button @click="openMv(song); menuFor = -1">观看 MV</button>
              <button @click="toAlbum(song); menuFor = -1">查看专辑</button>
              <button @click="copyName(song); menuFor = -1">复制歌名</button>
              <button v-if="$attrs.onRemove" class="danger" @click="emit('remove', song); menuFor = -1">从列表移除</button>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <div v-if="!list.length && !loading" class="empty">{{ emptyText }}</div>
    <div v-if="loading" class="empty">加载中…</div>
  </div>
</template>

<style scoped>
.song-list {
  width: 100%;
}
.row {
  display: grid;
  grid-template-columns: var(--cols);
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 8px;
  border-radius: 8px;
  transition: background 0.13s ease;
  cursor: default;
}
.song-list.compact .row {
  height: 50px;
}
.row:hover {
  background: var(--kg-panel-2);
}
.row.active {
  background: #f1fbf6;
}
.row.head {
  height: 32px;
  font-size: 11.5px;
  color: var(--kg-text-3);
  border-bottom: 1px solid var(--kg-line);
  border-radius: 0;
  cursor: default;
}
.row.head:hover {
  background: transparent;
}
.idx {
  display: grid;
  place-items: center;
  position: relative;
  font-size: 12px;
  color: var(--kg-text-3);
  font-variant-numeric: tabular-nums;
}
.idx-play {
  position: absolute;
  opacity: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-accent-dark);
}
.row:hover .idx-play {
  opacity: 1;
}
.row:hover .num {
  opacity: 0;
}
.playing-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}
.playing-bars i {
  width: 2.5px;
  background: var(--kg-accent);
  border-radius: 2px;
  animation: bar 0.9s ease-in-out infinite;
}
.playing-bars i:nth-child(1) {
  height: 60%;
  animation-delay: -0.2s;
}
.playing-bars i:nth-child(2) {
  height: 100%;
}
.playing-bars i:nth-child(3) {
  height: 45%;
  animation-delay: -0.5s;
}
@keyframes bar {
  0%,
  100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}
.cover-wrap {
  position: relative;
  width: fit-content;
}
.cover-play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.row:hover .cover-play {
  opacity: 1;
}
.name {
  min-width: 0;
}
.name-line {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.song-name {
  font-size: 13px;
  color: var(--kg-text);
  max-width: 100%;
}
.row.active .song-name {
  color: #0a8f52;
  font-weight: 600;
}
.singer {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 3px;
}
.singer-link:hover {
  color: var(--kg-accent-dark);
  text-decoration: underline;
}
.album {
  font-size: 12px;
  color: var(--kg-text-2);
  min-width: 0;
}
.album:hover {
  color: var(--kg-text);
}
.dur {
  font-size: 11.5px;
  color: var(--kg-text-3);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.ops {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.14s ease;
}
.row:hover .ops {
  opacity: 1;
}
.op {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #8b919c;
}
.op:hover {
  background: var(--kg-hover);
  color: var(--kg-text);
}
.op.liked {
  color: var(--kg-accent);
}
.more-wrap {
  position: relative;
}
.menu {
  position: absolute;
  right: 0;
  top: 26px;
  width: 132px;
  padding: 5px;
  background: var(--kg-surface);
  border-radius: 9px;
  box-shadow: 0 10px 28px rgba(20, 24, 32, 0.14);
  z-index: 20;
}
.menu button {
  width: 100%;
  height: 29px;
  text-align: left;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--kg-text);
}
.menu button:hover {
  background: var(--kg-panel);
}
.menu button.danger {
  color: #d9534f;
}
.empty {
  padding: 40px 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--kg-text-3);
}
</style>
