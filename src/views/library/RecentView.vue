<script setup>
import { computed, onMounted, ref } from 'vue';
import Icon from '@/components/common/Icon.vue';
import SongList from '@/components/common/SongList.vue';
import { useLibraryStore } from '@/stores/library';
import { useUserStore } from '@/stores/user';
import { useUiStore } from '@/stores/ui';
import { useSongActions } from '@/composables/useSongActions';

const library = useLibraryStore();
const user = useUserStore();
const ui = useUiStore();
const { playAll } = useSongActions();

const tab = ref('local');
const rankRange = ref(0);
const loading = ref(false);

const songs = computed(() => {
  if (tab.value === 'local') return library.recent;
  return library.listenRank.length ? library.listenRank : library.listenHistory;
});

async function loadCloud() {
  if (!user.isLogin) return;
  loading.value = true;
  try {
    await Promise.allSettled([library.loadListenRank(rankRange.value), library.loadListenHistory()]);
  } finally {
    loading.value = false;
  }
}

function changeTab(t) {
  tab.value = t;
  if (t === 'cloud') loadCloud();
}

function changeRange(r) {
  rankRange.value = r;
  loadCloud();
}

onMounted(() => {
  if (user.isLogin) loadCloud();
});
</script>

<template>
  <div class="lib-page page-scroll">
    <div class="head">
      <h1>最近播放</h1>
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'local' }" @click="changeTab('local')">本机记录</button>
        <button class="tab" :class="{ active: tab === 'cloud' }" @click="changeTab('cloud')">云端排行</button>
      </div>
      <div v-if="tab === 'cloud' && user.isLogin" class="range">
        <button class="r" :class="{ on: rankRange === 1 }" @click="changeRange(1)">本周</button>
        <button class="r" :class="{ on: rankRange === 0 }" @click="changeRange(0)">全部</button>
      </div>
      <div class="spacer" />
      <button class="btn" :disabled="!songs.length" @click="playAll(songs, 0)">
        <Icon name="play" :size="13" color="#fff" filled /> 播放全部
      </button>
      <button v-if="tab === 'local' && songs.length" class="btn ghost" @click="library.clearRecent()">
        <Icon name="trash" :size="13" /> 清空
      </button>
      <button v-if="tab === 'cloud' && user.isLogin" class="btn ghost" @click="loadCloud">
        <Icon name="refresh" :size="13" /> 刷新
      </button>
    </div>

    <!-- 云端排行需要登录：之前这里什么都不显示，看起来像功能坏了 -->
    <div v-if="tab === 'cloud' && !user.isLogin" class="notice">
      <Icon name="cloud" :size="30" color="var(--kg-text-3)" />
      <div class="notice-title">登录后查看云端听歌排行</div>
      <div class="notice-sub">登录酷狗账号，自动同步你在各端的听歌数据</div>
      <button class="primary" @click="ui.openLogin()">立即登录</button>
    </div>
    <template v-else>
      <div v-if="tab === 'cloud' && library.listenRankError" class="notice small">
        <div class="notice-title">云端排行暂时拉取失败</div>
        <div class="notice-sub">{{ library.listenRankError }}</div>
        <button class="primary" @click="loadCloud">重试</button>
      </div>
      <SongList
        :songs="songs"
        :loading="loading"
        show-header
        :empty-text="tab === 'cloud' ? '这个时间范围内还没有听歌记录' : '还没有播放记录'"
      />
    </template>
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
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.tabs {
  display: flex;
  gap: 14px;
}
.tab {
  font-size: 12.5px;
  color: var(--kg-text-2);
  padding: 4px 0;
  position: relative;
}
.tab.active {
  color: var(--kg-text);
  font-weight: 600;
}
.tab.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 2px;
  background: var(--kg-accent);
  border-radius: 2px;
}
.range {
  display: flex;
  gap: 4px;
  padding: 2px;
  border-radius: 12px;
  background: var(--kg-panel);
}
.r {
  height: 22px;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.r.on {
  background: var(--kg-surface);
  color: var(--kg-text);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(20, 26, 38, 0.08);
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
.notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 54px 20px;
  border-radius: 12px;
  background: var(--kg-panel-2);
  border: 1px dashed var(--kg-line-2);
  text-align: center;
}
.notice.small {
  padding: 26px 20px;
  margin-bottom: 12px;
}
.notice-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--kg-text);
}
.notice-sub {
  font-size: 12px;
  color: var(--kg-text-3);
}
.primary {
  margin-top: 6px;
  height: 30px;
  padding: 0 18px;
  border-radius: 15px;
  background: var(--kg-accent);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
}
</style>
