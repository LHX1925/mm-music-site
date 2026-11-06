<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { rankAudios, rankInfo } from '@/api';
import CoverImage from '@/components/common/CoverImage.vue';
import Icon from '@/components/common/Icon.vue';
import SongList from '@/components/common/SongList.vue';
import { useSongActions } from '@/composables/useSongActions';
import { formatCount } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const { playAll } = useSongActions();

const info = ref(null);
const songs = ref([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const loadingMore = ref(false);

const rankid = computed(() => String(route.params.id || ''));
const hasMore = computed(() => songs.value.length < total.value);

async function load() {
  loading.value = true;
  page.value = 1;
  try {
    const [i, s] = await Promise.allSettled([rankInfo(rankid.value), rankAudios(rankid.value, 1, 100)]);
    info.value = i.status === 'fulfilled' ? i.value : null;
    if (s.status === 'fulfilled') {
      songs.value = s.value.songs;
      total.value = s.value.total || s.value.songs.length;
    }
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value) return;
  loadingMore.value = true;
  page.value += 1;
  try {
    const res = await rankAudios(rankid.value, page.value, 100);
    const exists = new Set(songs.value.map((x) => `${x.hash}_${x.albumAudioId}`));
    songs.value.push(...res.songs.filter((x) => !exists.has(`${x.hash}_${x.albumAudioId}`)));
    total.value = res.total || total.value;
  } finally {
    loadingMore.value = false;
  }
}

onMounted(load);
watch(rankid, load);
</script>

<template>
  <div class="rd-page page-scroll">
    <div class="banner" :style="{ backgroundImage: info?.banner ? `url(${info.banner})` : '' }">
      <div class="mask" />
      <div class="banner-inner">
        <CoverImage :src="info?.cover" :size="120" :radius="10" class="bcover" />
        <div class="binfo">
          <div class="bname">{{ info?.name || '排行榜' }}</div>
          <div class="bsub">
            <span>{{ formatCount(info?.playCount) }} 次播放</span>
            <span v-if="info?.updateFrequency" class="dot">·</span>
            <span v-if="info?.updateFrequency">{{ info.updateFrequency }}</span>
          </div>
          <div class="bacts">
            <button class="btn primary" @click="playAll(songs, 0)">
              <Icon name="play" :size="14" color="#fff" filled /> 播放全部
            </button>
            <button class="btn" @click="router.push('/rank')">全部榜单</button>
          </div>
        </div>
      </div>
    </div>

    <SongList :songs="songs" :loading="loading" show-header empty-text="榜单暂无数据" />
    <div v-if="hasMore" class="load-more" @click="loadMore">
      {{ loadingMore ? '加载中…' : `加载更多（${songs.length}/${total}）` }}
    </div>
  </div>
</template>

<style scoped>
.rd-page {
  height: 100%;
  overflow-y: auto;
  padding: 0 26px 40px;
}
.banner {
  margin: 0 -26px 20px;
  padding: 26px 26px 22px;
  position: relative;
  background-size: cover;
  background-position: center;
  background-color: #f1f3f5;
}
.mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.96));
}
.banner-inner {
  position: relative;
  display: flex;
  gap: 18px;
  align-items: center;
}
.bcover {
  box-shadow: 0 10px 26px rgba(20, 24, 32, 0.16);
  border-radius: 10px;
  overflow: hidden;
}
.bname {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.bsub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--kg-text-2);
  margin: 8px 0 14px;
}
.dot {
  color: #c3c8d0;
}
.bacts {
  display: flex;
  gap: 10px;
}
.btn {
  height: 32px;
  padding: 0 15px;
  border-radius: 16px;
  background: var(--kg-surface);
  border: 1px solid var(--kg-line-2);
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn.primary {
  background: var(--kg-accent);
  border-color: var(--kg-accent);
  color: #fff;
  font-weight: 600;
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
</style>
