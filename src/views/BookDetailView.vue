<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { longaudioAlbumAudios, longaudioAlbumDetail } from '@/api';
import CoverImage from '@/components/common/CoverImage.vue';
import Icon from '@/components/common/Icon.vue';
import SongList from '@/components/common/SongList.vue';
import { useAppStore } from '@/stores/app';
import { useSongActions } from '@/composables/useSongActions';

const route = useRoute();
const app = useAppStore();
const { playAll } = useSongActions();

const info = ref(null);
const songs = ref([]);
const loading = ref(true);
const id = computed(() => String(route.params.id || ''));

async function load() {
  loading.value = true;
  try {
    const [d, a] = await Promise.allSettled([
      longaudioAlbumDetail(id.value, app.platform),
      longaudioAlbumAudios(id.value, 1, 100, app.platform),
    ]);
    info.value = d.status === 'fulfilled' ? d.value : null;
    if (a.status === 'fulfilled') songs.value = a.value.songs;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(id, load);
</script>

<template>
  <div class="bd-page page-scroll">
    <div class="head">
      <CoverImage :src="info?.sizable_cover || info?.cover" :size="170" :radius="12" />
      <div class="meta">
        <div class="tag">听书专辑</div>
        <h1>{{ info?.album_name || info?.name || '听书专辑' }}</h1>
        <div class="sub">
          <span>{{ info?.author_name || info?.author || '佚名' }}</span>
          <span class="dot">·</span>
          <span>{{ songs.length }} 集</span>
        </div>
        <p v-if="info?.intro" class="intro clamp-3">{{ info.intro }}</p>
        <button class="btn primary" @click="playAll(songs, 0)">
          <Icon name="play" :size="14" color="#fff" filled /> 播放全部
        </button>
      </div>
    </div>
    <SongList :songs="songs" :loading="loading" show-header :show-album="false" empty-text="暂无音频" />
  </div>
</template>

<style scoped>
.bd-page {
  height: 100%;
  overflow-y: auto;
  padding: 10px 26px 40px;
}
.head {
  display: flex;
  gap: 22px;
  margin-bottom: 22px;
}
.meta {
  flex: 1;
  min-width: 0;
}
.tag {
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
  font-size: 24px;
  font-weight: 700;
}
.sub {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--kg-text-2);
}
.dot {
  color: #ccd0d7;
}
.intro {
  margin: 10px 0 14px;
  font-size: 12px;
  color: var(--kg-text-3);
  line-height: 1.7;
  max-width: 720px;
}
.btn {
  height: 33px;
  padding: 0 16px;
  border-radius: 17px;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn.primary {
  background: var(--kg-accent);
  color: #fff;
  font-weight: 600;
}
</style>
