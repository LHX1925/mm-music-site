<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { searchByType, searchHot, searchLyrics, searchSongs } from '@/api';
import { normalizeAlbum, normalizeArtist, normalizePlaylist, normalizeSongs, img } from '@/api/normalize';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import SongList from '@/components/common/SongList.vue';
import { useUiStore } from '@/stores/ui';
import { useAppStore } from '@/stores/app';
import { useSongActions } from '@/composables/useSongActions';
import { formatCount } from '@/utils/format';
import { songFlagsOf } from '@/utils/songFlags';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();
const app = useAppStore();
const { play } = useSongActions();

const tabs = [
  { key: 'song', label: '单曲' },
  { key: 'lyric', label: '歌词' },
  { key: 'special', label: '歌单' },
  { key: 'author', label: '歌手' },
  { key: 'album', label: '专辑' },
  { key: 'mv', label: 'MV' },
];
const tab = ref(app.settings.searchMode === 'lyric' ? 'lyric' : 'song');
const keyword = computed(() => String(route.query.keywords || ''));
const loading = ref(false);
const total = ref(0);
const songs = ref([]);
const lyricList = ref([]);
const lists = ref([]);
const hot = ref([]);
const history = ref(JSON.parse(localStorage.getItem('kg-search-history') || '[]'));

const isBlank = computed(() => !keyword.value);

async function loadHot() {
  try {
    const res = await searchHot();
    // searchHot 现在返回 { groups, flat }，这里要的是热搜词数组
    hot.value = (Array.isArray(res) ? res : res.flat || []).slice(0, 10);
  } catch {
    hot.value = [];
  }
}

async function search() {
  if (!keyword.value) return;
  loading.value = true;
  try {
    if (tab.value === 'song') {
      const res = await searchSongs(keyword.value, 1, 60);
      songs.value = res.songs;
      total.value = res.total;
    } else if (tab.value === 'lyric') {
      const res = await searchLyrics(keyword.value, 1, 40);
      lyricList.value = res.items;
      total.value = res.total;
    } else {
      const res = await searchByType(keyword.value, tab.value, 1, 40);
      total.value = res.total;
      const raw = res.lists || [];
      if (tab.value === 'special') lists.value = raw.map(normalizePlaylist);
      else if (tab.value === 'author') lists.value = raw.map(normalizeArtist);
      else if (tab.value === 'album') lists.value = raw.map(normalizeAlbum);
      else lists.value = raw;
    }
  } catch (e) {
    ElMessage.error(e.message || '搜索失败');
  } finally {
    loading.value = false;
  }
}

function saveHistory(kw) {
  const next = [kw, ...history.value.filter((h) => h !== kw)].slice(0, 12);
  history.value = next;
  localStorage.setItem('kg-search-history', JSON.stringify(next));
}

function submit(kw) {
  if (!kw) return;
  saveHistory(kw);
  router.push({ name: 'search', query: { keywords: kw } });
}

function clearHistory() {
  history.value = [];
  localStorage.removeItem('kg-search-history');
}

/** 歌词片段高亮关键词 */
function highlight(text) {
  const raw = String(text || '');
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const kw = keyword.value.trim();
  if (!kw) return escaped;
  const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return escaped.replace(re, (m) => `<mark>${m}</mark>`);
}

watch([keyword, tab], search, { immediate: true });
onMounted(loadHot);
</script>

<template>
  <div class="search-page page-scroll">
    <div v-if="isBlank" class="blank">
      <section class="block">
        <div class="sec-head">
          <h2>热门搜索</h2>
          <button class="ghost" @click="loadHot"><Icon name="refresh" :size="13" /> 换一批</button>
        </div>
        <div class="chips">
          <button v-for="(h, i) in hot" :key="h" class="chip" :class="{ hot: i < 3 }" @click="submit(h)">
            <span class="chip-idx">{{ i + 1 }}</span>{{ h }}
          </button>
        </div>
      </section>

      <section v-if="history.length" class="block">
        <div class="sec-head">
          <h2>搜索历史</h2>
          <button class="ghost" @click="clearHistory"><Icon name="trash" :size="13" /> 清空</button>
        </div>
        <div class="chips">
          <button v-for="h in history" :key="h" class="chip plain" @click="submit(h)">{{ h }}</button>
        </div>
      </section>
    </div>

    <template v-else>
      <div class="head">
        <div class="kw">“{{ keyword }}” 的搜索结果</div>
        <span class="total">共 {{ total }} 条</span>
      </div>

      <div class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-loading="loading">
        <SongList v-if="tab === 'song'" :songs="songs" show-header empty-text="没有找到相关歌曲" />

        <div v-else-if="tab === 'lyric'" class="lyric-results">
          <div
            v-for="(s, i) in lyricList"
            :key="`${s.hash}-${i}`"
            class="lyric-item"
            @dblclick="play(s, lyricList)"
          >
            <CoverImage :src="s.cover" :size="50" :radius="7" />
            <div class="lyric-meta">
              <div class="lyric-title">
                <span class="ellipsis">{{ s.name }}</span>
                <span class="badge-vip" v-if="songFlagsOf(s).isVip">VIP</span>
              </div>
              <div class="lyric-singer ellipsis">{{ s.singer }}</div>
              <div class="lyric-text" v-html="highlight(s.lyricSnippet)" />
            </div>
            <button class="lyric-play" @click.stop="play(s, lyricList)">
              <Icon name="play" :size="13" color="#fff" filled />
            </button>
          </div>
          <div v-if="!lyricList.length && !loading" class="empty">没有匹配的歌词，换个词试试</div>
        </div>

        <div v-else-if="tab === 'special'" class="grid-cards">
          <div v-for="pl in lists" :key="pl.id" class="pl-row" @click="router.push(`/playlist/${pl.id}`)">
            <CoverImage :src="pl.cover" :size="72" :radius="8" />
            <div class="pl-info">
              <div class="pl-name clamp-2">{{ pl.name }}</div>
              <div class="pl-sub">{{ pl.creator || '酷狗音乐' }} · {{ formatCount(pl.playCount) }} 播放</div>
            </div>
          </div>
        </div>

        <div v-else-if="tab === 'author'" class="grid-cards">
          <div v-for="a in lists" :key="a.id" class="ar-row" @click="router.push(`/artist/${a.id}`)">
            <CoverImage :src="a.cover" :size="84" :radius="42" />
            <div class="ar-name ellipsis">{{ a.name }}</div>
            <div class="pl-sub">{{ formatCount(a.fans) }} 粉丝</div>
          </div>
        </div>

        <div v-else-if="tab === 'album'" class="grid-cards">
          <div v-for="al in lists" :key="al.id" class="al-row" @click="router.push(`/album/${al.id}`)">
            <CoverImage :src="al.cover" :size="110" :radius="8" />
            <div class="al-name clamp-2">{{ al.name }}</div>
            <div class="pl-sub ellipsis">{{ al.singer }}</div>
          </div>
        </div>

        <div v-else class="grid-cards">
          <div v-for="(m, i) in lists" :key="i" class="al-row">
            <CoverImage :src="img(m.Image || m.imgurl || m.pic, 320)" :size="160" :radius="8" />
            <div class="al-name clamp-2">{{ m.MvName || m.name || m.SongName }}</div>
            <div class="pl-sub ellipsis">{{ m.SingerName || m.singer }}</div>
          </div>
        </div>

        <div v-if="!loading && !songs.length && !lists.length && !lyricList.length" class="empty">
          没有找到与「{{ keyword }}」相关的内容，换个关键词试试
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.search-page {
  height: 100%;
  overflow-y: auto;
  padding: 4px 26px 30px;
}
.blank {
  padding-top: 8px;
}
.block {
  margin-bottom: 28px;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.sec-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.ghost {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.ghost:hover {
  color: var(--kg-text);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  height: 30px;
  padding: 0 14px;
  border-radius: 15px;
  background: var(--kg-panel);
  font-size: 12.5px;
  color: #454b55;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease, color 0.15s ease;
}
.chip:hover {
  background: var(--kg-hover);
}
.chip.hot {
  background: #fff5f0;
  color: #d9603a;
}
.chip.plain {
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
}
.chip-idx {
  font-size: 11px;
  opacity: 0.7;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 4px 0 14px;
}
.kw {
  font-size: 18px;
  font-weight: 700;
}
.total {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.tabs {
  display: flex;
  gap: 22px;
  border-bottom: 1px solid var(--kg-line);
  margin-bottom: 12px;
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
  border-radius: 2px;
  background: var(--kg-accent);
}
.grid-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 22px;
  padding-top: 8px;
}
.pl-row {
  display: flex;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  padding: 6px;
  border-radius: 9px;
}
.pl-row:hover {
  background: var(--kg-panel-2);
}
.pl-info {
  min-width: 0;
}
.pl-name {
  font-size: 13px;
  line-height: 1.45;
}
.pl-sub {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 5px;
}
.ar-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}
.ar-name {
  font-size: 12.5px;
  max-width: 100%;
}
.al-row {
  cursor: pointer;
  min-width: 0;
}
.al-name {
  margin-top: 7px;
  font-size: 12.5px;
  line-height: 1.4;
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: var(--kg-text-3);
  font-size: 12.5px;
}

.lyric-results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 6px;
}
.lyric-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 8px;
  border-radius: 10px;
  cursor: default;
}
.lyric-item:hover {
  background: var(--kg-panel-2);
}
.lyric-meta {
  flex: 1;
  min-width: 0;
}
.lyric-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--kg-text);
}
.lyric-singer {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 3px;
}
.lyric-text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--kg-text-2);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.lyric-text :deep(mark) {
  background: rgba(var(--kg-accent-rgb), 0.18);
  color: var(--kg-accent-dark);
  border-radius: 3px;
  padding: 0 2px;
  font-weight: 600;
}
.lyric-play {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--kg-accent);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.lyric-item:hover .lyric-play {
  opacity: 1;
}
</style>
