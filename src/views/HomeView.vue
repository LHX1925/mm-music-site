<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { everydayRecommend, personalFm, rankAudios, rankList, recommendSongs, topPlaylists } from '@/api';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import PlaylistCard from '@/components/common/PlaylistCard.vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { usePlayerStore } from '@/stores/player';
import { useUserStore } from '@/stores/user';
import { useSongActions } from '@/composables/useSongActions';
import { songFlagsOf } from '@/utils/songFlags';
import { formatCount } from '@/utils/format';

const app = useAppStore();
const ui = useUiStore();
const user = useUserStore();
const player = usePlayerStore();
const router = useRouter();
const { playAll } = useSongActions();

const loading = ref(true);
const daily = ref([]);
/** 猜你喜欢 + 私人 FM：打卡卡片播的是这一份「打卡精选」，和下面的每日推荐是两套歌 */
const checkinPool = ref([]);
const playlists = ref([]);
const ranks = ref([]);
const dailyCover = ref('');
const poolBusy = ref(false);

const greetName = computed(() => (user.isLogin ? user.nickname : '酷狗用户'));

/** 打卡卡片的文案随时间变化（早/午/下午/晚/深夜各一套，按分钟轮换） */
const now = ref(new Date());
let clock = null;
onMounted(() => {
  clock = setInterval(() => (now.value = new Date()), 60 * 1000);
});
onBeforeUnmount(() => clearInterval(clock));

const checkin = computed(() => {
  const h = now.value.getHours();
  const buckets = [
    { end: 6, title: '夜深了', lines: ['别熬太晚，', '听首慢歌入眠吧~'] },
    { end: 9, title: '早安', lines: ['用一首轻快的歌，', '唤醒今天的好心情~'] },
    { end: 12, title: '上午好', lines: ['专注模式开启，', '来点节奏感提提神吧~'] },
    { end: 14, title: '午间小憩', lines: ['饭后放松一下，', '听点慵懒的调子吧~'] },
    { end: 18, title: '下午好', lines: ['来点音乐，', '把困意赶走吧~'] },
    { end: 21, title: '傍晚了', lines: ['下班路上，', '给自己配一首歌吧~'] },
    { end: 24, title: '晚上好', lines: ['夜晚适合慢下来，', '让音乐陪你一会儿~'] },
  ];
  const b = buckets.find((x) => h < x.end) || buckets[buckets.length - 1];
  return { title: b.title, lines: b.lines, time: h };
});
const heroSongs = computed(() => daily.value.slice(0, 6));

/** 首页快捷入口：插画来自 /assets/home，按功能各配一张 */
const quickEntries = [
  { label: '本地音乐', desc: '播放本机歌曲', path: '/local', img: '/assets/home/local-music.png' },
  { label: '音乐云盘', desc: '云端曲库', path: '/cloud', img: '/assets/home/cloud-disk.png' },
  { label: '听书电台', desc: '用耳朵读书', path: '/book', img: '/assets/home/live.png' },
  { label: '私人电台', desc: '越听越懂你', path: '/fm', img: '/assets/home/cloud.png' },
  { label: '试听列表', desc: '临时收听的歌', path: '/preview', img: '/assets/home/local.png' },
  { label: '排行榜', desc: '实时热歌榜', path: '/rank', icon: 'rank', color: '#2f9cf4' },
];

/** 每日推荐池：每日推荐 + 猜你喜欢 + 私人 FM 合并去重，保证数量足够多，播完还能继续 */
function mergeSongs(...groups) {
  const seen = new Set();
  const out = [];
  for (const g of groups) {
    for (const s of g || []) {
      if (!s?.hash) continue;
      const key = `${s.hash}_${s.albumAudioId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/** 歌曲唯一键 */
function keyOf(s) {
  return s?.hash ? `${s.hash}_${s.albumAudioId}` : '';
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 本次会话里已经露过面的歌，避免「换一批」反复给同几首 */
const seenPool = new Set();

async function load() {
  loading.value = true;
  try {
    const [rec, like, fm, pl, rk] = await Promise.allSettled([
      everydayRecommend(app.platform),
      recommendSongs(app.platform),
      personalFm(app.platform, { action: 'play' }),
      topPlaylists({ categoryId: 0, pagesize: 12 }),
      rankList(),
    ]);
    const recSongs = rec.status === 'fulfilled' ? rec.value.songs || [] : [];
    if (rec.status === 'fulfilled') dailyCover.value = rec.value.cover || '';
    const likeSongs = like.status === 'fulfilled' ? like.value || [] : [];
    const fmSongs = fm.status === 'fulfilled' ? fm.value || [] : [];
    // 打卡精选：只用「猜你喜欢 + 私人FM」，不掺下面的每日推荐
    checkinPool.value = mergeSongs(likeSongs, fmSongs);
    daily.value = mergeSongs(recSongs, likeSongs, fmSongs);
    daily.value.forEach((s) => seenPool.add(keyOf(s)));
    if (pl.status === 'fulfilled') playlists.value = (pl.value.playlists || []).slice(0, 12);
    if (rk.status === 'fulfilled') ranks.value = (rk.value || []).slice(0, 6);
  } finally {
    loading.value = false;
  }
}

/**
 * 取一批没露过面的新歌。
 * 私人 FM 在未登录时只会重复返回同 5 首，所以依次退到「猜你喜欢」和随机榜单，
 * 保证「换一批」每次都有实打实的新内容。
 */
async function fetchFreshBatch(limit = 30) {
  const out = [];
  const local = new Set();
  const consider = (list) => {
    for (const s of list || []) {
      if (out.length >= limit) return;
      const k = keyOf(s);
      if (!k || local.has(k) || seenPool.has(k)) continue;
      local.add(k);
      out.push(s);
    }
  };

  // 1) 私人 FM / 猜你喜欢：登录后最贴身的一路
  consider(await personalFm(app.platform, { action: 'play' }).catch(() => []));
  if (out.length < limit) consider(await recommendSongs(app.platform).catch(() => []));

  // 2) 随机榜单兜底：每次挑几个不同榜单、随机翻页，量大且每次都不一样
  if (out.length < limit) {
    let pool = ranks.value.filter((r) => r?.id);
    if (!pool.length) pool = (await rankList().catch(() => [])).filter((r) => r?.id);
    for (const r of shuffle(pool).slice(0, 4)) {
      if (out.length >= limit) break;
      const page = 1 + Math.floor(Math.random() * 3);
      const res = await rankAudios(r.id, page, 50).catch(() => ({ songs: [] }));
      consider(res.songs);
    }
  }

  return out;
}

/** 换一批：把新歌铺到最前面，老歌继续留在后面，播放队列不会断 */
async function refreshDaily() {
  if (poolBusy.value) return;
  poolBusy.value = true;
  try {
    let batch = await fetchFreshBatch(30);
    // 全站推荐都看过了：清空记忆重来一轮，保证按钮永远有反应
    if (!batch.length) {
      seenPool.clear();
      batch = await fetchFreshBatch(30);
    }
    if (!batch.length) {
      ElMessage({ message: '暂时没取到新的推荐，稍后再试一次', type: 'warning', grouping: true });
      return;
    }
    // 新的一批放最前，旧歌保留在后面（最多留 150 首，避免无限膨胀）
    daily.value = mergeSongs(batch, daily.value).slice(0, 150);
    batch.forEach((s) => seenPool.add(keyOf(s)));
    ElMessage({ message: `已换一批 · 新增 ${batch.length} 首`, type: 'success', grouping: true, duration: 1800 });
  } finally {
    poolBusy.value = false;
  }
}

onMounted(load);
watch(() => app.platform, load);

/** 点某一张推荐卡片：从这首开始播，整份列表面板里能看得到 */
function playDailyAt(i) {
  if (!daily.value.length) return;
  playAll(daily.value, i, '每日推荐');
}

/** 播放下面「每日推荐」这一整份列表 */
function playDaily() {
  const list = daily.value;
  if (!list.length) return;
  playAll(list, 0, '每日推荐');
}

/**
 * 打卡卡片上的圆形按钮：播「打卡精选」，不是下面那份每日推荐。
 * 打卡本身是个独立的推荐池（猜你喜欢 + 私人FM），播的时候队列名写成「打卡精选」，
 * 在播放列表里能直接看到这一份，不会再有「偷偷播了个找不到的歌单」的感觉。
 */
function playCheckin() {
  const list = checkinPool.value.length ? checkinPool.value : daily.value;
  if (!list.length) {
    ElMessage({ message: '打卡精选还没准备好，稍等一下再试', type: 'warning', grouping: true });
    return;
  }
  playAll(list, 0, '打卡精选');
}
</script>

<template>
  <div class="home page-scroll">
    <div class="greet">
      <div class="greet-left">
        <img class="greet-mascot" src="/assets/home/mama.png" alt="" draggable="false" />
        <h1>
          Hi {{ greetName }} <span class="greet-sub">今日为你推荐</span>
        </h1>
      </div>
      <button class="report" @click="router.push('/recent')">
        查看你的听歌报告
        <Icon name="arrow-right" :size="12" />
      </button>
    </div>

    <!-- 首屏卡片 -->
    <div class="hero">
      <!-- 打卡卡片：点击卡片本身不播放，只有圆形播放按钮才会播放 -->
      <div class="hero-main">
        <div class="hero-main-text">
          <span class="checkin-chip">打卡</span>
          <h3>{{ checkin.title }}</h3>
          <p>
            <span class="hero-line">{{ checkin.lines[0] }}</span>
            <span class="hero-line">{{ checkin.lines[1] }}</span>
          </p>
          <button class="hero-play" :title="`播放打卡精选（${checkinPool.length || daily.length || 30} 首）`" @click.stop="playCheckin">
            <Icon name="play" :size="16" color="#fff" filled />
          </button>
        </div>
        <div class="hero-cover">
          <span class="vinyl" />
          <CoverImage :src="dailyCover || heroSongs[0]?.cover" :size="72" :radius="8" class="hero-cover-img" />
        </div>
      </div>

      <div class="hero-card" @click="router.push('/fm')">
        <div class="hero-img">
          <CoverImage :src="heroSongs[1]?.cover || dailyCover" size="100%" :radius="8" />
          <div class="hero-mask">
            <span class="hero-tag">Daily 30</span>
          </div>
        </div>
        <div class="hero-cap ellipsis">{{ heroSongs[1] ? `${heroSongs[1].name} - ${heroSongs[1].singer}` : '猜你喜欢' }}</div>
        <div class="hero-sub ellipsis">猜你喜欢 · 沉浸刷歌</div>
      </div>

      <div class="hero-card" @click="playDaily">
        <div class="hero-img">
          <CoverImage :src="heroSongs[2]?.cover || dailyCover" size="100%" :radius="8" />
          <div class="hero-mask">
            <span class="hero-tag">{{ daily.length || 30 }} 首</span>
          </div>
        </div>
        <div class="hero-cap ellipsis">{{ heroSongs[2] ? `${heroSongs[2].name} - ${heroSongs[2].singer}` : '每日推荐' }}</div>
        <div class="hero-sub ellipsis">每日推荐 · 共 {{ daily.length || 30 }} 首</div>
      </div>

      <div class="hero-card" @click="router.push('/discover?tab=brush')">
        <div class="hero-img">
          <CoverImage :src="heroSongs[3]?.cover || dailyCover" size="100%" :radius="8" />
          <div class="hero-mask">
            <span class="hero-tag">刷歌</span>
          </div>
        </div>
        <div class="hero-cap ellipsis">{{ heroSongs[3]?.name || '发现好音乐' }}</div>
        <div class="hero-sub ellipsis">刷歌模式</div>
      </div>

      <div class="hero-card" @click="router.push('/discover?tab=ai')">
        <div class="hero-img">
          <CoverImage :src="heroSongs[4]?.cover || dailyCover" size="100%" :radius="8" />
          <div class="hero-mask">
            <span class="hero-tag">AI</span>
          </div>
        </div>
        <div class="hero-cap ellipsis">AI 伴听</div>
        <div class="hero-sub ellipsis">最懂你的音乐伙伴</div>
      </div>
    </div>

    <!-- 快捷入口：本地 / 云盘 / 听书 / 电台 / 试听 -->
    <div class="quick-row">
      <button v-for="q in quickEntries" :key="q.path" class="quick-card" @click="router.push(q.path)">
        <img v-if="q.img" class="quick-img" :src="q.img" alt="" draggable="false" />
        <span v-else class="quick-ico" :style="{ background: q.color + '1c', color: q.color }">
          <Icon :name="q.icon" :size="20" />
        </span>
        <span class="quick-text">
          <span class="quick-label">{{ q.label }}</span>
          <span class="quick-desc">{{ q.desc }}</span>
        </span>
        <Icon name="arrow-right" :size="12" class="quick-chev" />
      </button>
    </div>

    <!-- 每日推荐：整份歌单平铺，数量多、播完不会断 -->
    <div class="block">
      <SectionHeader title="每日推荐" :show-play="Boolean(daily.length)" @play="playDaily">
        <template #right>
          <span class="sub-note">共 {{ daily.length }} 首 · 每天更新</span>
          <button class="refresh-chip" :disabled="poolBusy" title="换一批每日推荐" @click="refreshDaily">
            <Icon name="refresh" :size="12" :class="{ spin: poolBusy }" />
            <span>换一批</span>
          </button>
        </template>
      </SectionHeader>

      <el-skeleton v-if="loading && !daily.length" :rows="6" animated />
      <div v-else class="daily-grid">
        <button
          v-for="(s, i) in daily"
          :key="s.hash + '_' + s.albumAudioId + '_' + i"
          class="daily-card"
          :class="{ on: player.current && player.current.hash === s.hash }"
          :title="`播放 ${s.name} - ${s.singer}`"
          @click="playDailyAt(i)"
        >
          <CoverImage :src="s.cover" :size="52" :radius="8" />
          <span class="dc-meta">
            <span class="dc-name">
              <span class="ellipsis">{{ s.name }}</span>
              <span v-if="songFlagsOf(s).isVip" class="badge-vip">VIP</span>
              <span v-if="songFlagsOf(s).hasMv" class="mv-tag">MV</span>
            </span>
            <span class="dc-singer ellipsis">{{ s.singer }}</span>
          </span>
          <Icon name="play" :size="14" class="dc-play" filled />
        </button>
        <div v-if="!daily.length" class="daily-empty">暂无推荐内容，登录后可获得更精准的每日推荐</div>
      </div>
    </div>

    <!-- 推荐歌单 -->
    <div class="block">
      <SectionHeader title="推荐歌单" more-text="更多" @more="router.push('/discover')">
        <template #right>
          <span class="sub-note">根据你的口味挑选</span>
        </template>
      </SectionHeader>
      <div class="pl-grid">
        <PlaylistCard v-for="pl in playlists" :key="pl.id" :playlist="pl" />
      </div>
      <el-skeleton v-if="loading && !playlists.length" :rows="2" animated />
    </div>

    <!-- 排行榜 -->
    <div class="block">
      <SectionHeader title="排行榜" more-text="全部榜单" @more="router.push('/rank')" />
      <div class="rank-grid">
        <div v-for="r in ranks.slice(0, 3)" :key="r.id" class="rank-card" @click="router.push(`/rank/${r.id}`)">
          <div class="rank-head">
            <CoverImage :src="r.cover" :size="56" :radius="8" />
            <div class="rank-meta">
              <div class="rank-name ellipsis">{{ r.name }}</div>
              <div class="rank-sub">播放 {{ formatCount(r.playCount) }}</div>
            </div>
            <button class="rank-play" @click.stop="playAll(r.songs, 0)">
              <Icon name="play" :size="12" color="#fff" filled />
            </button>
          </div>
          <div class="rank-songs">
            <div v-for="(s, i) in r.songs.slice(0, 4)" :key="i" class="rank-row">
              <span class="rank-idx" :class="{ top: i < 3 }">{{ i + 1 }}</span>
              <span class="ellipsis flex1">{{ s.name }}</span>
              <span class="rank-singer ellipsis">{{ s.singer }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  padding: 4px 26px 30px;
}
.page-scroll {
  height: 100%;
  overflow-y: auto;
}
.greet {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 18px;
}
.greet h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.greet-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.greet-mascot {
  height: 42px;
  width: auto;
  object-fit: contain;
  flex: 0 0 auto;
  filter: drop-shadow(0 4px 10px rgba(15, 20, 30, 0.12));
}

/* 快捷入口 */
.quick-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 24px;
}
.quick-ico {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}
.quick-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
  text-align: left;
  min-width: 0;
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}
.quick-card:hover {
  background: var(--kg-hover);
  border-color: var(--kg-line-2);
  transform: translateY(-1px);
}
.quick-img {
  width: 38px;
  height: 38px;
  object-fit: contain;
  flex: 0 0 38px;
}
.quick-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.quick-label {
  font-size: 12.5px;
  color: var(--kg-text);
  font-weight: 500;
}
.quick-desc {
  font-size: 10.5px;
  color: var(--kg-text-3);
  margin-top: 2px;
}
.quick-chev {
  color: var(--kg-text-3);
  opacity: 0;
  transition: opacity 0.15s ease;
  flex: 0 0 auto;
}
.quick-card:hover .quick-chev {
  opacity: 1;
}
.greet-sub {
  color: var(--kg-text);
}
.report {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--kg-text-2);
}
.report:hover {
  color: var(--kg-text);
}

.hero {
  display: grid;
  /* 打卡卡片与四张副卡同一行，行高由副卡固定高度决定，蓝色卡片因此是横向长方形而不是方块 */
  grid-template-columns: 1.9fr repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 22px;
  max-width: 1180px;
}
.hero-main {
  border-radius: 10px;
  /* 跟随主题：单色主题是纯色，渐变主题直接铺渐变 */
  background: var(--kg-accent-grad, linear-gradient(135deg, var(--kg-accent) 0%, var(--kg-accent-dark) 100%));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  overflow: hidden;
  position: relative;
}
.hero-main::after {
  content: '';
  position: absolute;
  width: 140px;
  height: 140px;
  right: -50px;
  bottom: -76px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}
.checkin-chip {
  display: inline-flex;
  align-items: center;
  height: 17px;
  padding: 0 7px;
  margin-bottom: 5px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
  font-size: 10.5px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 1px;
}
.hero-main-text {
  min-width: 0;
  flex: 1;
}
.hero-main-text h3 {
  margin: 0 0 3px;
  font-size: 17px;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hero-main-text p {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.92);
  min-width: 0;
}
.hero-line {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hero-play {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--kg-accent);
  display: grid;
  place-items: center;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
}
.hero-cover {
  position: relative;
  flex: 0 0 auto;
  transform: translateX(-2px);
  padding-right: 10px;
}
.vinyl {
  position: absolute;
  right: -14px;
  top: 50%;
  width: 64px;
  height: 64px;
  margin-top: -32px;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #2a2a2f 0 24%, transparent 25%),
    repeating-radial-gradient(circle at center, #17171a 0 2px, #232327 2px 3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  z-index: 0;
}
.hero-cover-img {
  position: relative;
  z-index: 1;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
}
.hero-card {
  min-width: 0;
  cursor: pointer;
}
.hero-img {
  position: relative;
  width: 100%;
  /* 固定高度而不是 1:1：整行变矮，打卡卡片自然成横向长方形 */
  height: 104px;
  border-radius: 8px;
  overflow: hidden;
}
.hero-mask {
  position: absolute;
  inset: auto 0 0 0;
  padding: 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
  display: flex;
  align-items: flex-end;
}
.hero-tag {
  font-size: 11px;
  color: #fff;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.hero-cap {
  font-size: 12px;
  margin-top: 7px;
  color: var(--kg-text);
}
.hero-sub {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 2px;
}

.block {
  margin-bottom: 30px;
}
.daily-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.daily-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
  text-align: left;
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}
.daily-card:hover {
  background: var(--kg-hover);
  border-color: var(--kg-line-2);
  transform: translateY(-1px);
}
.daily-card.on {
  border-color: rgba(var(--kg-accent-rgb), 0.55);
}
.dc-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dc-name {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--kg-text);
}
.dc-singer {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.dc-play {
  flex: 0 0 auto;
  color: var(--kg-accent);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.daily-card:hover .dc-play {
  opacity: 1;
}
.daily-empty {
  grid-column: 1 / -1;
  padding: 28px 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--kg-text-3);
}
@media (max-width: 1180px) {
  .daily-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.refresh-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: 13px;
  background: var(--kg-panel);
  border: 1px solid var(--kg-line);
  font-size: 11.5px;
  color: var(--kg-text-2);
  transition: background 0.15s ease, color 0.15s ease;
}
.refresh-chip:hover {
  background: var(--kg-hover);
  color: var(--kg-text);
}
.refresh-chip:disabled {
  opacity: 0.6;
  cursor: default;
}
.vip-banner-text {
  font-size: 11.5px;
  color: var(--kg-text-2);
}
.vip-price {
  font-size: 11.5px;
  color: var(--kg-accent-dark);
  font-weight: 600;
}
.sub-note {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-right: 10px;
}
.spin {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.pl-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 18px 16px;
}
.rank-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.rank-card {
  border-radius: 10px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
  padding: 12px;
  cursor: pointer;
  transition: box-shadow 0.16s ease, transform 0.16s ease;
}
.rank-card:hover {
  box-shadow: 0 8px 22px rgba(20, 24, 32, 0.07);
  transform: translateY(-1px);
}
.rank-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.rank-meta {
  flex: 1;
  min-width: 0;
}
.rank-name {
  font-size: 13px;
  font-weight: 600;
}
.rank-sub {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 3px;
}
.rank-play {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--kg-accent);
  display: grid;
  place-items: center;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  font-size: 12px;
  color: var(--kg-text-2);
}
.rank-idx {
  width: 14px;
  font-size: 11px;
  color: var(--kg-text-3);
}
.rank-idx.top {
  color: #ef6c3f;
  font-weight: 600;
}
.flex1 {
  flex: 1;
  min-width: 0;
}
.rank-singer {
  font-size: 11px;
  color: var(--kg-text-3);
  max-width: 40%;
}
.empty {
  padding: 26px;
  text-align: center;
  color: var(--kg-text-3);
  font-size: 12.5px;
  background: var(--kg-panel-2);
  border-radius: 10px;
}
.link {
  color: var(--kg-accent-dark);
  margin-left: 6px;
}
@media (max-width: 1180px) {
  .pl-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .quick-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
