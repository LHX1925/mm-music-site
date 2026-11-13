<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { playlistDetail, playlistSimilar, playlistTracks } from '@/api';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import SongList from '@/components/common/SongList.vue';
import PlaylistCard from '@/components/common/PlaylistCard.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import { useSongActions } from '@/composables/useSongActions';
import { useLibraryStore } from '@/stores/library';
import { useUserStore } from '@/stores/user';
import { formatCount, formatDate } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const library = useLibraryStore();
const user = useUserStore();
const { playAll, openAddToPlaylist } = useSongActions();

const detail = ref(null);
const songs = ref([]);
const similar = ref([]);
const loading = ref(true);
const page = ref(1);
const total = ref(0);
const loadingMore = ref(false);

const id = computed(() => String(route.params.id || ''));
const hasMore = computed(() => songs.value.length < total.value);

async function load() {
  loading.value = true;
  page.value = 1;
  try {
    const [d, t] = await Promise.allSettled([playlistDetail(id.value), playlistTracks(id.value, 1, 200)]);
    const fromTracks = t.status === 'fulfilled' ? t.value.info : null;
    detail.value = (d.status === 'fulfilled' && d.value) || fromTracks || null;
    if (t.status === 'fulfilled') {
      songs.value = t.value.songs;
      total.value = t.value.total || t.value.songs.length;
    }
    const s = await playlistSimilar(id.value).catch(() => []);
    similar.value = (s || []).slice(0, 6);
  } catch (e) {
    ElMessage.error(e.message || '歌单加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value) return;
  loadingMore.value = true;
  page.value += 1;
  try {
    const res = await playlistTracks(id.value, page.value, 200);
    const exists = new Set(songs.value.map((s) => `${s.hash}_${s.albumAudioId}`));
    songs.value.push(...res.songs.filter((s) => !exists.has(`${s.hash}_${s.albumAudioId}`)));
    total.value = res.total || total.value;
  } finally {
    loadingMore.value = false;
  }
}

function playAllSongs() {
  if (!songs.value.length) return;
  playAll(songs.value, 0, detail.value?.name || '歌单');
}

function addAll() {
  openAddToPlaylist(songs.value);
}

onMounted(load);
watch(id, load);
</script>

<template>
  <div class="pl-page page-scroll">
    <div class="detail-head">
      <div class="cover">
        <CoverImage :src="detail?.cover" :size="188" :radius="12" />
      </div>
      <div class="meta">
        <div class="tag-row">
          <span class="type-tag">歌单</span>
          <span v-if="detail?.tags?.length" class="tags">{{ detail.tags.slice(0, 3).join(' · ') }}</span>
        </div>
        <h1 class="name">{{ detail?.name || '歌单' }}</h1>
        <div class="creator-row">
          <span class="creator">{{ detail?.creator || '酷狗音乐' }}</span>
          <span class="dot">·</span>
          <span>{{ formatCount(detail?.playCount) }} 次播放</span>
          <span class="dot">·</span>
          <span>{{ songs.length }} 首</span>
          <span v-if="detail?.updateTime" class="dot">·</span>
          <span v-if="detail?.updateTime">{{ formatDate(detail.updateTime) }} 更新</span>
        </div>
        <p v-if="detail?.intro" class="intro clamp-2">{{ detail.intro }}</p>
        <div class="actions">
          <button class="btn primary" @click="playAllSongs">
            <Icon name="play" :size="15" color="#fff" filled /> 播放全部
          </button>
          <button class="btn" @click="addAll"><Icon name="plus" :size="15" /> 添加到歌单</button>
          <button class="icon-btn" title="更多" @click="router.push('/my/playlists')">
            <Icon name="more" :size="17" />
          </button>
        </div>
      </div>
    </div>

    <SongList :songs="songs" :loading="loading" show-header empty-text="这个歌单还没有歌曲" />
    <div v-if="hasMore" class="load-more" @click="loadMore">
      {{ loadingMore ? '加载中…' : `加载更多（${songs.length}/${total}）` }}
    </div>

    <div v-if="similar.length" class="similar">
      <SectionHeader title="相似歌单" />
      <div class="grid">
        <PlaylistCard v-for="p in similar" :key="p.id" :playlist="p" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pl-page {
  height: 100%;
  overflow-y: auto;
  padding: 8px 26px 40px;
}
.detail-head {
  display: flex;
  gap: 22px;
  margin-bottom: 24px;
}
.cover {
  flex: 0 0 188px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(20, 24, 32, 0.14);
}
.meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.type-tag {
  font-size: 10.5px;
  color: #0a8f52;
  border: 1px solid #b7ebcd;
  background: #f0fcf5;
  border-radius: 4px;
  padding: 1px 5px;
}
.tags {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.name {
  margin: 10px 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.4px;
  line-height: 1.25;
}
.creator-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--kg-text-2);
  flex-wrap: wrap;
}
.creator {
  font-weight: 600;
  color: var(--kg-text);
}
.dot {
  color: #ccd0d7;
}
.intro {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--kg-text-3);
  line-height: 1.6;
  max-width: 720px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
}
.btn {
  height: 34px;
  padding: 0 16px;
  border-radius: 17px;
  border: 1px solid var(--kg-line-2);
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--kg-surface);
  color: var(--kg-text-2);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.btn:hover {
  background: var(--kg-panel);
}
.btn.primary {
  background: var(--kg-accent);
  border-color: var(--kg-accent);
  color: #fff;
  font-weight: 600;
}
.btn.primary:hover {
  background: var(--kg-accent-dark);
}
.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--kg-line-2);
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
}
.icon-btn:hover {
  background: var(--kg-panel);
}
.load-more {
  margin: 14px auto 0;
  width: 200px;
  text-align: center;
  font-size: 12px;
  color: var(--kg-text-2);
  padding: 8px;
  border-radius: 16px;
  border: 1px solid var(--kg-line);
  cursor: pointer;
}
.load-more:hover {
  background: var(--kg-panel);
}
.similar {
  margin-top: 34px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
}
</style>
