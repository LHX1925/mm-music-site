<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  aiRecommend,
  albumNew,
  artistLists,
  brush,
  effectPlaylists,
  fmClass,
  fmRecommend,
  playlistTags,
  rankList,
  themePlaylists,
  topPlaylists,
  yueku,
} from '@/api';
import { normalizeAlbum, normalizeArtist, normalizePlaylist, normalizeSongs, img } from '@/api/normalize';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import PlaylistCard from '@/components/common/PlaylistCard.vue';
import SongGrid from '@/components/common/SongGrid.vue';
import SongList from '@/components/common/SongList.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import IdentifyPanel from '@/components/discover/IdentifyPanel.vue';
import { useAppStore } from '@/stores/app';
import { useSongActions } from '@/composables/useSongActions';
import { formatCount } from '@/utils/format';

const app = useAppStore();
const route = useRoute();
const router = useRouter();
const { playAll } = useSongActions();

const tabs = [
  { key: 'recommend', label: '推荐' },
  { key: 'playlist', label: '歌单' },
  { key: 'rank', label: '排行榜' },
  { key: 'artist', label: '歌手' },
  { key: 'album', label: '新碟' },
  { key: 'radio', label: '电台' },
  { key: 'brush', label: '刷歌' },
  { key: 'ai', label: 'AI 推荐' },
  { key: 'identify', label: '听歌识曲' },
];

const tab = ref(String(route.query.tab || 'recommend'));

const loading = ref(false);
const yuekuData = ref({});
const playlists = ref([]);
const tags = ref([]);
const activeTag = ref(0);
const childTags = ref([]);
const ranks = ref([]);
const artists = ref([]);
const artistType = ref(1);
const albums = ref([]);
const fm = ref({});
const fmClasses = ref([]);
const brushSongs = ref([]);
const aiSongs = ref([]);
const themes = ref([]);
const effects = ref([]);

const yuekuPlaylists = computed(() => {
  const map = yuekuData.value?.info || {};
  const raw = map.recommend || map.custom_special || [];
  return raw.map(normalizePlaylist).filter((p) => p.id);
});
const yuekuAlbums = computed(() => {
  const raw = yuekuData.value?.info?.album || [];
  return raw.map((a) => normalizeAlbum(a.album_info || a)).filter((a) => a.id);
});

async function loadRecommend() {
  loading.value = true;
  try {
    const res = await yueku(app.platform);
    yuekuData.value = res || {};
    const [t, e] = await Promise.allSettled([themePlaylists(), effectPlaylists()]);
    themes.value = t.status === 'fulfilled' ? t.value.slice(0, 6) : [];
    effects.value = e.status === 'fulfilled' ? e.value.slice(0, 6) : [];
  } finally {
    loading.value = false;
  }
}

async function loadPlaylists() {
  loading.value = true;
  try {
    if (!tags.value.length) {
      const raw = await playlistTags();
      tags.value = Array.isArray(raw) ? raw : Object.values(raw || {});
      childTags.value = tags.value[0]?.son || [];
    }
    const res = await topPlaylists({ categoryId: activeTag.value || 0, pagesize: 24 });
    playlists.value = res.playlists;
  } finally {
    loading.value = false;
  }
}

async function loadRanks() {
  loading.value = true;
  try {
    ranks.value = await rankList();
  } finally {
    loading.value = false;
  }
}

async function loadArtists() {
  loading.value = true;
  try {
    artists.value = await artistLists(1, 60, artistType.value);
  } finally {
    loading.value = false;
  }
}

async function loadAlbums() {
  loading.value = true;
  try {
    albums.value = await albumNew(1, 24);
  } finally {
    loading.value = false;
  }
}

async function loadRadio() {
  loading.value = true;
  try {
    const [r, c] = await Promise.allSettled([fmRecommend(app.platform), fmClass(app.platform)]);
    fm.value = r.status === 'fulfilled' ? r.value : {};
    fmClasses.value = c.status === 'fulfilled' ? c.value : [];
  } finally {
    loading.value = false;
  }
}

async function loadBrush() {
  loading.value = true;
  try {
    const raw = await brush(app.platform);
    brushSongs.value = normalizeSongs(raw);
  } catch (e) {
    ElMessage.warning(e.message || '刷歌推荐加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadAi() {
  loading.value = true;
  try {
    const res = await aiRecommend(app.platform, {});
    const list = res?.song_list || res?.list || res?.songs || res?.data || [];
    aiSongs.value = normalizeSongs(Array.isArray(list) ? list : []);
  } catch (e) {
    ElMessage.warning(e.message || 'AI 推荐加载失败');
  } finally {
    loading.value = false;
  }
}

function loadTab(key) {
  if (key === 'recommend') return loadRecommend();
  if (key === 'playlist') return loadPlaylists();
  if (key === 'rank') return loadRanks();
  if (key === 'artist') return loadArtists();
  if (key === 'album') return loadAlbums();
  if (key === 'radio') return loadRadio();
  if (key === 'brush') return loadBrush();
  if (key === 'ai') return loadAi();
}

function changeTab(key) {
  tab.value = key;
  router.replace({ query: { ...route.query, tab: key } });
  loadTab(key);
}

async function changeGroup(tag) {
  activeTag.value = tag.tag_id;
  childTags.value = tag.son || [];
  await loadPlaylists();
}

async function changeChild(tag) {
  activeTag.value = tag.tag_id;
  await loadPlaylists();
}

watch(
  () => app.platform,
  () => loadTab(tab.value)
);

onMounted(() => loadTab(tab.value));
</script>

<template>
  <div class="discover page-scroll">
    <div class="top">
      <h1>发现音乐</h1>
      <div class="tabs">
        <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="changeTab(t.key)">
          {{ t.label }}
        </button>
      </div>
    </div>

    <div v-loading="loading" class="content">
      <!-- 推荐 -->
      <template v-if="tab === 'recommend'">
        <section class="block">
          <SectionHeader title="精选歌单" more-text="更多歌单" @more="changeTab('playlist')" />
          <div class="pl-grid">
            <PlaylistCard v-for="p in yuekuPlaylists.slice(0, 6)" :key="p.id" :playlist="p" />
          </div>
        </section>

        <section v-if="yuekuAlbums.length" class="block">
          <SectionHeader title="新碟上架" more-text="全部新碟" @more="changeTab('album')" />
          <div class="album-row">
            <div v-for="a in yuekuAlbums.slice(0, 6)" :key="a.id" class="album" @click="router.push(`/album/${a.id}`)">
              <CoverImage :src="a.cover" :size="132" :radius="9" />
              <div class="album-name ellipsis">{{ a.name }}</div>
              <div class="album-sub ellipsis">{{ a.singer }}</div>
            </div>
          </div>
        </section>

        <section v-if="themes.length" class="block">
          <SectionHeader title="主题音乐" />
          <div class="pl-grid">
            <PlaylistCard v-for="p in themes" :key="p.id" :playlist="p" />
          </div>
        </section>

        <section v-if="effects.length" class="block">
          <SectionHeader title="音效歌单" />
          <div class="pl-grid">
            <PlaylistCard v-for="p in effects" :key="p.id" :playlist="p" />
          </div>
        </section>
      </template>

      <!-- 歌单 -->
      <template v-else-if="tab === 'playlist'">
        <div class="tag-groups">
          <button
            v-for="g in tags.slice(0, 8)"
            :key="g.tag_id"
            class="tag-group"
            :class="{ active: activeTag === Number(g.tag_id) }"
            @click="changeGroup(g)"
          >
            {{ g.tag_name }}
          </button>
        </div>
        <div v-if="childTags.length" class="chips">
          <button
            v-for="c in childTags"
            :key="c.tag_id"
            class="chip"
            :class="{ active: activeTag === Number(c.tag_id) }"
            @click="changeChild(c)"
          >
            {{ c.tag_name }}
          </button>
        </div>
        <div class="pl-grid wide">
          <PlaylistCard v-for="p in playlists" :key="p.id" :playlist="p" />
        </div>
        <div v-if="!playlists.length && !loading" class="empty">该分类下暂无歌单</div>
      </template>

      <!-- 排行榜 -->
      <template v-else-if="tab === 'rank'">
        <div class="rank-grid">
          <div v-for="r in ranks" :key="r.id" class="rank-card" @click="router.push(`/rank/${r.id}`)">
            <div class="rank-cover">
              <CoverImage :src="r.cover" size="100%" :radius="9" />
              <button class="play" @click.stop="playAll(r.songs, 0)"><Icon name="play" :size="13" color="#fff" filled /></button>
            </div>
            <div class="rank-meta">
              <div class="rank-name ellipsis">{{ r.name }}</div>
              <div class="rank-sub">{{ formatCount(r.playCount) }} 播放</div>
              <div v-for="(s, i) in r.songs.slice(0, 3)" :key="i" class="rank-song">
                <span class="i" :class="{ top: i === 0 }">{{ i + 1 }}</span>
                <span class="ellipsis">{{ s.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 歌手 -->
      <template v-else-if="tab === 'artist'">
        <div class="chips">
          <button v-for="t in [{ k: 1, l: '热门' }, { k: 2, l: '华语' }, { k: 3, l: '欧美' }, { k: 4, l: '日韩' }]" :key="t.k"
            class="chip" :class="{ active: artistType === t.k }" @click="artistType = t.k; loadArtists()">
            {{ t.l }}
          </button>
        </div>
        <div class="artist-grid">
          <div v-for="a in artists" :key="a.id" class="artist" @click="router.push(`/artist/${a.id}`)">
            <CoverImage :src="a.cover" :size="104" :radius="52" />
            <div class="artist-name ellipsis">{{ a.name }}</div>
            <div class="artist-sub">{{ formatCount(a.fans) }} 粉丝</div>
          </div>
        </div>
      </template>

      <!-- 新碟 -->
      <template v-else-if="tab === 'album'">
        <div class="album-grid">
          <div v-for="a in albums" :key="a.id" class="album-card" @click="router.push(`/album/${a.id}`)">
            <CoverImage :src="a.cover" :size="160" :radius="10" />
            <div class="album-name clamp-2">{{ a.name }}</div>
            <div class="album-sub ellipsis">{{ a.singer }}</div>
          </div>
        </div>
      </template>

      <!-- 电台 -->
      <template v-else-if="tab === 'radio'">
        <section class="block">
          <SectionHeader title="为你推荐电台" />
          <div class="pl-grid">
            <PlaylistCard
              v-for="(c, i) in fmClasses.slice(0, 12)"
              :key="i"
              :playlist="{
                id: '',
                name: c.name || c.fm_name || '电台',
                cover: img(c.pic || c.imgurl || c.fm_icon, 300),
                playCount: c.play_count || c.user_num || 0,
                creator: c.desc || '',
              }"
            />
          </div>
        </section>
        <div class="empty-tip">点击侧边栏「电台」或首页轮播卡片可进入私人 FM 沉浸播放</div>
      </template>

      <!-- 刷刷 -->
      <template v-else-if="tab === 'brush'">
        <SectionHeader title="刷歌模式" :show-play="brushSongs.length > 0" @play="playAll(brushSongs, 0)">
          <template #right>
            <button class="brush-refresh" @click="loadBrush"><Icon name="refresh" :size="12" /> 换一批</button>
            <span class="sub-note">根据你的口味实时推荐</span>
          </template>
        </SectionHeader>
        <SongGrid :songs="brushSongs" :columns="3" />
        <div v-if="!brushSongs.length && !loading" class="empty">暂时没刷到歌，点「换一批」再试试</div>
      </template>

      <!-- AI -->
      <template v-else-if="tab === 'ai'">
        <SectionHeader title="AI 伴听" :show-play="aiSongs.length > 0" @play="playAll(aiSongs, 0)">
          <template #right><span class="sub-note">基于 AI 场景理解的连续推荐</span></template>
        </SectionHeader>
        <SongList v-if="aiSongs.length" :songs="aiSongs" show-header />
        <div v-else class="empty">AI 推荐暂时不可用，稍后再试</div>
      </template>

      <!-- 识曲 -->
      <template v-else>
        <IdentifyPanel />
      </template>
    </div>
  </div>
</template>

<style scoped>
.brush-refresh {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  margin-right: 10px;
  border-radius: 13px;
  background: var(--kg-panel);
  border: 1px solid var(--kg-line);
  font-size: 11.5px;
  color: var(--kg-text-2);
}
.brush-refresh:hover {
  background: var(--kg-hover);
  color: var(--kg-text);
}
.discover {
  height: 100%;
  overflow-y: auto;
  padding: 8px 26px 34px;
}
.top h1 {
  margin: 0 0 14px;
  font-size: 22px;
  font-weight: 700;
}
.tabs {
  display: flex;
  gap: 22px;
  border-bottom: 1px solid var(--kg-line);
  margin-bottom: 18px;
  overflow-x: auto;
}
.tab {
  padding: 6px 0 10px;
  font-size: 13px;
  color: var(--kg-text-2);
  white-space: nowrap;
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
.block {
  margin-bottom: 28px;
}
.pl-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
}
.pl-grid.wide {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 20px 16px;
  margin-top: 8px;
}
.album-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
}
.album {
  cursor: pointer;
  min-width: 0;
}
.album-name {
  margin-top: 7px;
  font-size: 12.5px;
}
.album-sub {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 3px;
}
.tag-groups {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.tag-group {
  height: 28px;
  padding: 0 14px;
  border-radius: 14px;
  font-size: 12px;
  background: var(--kg-panel);
  color: var(--kg-text-2);
}
.tag-group.active {
  background: #1c1d21;
  color: #fff;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.chip {
  height: 26px;
  padding: 0 12px;
  border-radius: 13px;
  font-size: 11.5px;
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
  color: var(--kg-text-2);
}
.chip.active {
  color: #0a8f52;
  border-color: #b7ebcd;
  background: #f2fcf6;
}
.rank-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.rank-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
}
.rank-card:hover {
  background: var(--kg-panel-2);
}
.rank-cover {
  position: relative;
  width: 96px;
  height: 96px;
  flex: 0 0 96px;
}
.rank-cover .play {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  opacity: 0;
}
.rank-card:hover .play {
  opacity: 1;
}
.rank-meta {
  min-width: 0;
  flex: 1;
}
.rank-name {
  font-size: 12.5px;
  font-weight: 600;
}
.rank-sub {
  font-size: 10.5px;
  color: var(--kg-text-3);
  margin: 3px 0 6px;
}
.rank-song {
  display: flex;
  gap: 5px;
  align-items: center;
  height: 20px;
  font-size: 11px;
  color: var(--kg-text-2);
}
.rank-song .i {
  width: 10px;
  color: var(--kg-text-3);
  font-size: 10px;
}
.rank-song .i.top {
  color: #ef6c3f;
}
.artist-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 20px 12px;
}
.artist {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  text-align: center;
}
.artist-name {
  margin-top: 8px;
  font-size: 12.5px;
  max-width: 100%;
}
.artist-sub {
  font-size: 10.5px;
  color: var(--kg-text-3);
  margin-top: 2px;
}
.album-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 20px 16px;
}
.album-card {
  cursor: pointer;
  min-width: 0;
}
.sub-note {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.empty {
  padding: 50px;
  text-align: center;
  color: var(--kg-text-3);
  font-size: 12.5px;
}
.empty-tip {
  margin-top: 10px;
  font-size: 12px;
  color: var(--kg-text-3);
}
@media (max-width: 1180px) {
  .pl-grid,
  .album-row,
  .pl-grid.wide,
  .album-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .rank-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .artist-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
