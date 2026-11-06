<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { albumDetail, albumSongs } from '@/api';
import CoverImage from '@/components/common/CoverImage.vue';
import Icon from '@/components/common/Icon.vue';
import SongList from '@/components/common/SongList.vue';
import { useSongActions } from '@/composables/useSongActions';
import { formatDate } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const { playAll, openAddToPlaylist } = useSongActions();

const album = ref(null);
const songs = ref([]);
const loading = ref(true);
const id = computed(() => String(route.params.id || ''));

async function load() {
  loading.value = true;
  try {
    const [a, s] = await Promise.allSettled([albumDetail(id.value), albumSongs(id.value, 1, 50)]);
    album.value = a.status === 'fulfilled' ? a.value : null;
    if (s.status === 'fulfilled') songs.value = s.value.songs;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(id, load);
</script>

<template>
  <div class="al-page page-scroll">
    <div class="head">
      <div class="cover">
        <CoverImage :src="album?.cover" :size="190" :radius="12" />
      </div>
      <div class="meta">
        <div class="type">专辑</div>
        <h1>{{ album?.name || '专辑' }}</h1>
        <div class="sub">
          <span class="singer" @click="album?.singerId && router.push(`/artist/${album.singerId}`)">
            {{ album?.singer }}
          </span>
          <span class="dot">·</span>
          <span>{{ formatDate(album?.publishDate) }}</span>
          <span class="dot">·</span>
          <span>{{ songs.length }} 首</span>
        </div>
        <p v-if="album?.intro" class="intro clamp-2">{{ album.intro }}</p>
        <div class="actions">
          <button class="btn primary" @click="playAll(songs, 0)">
            <Icon name="play" :size="14" color="#fff" filled /> 播放全部
          </button>
          <button class="btn" @click="openAddToPlaylist(songs)"><Icon name="plus" :size="14" /> 添加到歌单</button>
        </div>
      </div>
    </div>

    <SongList :songs="songs" :loading="loading" show-header :show-album="false" empty-text="专辑暂无歌曲" />
  </div>
</template>

<style scoped>
.al-page {
  height: 100%;
  overflow-y: auto;
  padding: 10px 26px 40px;
}
.head {
  display: flex;
  gap: 22px;
  margin-bottom: 22px;
}
.cover {
  flex: 0 0 190px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 30px rgba(20, 24, 32, 0.16);
}
.meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.type {
  font-size: 10.5px;
  color: #0a8f52;
  border: 1px solid #b7ebcd;
  background: #f0fcf5;
  border-radius: 4px;
  padding: 1px 5px;
  width: fit-content;
}
h1 {
  margin: 10px 0 8px;
  font-size: 26px;
  font-weight: 700;
}
.sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--kg-text-2);
}
.singer {
  font-weight: 600;
  color: var(--kg-text);
  cursor: pointer;
}
.singer:hover {
  color: var(--kg-accent-dark);
}
.dot {
  color: #ccd0d7;
}
.intro {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--kg-text-3);
  line-height: 1.65;
  max-width: 760px;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.btn {
  height: 33px;
  padding: 0 16px;
  border-radius: 17px;
  border: 1px solid var(--kg-line-2);
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--kg-surface);
}
.btn.primary {
  background: var(--kg-accent);
  border-color: var(--kg-accent);
  color: #fff;
  font-weight: 600;
}
</style>
