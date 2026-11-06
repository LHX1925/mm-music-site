<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { artistAlbums, artistAudios, artistDetail, artistFollow, artistVideos } from '@/api';
import { normalizeAlbum, img } from '@/api/normalize';
import CoverImage from '@/components/common/CoverImage.vue';
import Icon from '@/components/common/Icon.vue';
import SongList from '@/components/common/SongList.vue';
import { useSongActions } from '@/composables/useSongActions';
import { useUserStore } from '@/stores/user';
import { useLibraryStore } from '@/stores/library';
import { formatCount } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const library = useLibraryStore();
const { playAll } = useSongActions();

const artist = ref(null);
const songs = ref([]);
const albums = ref([]);
const videos = ref([]);
const tab = ref('song');
const sort = ref('hot');
const loading = ref(true);
const following = ref(false);

const id = computed(() => String(route.params.id || ''));
const tabs = [
  { key: 'song', label: '热门歌曲' },
  { key: 'album', label: '专辑' },
  { key: 'video', label: 'MV' },
  { key: 'detail', label: '歌手信息' },
];

async function load() {
  loading.value = true;
  try {
    const [a, s] = await Promise.allSettled([artistDetail(id.value), artistAudios(id.value, 1, 60, 'hot')]);
    artist.value = a.status === 'fulfilled' ? a.value : null;
    if (s.status === 'fulfilled') songs.value = s.value.songs;
    following.value = (library.followSingers || []).some((f) => f.id === id.value);
  } finally {
    loading.value = false;
  }
}

async function loadTab(key) {
  if (key === 'album' && !albums.value.length) {
    const list = await artistAlbums(id.value, 1, 30).catch(() => []);
    albums.value = list.map((x) => normalizeAlbum(x.raw || x)).filter((x) => x.id);
  }
  if (key === 'video' && !videos.value.length) {
    videos.value = await artistVideos(id.value).catch(() => []);
  }
}

async function changeTab(key) {
  tab.value = key;
  await loadTab(key);
}

async function changeSort(v) {
  sort.value = v;
  const res = await artistAudios(id.value, 1, 60, v);
  songs.value = res.songs;
}

async function toggleFollow() {
  if (!user.isLogin) return ElMessage.warning('请先登录');
  try {
    await artistFollow(id.value, following.value ? 2 : 1);
    following.value = !following.value;
    ElMessage.success(following.value ? '已关注' : '已取消关注');
    library.loadFollowSingers();
  } catch (e) {
    ElMessage.error(e.message || '操作失败');
  }
}

onMounted(async () => {
  await load();
  await loadTab('album');
});
watch(id, load);
</script>

<template>
  <div class="ar-page page-scroll">
    <div class="head">
      <CoverImage :src="artist?.cover" :size="150" :radius="75" class="avatar" />
      <div class="meta">
        <div class="name-row">
          <h1>{{ artist?.name || '歌手' }}</h1>
          <span v-if="artist?.fans" class="fans">{{ formatCount(artist.fans) }} 粉丝</span>
        </div>
        <p v-if="artist?.intro" class="intro clamp-2">{{ artist.intro }}</p>
        <div class="actions">
          <button class="btn primary" @click="playAll(songs, 0)">
            <Icon name="play" :size="14" color="#fff" filled /> 播放全部
          </button>
          <button class="btn" :class="{ followed: following }" @click="toggleFollow">
            <Icon :name="following ? 'check' : 'plus'" :size="14" />
            {{ following ? '已关注' : '关注' }}
          </button>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="changeTab(t.key)">
        {{ t.label }}
      </button>
      <div class="spacer" />
      <div v-if="tab === 'song'" class="sorts">
        <button :class="{ on: sort === 'hot' }" @click="changeSort('hot')">最热</button>
        <button :class="{ on: sort === 'new' }" @click="changeSort('new')">最新</button>
      </div>
    </div>

    <div v-loading="loading">
      <SongList v-if="tab === 'song'" :songs="songs" :show-album="false" show-header empty-text="暂无歌曲" />

      <div v-else-if="tab === 'album'" class="grid">
        <div v-for="al in albums" :key="al.id" class="album" @click="router.push(`/album/${al.id}`)">
          <CoverImage :src="al.cover" :size="150" :radius="10" />
          <div class="album-name clamp-2">{{ al.name }}</div>
          <div class="album-sub">{{ (al.publishDate || '').slice(0, 10) }}</div>
        </div>
        <div v-if="!albums.length" class="empty">暂无专辑</div>
      </div>

      <div v-else-if="tab === 'video'" class="grid video-grid">
        <div v-for="(v, i) in videos" :key="i" class="video">
          <CoverImage :src="img(v.imgurl || v.pic || v.cover, 360)" :size="180" :radius="10" />
          <div class="album-name clamp-2">{{ v.name || v.videoname }}</div>
        </div>
        <div v-if="!videos.length" class="empty">暂无 MV</div>
      </div>

      <div v-else class="detail-box">
        <h3>歌手简介</h3>
        <p>{{ artist?.intro || '暂无简介' }}</p>
        <div class="facts">
          <div><span>单曲数</span><b>{{ artist?.songs || songs.length }}</b></div>
          <div><span>专辑数</span><b>{{ albums.length || artist?.albums || 0 }}</b></div>
          <div><span>粉丝数</span><b>{{ formatCount(artist?.fans) }}</b></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ar-page {
  height: 100%;
  overflow-y: auto;
  padding: 12px 26px 40px;
}
.head {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 22px;
}
.avatar {
  box-shadow: 0 12px 30px rgba(20, 24, 32, 0.16);
  border-radius: 50% !important;
  overflow: hidden;
}
.meta {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.fans {
  font-size: 12px;
  color: var(--kg-text-3);
}
.intro {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--kg-text-3);
  line-height: 1.65;
  max-width: 700px;
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
.btn.followed {
  color: #0a8f52;
  border-color: #b7ebcd;
  background: #f2fcf6;
}
.tabs {
  display: flex;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--kg-line);
  margin-bottom: 14px;
}
.tab {
  padding: 8px 0 10px;
  font-size: 13px;
  color: var(--kg-text-2);
  position: relative;
}
.tab.active {
  color: var(--kg-text);
  font-weight: 600;
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -1px;
  width: 18px;
  height: 2px;
  background: var(--kg-accent);
  border-radius: 2px;
}
.spacer {
  flex: 1;
}
.sorts {
  display: flex;
  gap: 12px;
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.sorts button.on {
  color: var(--kg-text);
  font-weight: 600;
}
.grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 18px 16px;
}
.album {
  cursor: pointer;
}
.album-name {
  margin-top: 7px;
  font-size: 12.5px;
  line-height: 1.4;
}
.album-sub {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 3px;
}
.video-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.detail-box {
  padding: 8px 0;
  max-width: 760px;
}
.detail-box h3 {
  font-size: 14px;
  margin: 0 0 8px;
}
.detail-box p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--kg-text-2);
}
.facts {
  display: flex;
  gap: 40px;
  margin-top: 20px;
}
.facts div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.facts span {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.facts b {
  font-size: 18px;
}
.empty {
  grid-column: 1 / -1;
  padding: 40px;
  text-align: center;
  color: var(--kg-text-3);
  font-size: 12.5px;
}
</style>
