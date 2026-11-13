<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { rankAudios, rankList, searchHot, searchLyrics, searchSongs, searchSuggest } from '@/api';
import { usePlayerStore } from '@/stores/player';
import Icon from '@/components/common/Icon.vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useUpdateStore } from '@/stores/update';
import { platformIcon } from '@/utils/brand';

const app = useAppStore();
const ui = useUiStore();
const update = useUpdateStore();
const player = usePlayerStore();
const router = useRouter();
const route = useRoute();

const keyword = ref('');
const focused = ref(false);
const suggests = ref([]);
const hot = ref([]);
const hotGroups = ref([]);
const hotTab = ref('hot');
const maximized = ref(false);
const matchSongs = ref([]);
const matchLyrics = ref([]);
let timer = null;

/** 搜索记录（本地保存最近 8 条） */
const HISTORY_KEY = 'kg-search-history';
function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
      .filter((x) => typeof x === 'string' && x.trim())
      .slice(0, 8);
  } catch {
    return [];
  }
}
const history = ref(readHistory());
function addHistory(q) {
  const next = [q, ...history.value.filter((x) => x !== q)].slice(0, 8);
  history.value = next;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
}
function clearHistory() {
  history.value = [];
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** 面板里的三个榜单页签：热搜榜 / DJ榜 / 外语热搜 */
const djList = ref([]);
const foreignList = ref([]);
const tabLoading = ref({});

/** 聚合面板的快捷入口 */
const quickLinks = [
  { key: 'daily', label: '每日推荐', icon: 'q-daily', color: '#2f9cf4', path: '/' },
  { key: 'rank', label: '排行榜', icon: 'q-rank', color: '#3894f3', path: '/rank' },
  { key: 'category', label: '分类', icon: 'q-category', color: '#4aa8f0', path: '/discover?tab=playlist' },
  { key: 'new', label: '首发', icon: 'q-new', color: '#2f80ed', path: '/discover?tab=album' },
];

/** 当前页签展示的列表 */
const panelList = ref([]);

async function loadHot() {
  if (!hot.value.length) {
    try {
      const res = await searchHot();
      hotGroups.value = res.groups || [];
      const main = (res.groups || []).find((g) => /热搜|热歌/.test(g.name || '')) || (res.groups || [])[0];
      hot.value = (main?.keywords?.length ? main.keywords : res.flat || []).slice(0, 10);
    } catch {
      hot.value = [];
      hotGroups.value = [];
    }
  }
  applyTab();
}

/** 榜单名字里挑一个最像的（DJ 榜 / 外语榜没有独立接口，用排行榜数据兜底） */
async function loadRankTab(kind) {
  const target = kind === 'dj' ? djList : foreignList;
  if (target.value.length || tabLoading.value[kind]) return;
  tabLoading.value = { ...tabLoading.value, [kind]: true };
  const re = kind === 'dj' ? /DJ|电音|舞曲|夜店|车载/i : /欧美|英语|外语|日语|韩语|俄语/i;
  try {
    // /search/hot 本身就带 DJ榜 / 外语热搜分组，优先用官方热搜词
    const group = (hotGroups.value || []).find((g) => re.test(g.name || ''));
    if (group?.keywords?.length) {
      target.value = group.keywords.slice(0, 10);
    } else {
      const ranks = await rankList().catch(() => []);
      const flat = [];
      for (const r of ranks || []) {
        flat.push(r);
        if (Array.isArray(r.children)) flat.push(...r.children);
      }
      const pick = flat.find((r) => r.id && re.test(r.name || ''));
      if (pick) {
        const res = await rankAudios(pick.id, 1, 10).catch(() => ({ songs: [] }));
        target.value = (res.songs || []).map((x) => x.name).filter(Boolean).slice(0, 10);
      }
    }
  } finally {
    tabLoading.value = { ...tabLoading.value, [kind]: false };
    if (hotTab.value === kind) applyTab();
  }
}

function applyTab() {
  if (hotTab.value === 'dj') panelList.value = djList.value.length ? djList.value : hot.value;
  else if (hotTab.value === 'foreign') panelList.value = foreignList.value.length ? foreignList.value : hot.value;
  else panelList.value = hot.value;
}

function switchTab(tab) {
  hotTab.value = tab;
  if (tab === 'hot') applyTab();
  else {
    if (!panelList.value.length) panelList.value = hot.value;
    loadRankTab(tab);
  }
}

/**
 * 搜索下拉挂到 body（Teleport），彻底脱离标题栏的 backdrop-filter 玻璃层，
 * 深色 / 液态玻璃下也不会再透出后面的歌单。位置按搜索框实时计算。
 */
const searchWrap = ref(null);
const panelPos = ref({ left: 0, top: 56, width: 360 });

function updatePanelPos() {
  const r = searchWrap.value?.getBoundingClientRect();
  if (!r) return;
  const w = Math.min(360, Math.max(300, window.innerWidth - 16));
  panelPos.value = {
    left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
    top: r.bottom + 8,
    width: w,
  };
}

function resetHot() {
  hot.value = [];
  hotGroups.value = [];
  djList.value = [];
  foreignList.value = [];
  loadHot();
}

function onFocus() {
  focused.value = true;
  updatePanelPos();
  loadHot();
}

function goQuick(path) {
  focused.value = false;
  router.push(path);
}

onMounted(async () => {
  if (window.kg) {
    maximized.value = await window.kg.isMaximized();
    window.kg.on('window:state', (s) => (maximized.value = s.maximized));
  }
  window.addEventListener('resize', updatePanelPos);
  updatePanelPos();
});
onBeforeUnmount(() => window.removeEventListener('resize', updatePanelPos));

watch(
  () => route.query.keywords,
  (v) => {
    if (typeof v === 'string') keyword.value = v;
  },
  { immediate: true }
);

watch(keyword, (v) => {
  clearTimeout(timer);
  const q = String(v || '').trim();
  if (!q) {
    suggests.value = [];
    matchSongs.value = [];
    matchLyrics.value = [];
    return;
  }
  timer = setTimeout(async () => {
    const [sg, ss, sl] = await Promise.allSettled([
      searchSuggest(q),
      searchSongs(q, 1, 5),
      searchLyrics(q, 1, 3),
    ]);
    suggests.value = sg.status === 'fulfilled' ? sg.value || [] : [];
    matchSongs.value = ss.status === 'fulfilled' ? ss.value?.songs || [] : [];
    matchLyrics.value = sl.status === 'fulfilled' ? (sl.value?.items || []).slice(0, 3) : [];
  }, 220);
});

function submit(kw = keyword.value) {
  const q = String(kw || '').trim();
  if (!q) return;
  addHistory(q);
  focused.value = false;
  keyword.value = q;
  router.push({ name: 'search', query: { keywords: q } });
}

/** 面板里点相关歌曲 / 歌词匹配结果，直接开播 */
function playSuggest(song) {
  focused.value = false;
  player.play(song);
}

function goBack() {
  router.back();
}
function goForward() {
  router.forward();
}
function refresh() {
  ui.refreshPage();
}
function togglePlatform() {
  app.togglePlatform();
}
function openGuide() {
  ui.openGuide(route.name);
}
async function min() {
  window.kg?.minimize();
}
async function max() {
  maximized.value = await window.kg?.maximize();
}
async function close() {
  window.kg?.close();
}
function openVip() {
  window.kg?.openExternal('https://vip.kugou.com/');
}
</script>

<template>
  <header class="titlebar">
    <div class="nav-btns">
      <button class="icon-btn" title="后退" @click="goBack"><Icon name="back" :size="17" /></button>
      <button class="icon-btn" title="前进" @click="goForward"><Icon name="forward" :size="17" /></button>
      <button class="icon-btn" title="刷新" @click="refresh"><Icon name="refresh" :size="16" /></button>
    </div>

    <div class="search-wrap" ref="searchWrap">
      <div class="search-box" :class="{ focused }">
        <Icon name="search" :size="15" color="#9aa0ab" />
        <input
          v-model="keyword"
          placeholder="搜索音乐"
          @focus="onFocus"
          @blur="focused = false"
          @keyup.enter="submit()"
        />
        <button v-if="keyword" class="clear" @click.stop="keyword = ''">
          <Icon name="close-small" :size="12" color="#9aa0ab" />
        </button>
      </div>
      <Teleport to="body">
        <transition name="fade">
          <div
            v-if="focused"
            class="suggest-panel"
            :style="{ left: panelPos.left + 'px', top: panelPos.top + 'px', width: panelPos.width + 'px' }"
            @mousedown.prevent
          >
          <!-- 快捷入口 -->
          <div class="quick-row">
            <button v-for="q in quickLinks" :key="q.key" class="quick" @click="goQuick(q.path)">
              <span class="quick-ico" :style="{ color: q.color }">
                <Icon :name="q.icon" :size="22" filled />
              </span>
              <span class="quick-label">{{ q.label }}</span>
            </button>
          </div>

          <!-- 输入关键词：联想词 + 相关歌曲 + 含这句歌词的歌 -->
          <template v-if="keyword.trim()">
            <template v-if="suggests.length">
              <div class="panel-title"><span>搜索建议</span></div>
              <button v-for="(t, i) in suggests" :key="'s' + i" class="suggest-item" @mousedown.prevent="submit(t)">
                <Icon name="search" :size="13" color="#b6bbc4" />
                <span class="ellipsis">{{ t }}</span>
              </button>
            </template>

            <template v-if="matchSongs.length">
              <div class="panel-title"><span>相关歌曲</span><span class="panel-sub">点击直接播放</span></div>
              <button v-for="(t, i) in matchSongs" :key="'m' + i" class="match-row" @mousedown.prevent="playSuggest(t)">
                <Icon name="note" :size="12" color="#2f9cf4" />
                <span class="ellipsis">{{ t.name }}</span>
                <span class="match-singer ellipsis">{{ t.singer }}</span>
              </button>
            </template>

            <template v-if="matchLyrics.length">
              <div class="panel-title"><span>含这句歌词的歌</span></div>
              <button v-for="(t, i) in matchLyrics" :key="'l' + i" class="match-row" @mousedown.prevent="playSuggest(t)">
                <Icon name="lyricbar" :size="12" color="#2f9cf4" />
                <span class="ellipsis">{{ t.name }}</span>
                <span class="match-singer ellipsis">{{ t.lyricSnippet || t.singer }}</span>
              </button>
            </template>

            <div v-if="!suggests.length && !matchSongs.length && !matchLyrics.length" class="rank-empty">
              正在查找相关歌曲…
            </div>
          </template>

          <!-- 未输入：搜索记录 + 猜你想搜 + 三个热搜榜 -->
          <template v-else>
            <template v-if="history.length">
              <div class="panel-title">
                <span>搜索记录</span>
                <button class="hist-clear" @mousedown.prevent="clearHistory">清空</button>
              </div>
              <div class="chips">
                <button v-for="h in history" :key="'h' + h" class="chip hist-chip" @mousedown.prevent="submit(h)">
                  <Icon name="clock" :size="11" /> {{ h }}
                </button>
              </div>
            </template>

            <div class="panel-title">
              <span>猜你想搜</span>
              <button class="refresh" title="换一批" @mousedown.prevent="resetHot">
                <Icon name="refresh" :size="12" />
              </button>
            </div>
            <div class="chips">
              <button v-for="h in hot.slice(0, 6)" :key="'c' + h" class="chip" @mousedown.prevent="submit(h)">{{ h }}</button>
            </div>

            <div class="rank-box">
              <div class="rank-tabs">
                <button class="rtab" :class="{ on: hotTab === 'hot' }" @mousedown.prevent="switchTab('hot')">
                  热搜榜
                  <Icon name="playcircle" :size="11" class="rtab-play" />
                </button>
                <button class="rtab" :class="{ on: hotTab === 'dj' }" @mousedown.prevent="switchTab('dj')">DJ榜</button>
                <button class="rtab" :class="{ on: hotTab === 'foreign' }" @mousedown.prevent="switchTab('foreign')">外语热搜</button>
              </div>
              <div class="rank-list">
                <button
                  v-for="(h, i) in panelList"
                  :key="hotTab + h + i"
                  class="rank-row"
                  @mousedown.prevent="submit(h)"
                >
                  <span class="rank-idx" :class="'n' + (i + 1)">{{ i + 1 }}</span>
                  <span class="ellipsis">{{ h }}</span>
                </button>
                <div v-if="!panelList.length" class="rank-empty">榜单加载中…</div>
              </div>
            </div>
          </template>
          </div>
        </transition>
      </Teleport>
    </div>

    <div class="right-area">
      <button class="platform-pill" :class="{ lite: app.platform === 'lite' }" :title="`当前 ${app.platform === 'lite' ? '酷狗音乐概念版' : '酷狗音乐'}，点击切换`" @click="togglePlatform">
        <img class="plat-logo" :src="platformIcon(app.platform)" alt="" draggable="false" />
        <span>{{ app.platform === 'lite' ? '概念版' : '标准版' }}</span>
        <Icon name="repeat" :size="12" />
      </button>

      <button
        v-if="update.badge"
        class="circle-btn update-bell"
        :title="`发现新版本 v${update.newVersion}，点击查看更新说明`"
        @click="update.openPanel()"
      >
        <Icon name="bell" :size="17" color="#d0453b" />
        <span class="red-dot" />
      </button>
      <button class="circle-btn" title="页面功能引导" @click="openGuide">
        <Icon name="question" :size="17" color="#4b515c" />
      </button>
      <button class="circle-btn" title="听歌识曲" @click="router.push('/discover?tab=identify')">
        <Icon name="note" :size="18" color="#4b515c" />
      </button>
      <button class="circle-btn" title="会员中心" @click="router.push('/vip')">
        <Icon name="crown" :size="17" color="#b98b3d" />
      </button>

      <div class="win-ctrls">
        <button class="win-btn" title="最小化" @click="min"><Icon name="minimize" :size="15" /></button>
        <button class="win-btn" title="最大化" @click="max">
          <Icon :name="maximized ? 'restore' : 'maximize'" :size="14" />
        </button>
        <button class="win-btn close" title="关闭" @click="close"><Icon name="close" :size="15" /></button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 0 16px;
  -webkit-app-region: drag;
  background: var(--kg-bg);
  flex: 0 0 60px;
}
.nav-btns {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
  transition: background 0.15s ease;
}
.icon-btn:hover {
  background: var(--kg-hover);
}
.search-wrap {
  position: relative;
  margin-left: 6px;
  -webkit-app-region: no-drag;
}
.search-box {
  width: 300px;
  height: 36px;
  border-radius: 18px;
  background: var(--kg-panel);
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  transition: background 0.15s ease, box-shadow 0.15s ease;
  border: 1px solid transparent;
}
.search-box.focused {
  background: var(--kg-surface);
  border-color: #d8f5e5;
  box-shadow: 0 0 0 3px rgba(var(--kg-accent-rgb), 0.08);
}
/* 液态玻璃下搜索框要够实，否则透出背景图后文字几乎看不清 */
[data-glass='on'] .search-box {
  background: #ffffff;
  border-color: rgba(150, 162, 178, 0.4);
  backdrop-filter: none;
}
[data-glass='on'] .search-box.focused {
  background: #ffffff;
  border-color: rgba(var(--kg-accent-rgb), 0.7);
  box-shadow: 0 0 0 3px rgba(var(--kg-accent-rgb), 0.16);
}
[data-glass='on'][data-theme='dark'] .search-box {
  background: #1b1e26;
  border-color: rgba(255, 255, 255, 0.18);
}
[data-glass='on'][data-theme='dark'] .search-box.focused {
  background: #1b1e26;
  border-color: rgba(var(--kg-accent-rgb), 0.7);
}
.search-box input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--kg-text);
}
.search-box input::placeholder {
  color: #a3a9b4;
}
.clear {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--kg-line-2);
  display: grid;
  place-items: center;
}
.suggest-panel {
  position: fixed;
  max-height: 440px;
  overflow-y: auto;
  padding: 13px 13px 11px;
  border-radius: 14px;
  /* 白底实色卡片 + Teleport 到 body：深色 / 液态玻璃下都绝不会透出背景 */
  background: #ffffff !important;
  color: #1f232a !important;
  border: 1px solid rgba(120, 150, 200, 0.28);
  box-shadow: 0 16px 42px rgba(12, 20, 36, 0.32);
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  z-index: 99999;
}
[data-glass='on'] .suggest-panel,
[data-glass='on'][data-theme='dark'] .suggest-panel,
[data-theme='dark'] .suggest-panel {
  background: #ffffff !important;
  color: #1f232a !important;
}
.quick-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}
.quick {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 0 4px;
  border-radius: 10px;
}
.quick:hover {
  background: #f3f7ff;
}
.quick-ico {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
}
.quick-label {
  font-size: 11.5px;
  color: #333a45;
}
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  margin: 6px 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: #1f232a;
}
.refresh {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #8b93a1;
}
.refresh:hover {
  background: #f0f4fb;
  color: #333a45;
}
.suggest-item {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 12.5px;
  color: #4a505c;
  text-align: left;
}
.suggest-item:hover {
  background: #f2f6fd;
}
.panel-sub {
  font-size: 10.5px;
  font-weight: 400;
  color: #9aa2b0;
}
.hist-clear {
  font-size: 11px;
  font-weight: 400;
  color: #8b93a1;
}
.hist-clear:hover {
  color: #2b74d8;
}
.hist-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.match-row {
  width: 100%;
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 12px;
  color: #3a404c;
  text-align: left;
}
.match-row > span:first-of-type {
  flex: 0 1 auto;
  min-width: 0;
}
.match-row:hover {
  background: #f2f6fd;
}
.match-singer {
  flex: 1 1 0;
  min-width: 0;
  text-align: right;
  font-size: 11px;
  color: #9aa2b0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 0 4px 6px;
}
.chip {
  height: 25px;
  padding: 0 10px;
  border-radius: 13px;
  background: #eff5ff;
  font-size: 11.5px;
  color: #5576a8;
}
[data-theme='dark'] .chip {
  background: #eff5ff;
  color: #5576a8;
}
.chip:hover {
  background: #dceaff;
  color: #2b74d8;
}
/* 榜单卡片：外圈描边 + 三个页签 + 带序号列表，对齐酷狗搜索面板 */
.rank-box {
  margin-top: 6px;
  border: 1px solid rgba(96, 160, 240, 0.28);
  border-radius: 12px;
  padding: 10px 10px 8px;
  background: linear-gradient(180deg, #f2f8ff 0%, #ffffff 42%);
}
[data-theme='dark'] .rank-box,
[data-glass='on'] .rank-box,
[data-glass='on'][data-theme='dark'] .rank-box {
  border-color: rgba(96, 160, 240, 0.28);
  background: linear-gradient(180deg, #f2f8ff 0%, #ffffff 42%);
}
.rank-tabs {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 2px 8px;
}
.rtab {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12.5px;
  color: #8b93a1;
  position: relative;
  padding-bottom: 8px;
}
.rtab.on {
  color: #1f232a;
  font-weight: 700;
}
.rtab.on::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background: var(--kg-accent);
}
.rtab-play {
  color: #2f9cf4;
}
.rank-list {
  display: flex;
  flex-direction: column;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 30px;
  padding: 0 5px;
  border-radius: 7px;
  font-size: 12px;
  color: #3a404c;
  text-align: left;
}
.rank-row:hover {
  background: #eef4ff;
}
.rank-idx {
  width: 14px;
  flex: 0 0 14px;
  font-size: 12px;
  font-weight: 700;
  font-style: italic;
  color: #a5acb8;
}
.rank-idx.n1 {
  color: #f5333f;
}
.rank-idx.n2 {
  color: #ff8b19;
}
.rank-idx.n3 {
  color: #f5c518;
}
.rank-empty {
  padding: 8px 4px 10px;
  font-size: 12px;
  color: #9aa2b0;
}

.right-area {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}
.platform-pill {
  height: 28px;
  padding: 0 10px;
  border-radius: 14px;
  background: var(--kg-panel);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--kg-text-2);
  font-weight: 500;
  transition: background 0.15s ease;
}
.platform-pill:hover {
  background: var(--kg-hover);
}
.plat-logo {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  object-fit: cover;
  flex: 0 0 18px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
}
.platform-pill.lite {
  background: var(--kg-accent-soft);
  color: var(--kg-accent-dark);
}
.circle-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--kg-line-2);
  background: var(--kg-surface);
  display: grid;
  place-items: center;
  transition: background 0.15s ease, transform 0.15s ease;
}
.circle-btn:hover {
  background: var(--kg-panel);
}
/* 有新版本：右上角一颗红点，轻轻呼吸，不会一直闪得晃眼 */
.update-bell {
  border-color: rgba(208, 69, 59, 0.35);
  background: rgba(208, 69, 59, 0.08);
}
.red-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid var(--kg-bg);
  box-sizing: content-box;
  animation: kg-dot-pulse 2.4s ease-in-out infinite;
}
@keyframes kg-dot-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.42); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .red-dot { animation: none; }
}
.win-ctrls {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
}
.win-btn {
  width: 34px;
  height: 30px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
}
.win-btn:hover {
  background: var(--kg-hover);
}
.win-btn.close:hover {
  background: #ffe8e8;
  color: #e5484d;
}
</style>
