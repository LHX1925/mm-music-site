<script setup>
import { computed } from 'vue';
import Icon from '@/components/common/Icon.vue';
import SongList from '@/components/common/SongList.vue';
import { useLibraryStore } from '@/stores/library';
import { useSongActions } from '@/composables/useSongActions';

const library = useLibraryStore();
const { playAll } = useSongActions();
const songs = computed(() => library.preview);
</script>

<template>
  <div class="lib-page page-scroll">
    <div class="head">
      <h1>试听列表</h1>
      <span class="sub">{{ songs.length }} 首 · 临时收听的歌曲</span>
      <div class="spacer" />
      <button class="btn" :disabled="!songs.length" @click="playAll(songs, 0)">
        <Icon name="play" :size="13" color="#fff" filled /> 播放全部
      </button>
      <button v-if="songs.length" class="btn ghost" @click="library.clearPreview()">
        <Icon name="trash" :size="13" /> 清空
      </button>
    </div>
    <SongList :songs="songs" show-header empty-text="试听列表为空，点击歌曲「更多」可加入试听" @remove="library.removePreview" />
  </div>
</template>

<style scoped>
.lib-page {
  height: 100%;
  overflow-y: auto;
  padding: 10px 26px 40px;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}
.head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.sub {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.spacer {
  flex: 1;
}
.btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 15px;
  background: var(--kg-accent);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn.ghost {
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
  color: var(--kg-text-2);
}
.btn:disabled {
  opacity: 0.5;
}
</style>
