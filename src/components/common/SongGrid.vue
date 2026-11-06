<script setup>
import Icon from './Icon.vue';
import CoverImage from './CoverImage.vue';
import { useSongActions } from '@/composables/useSongActions';
import { songFlagsOf } from '@/utils/songFlags';

const props = defineProps({
  songs: { type: Array, default: () => [] },
  columns: { type: Number, default: 3 },
  /** 单击整行即播放（以整列表为播放队列） */
  singleClick: { type: Boolean, default: false },
});
const { play, player, library, toggleFav } = useSongActions();

function isCurrent(s) {
  return player.current && player.current.hash === s.hash && player.current.albumAudioId === s.albumAudioId;
}
</script>

<template>
  <div class="song-grid" :style="{ '--cols': columns }">
    <div
      v-for="(song, i) in songs"
      :key="`${song.hash}-${i}`"
      class="cell"
      :class="{ active: isCurrent(song) }"
      @click="singleClick && play(song, songs)"
      @dblclick="play(song, songs)"
    >
      <div class="cover-wrap">
        <CoverImage :src="song.cover" :size="44" :radius="6" />
        <button class="play-mask" @click.stop="play(song, songs)">
          <Icon name="play" :size="12" color="#fff" filled />
        </button>
      </div>
      <div class="info">
        <div class="line1">
          <span class="name ellipsis" :title="song.name">{{ song.name }}</span>
          <span v-if="songFlagsOf(song).isOriginal" class="badge-orig" title="原创作品">原创</span>
          <span v-if="songFlagsOf(song).isVip" class="badge-vip" title="VIP 专享">VIP</span>
          <span v-if="songFlagsOf(song).hasMv" class="mv-tag" title="有 MV">MV</span>
          <span v-if="song.qualityLevel >= 3 || song.hash ? false : false" />
        </div>
        <div class="line2 ellipsis">{{ song.singer }}</div>
      </div>
      <button class="like" :class="{ liked: library.isFavorite(song) }" @click.stop="toggleFav(song)">
        <Icon name="heart" :size="14" :filled="library.isFavorite(song)" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.song-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  gap: 4px 26px;
}
.cell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 6px;
  border-radius: 8px;
  min-width: 0;
  transition: background 0.14s ease;
}
.cell:hover {
  background: var(--kg-panel-2);
}
.cell.active .name {
  color: #0a8f52;
}
.cover-wrap {
  position: relative;
  flex: 0 0 44px;
}
.play-mask {
  position: absolute;
  inset: 0;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.cell:hover .play-mask {
  opacity: 1;
}
.info {
  min-width: 0;
  flex: 1;
}
.line1 {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.name {
  font-size: 13px;
  color: var(--kg-text);
  min-width: 0;
}
.line2 {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 4px;
}
.like {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  color: #b3b8c2;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.cell:hover .like {
  opacity: 1;
}
.like.liked {
  color: var(--kg-accent);
  opacity: 1;
}
</style>
