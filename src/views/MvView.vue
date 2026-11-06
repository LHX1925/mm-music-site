<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { mvStream, videoUrl } from '@/api';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useAppStore } from '@/stores/app';
import { usePlayerStore } from '@/stores/player';

const route = useRoute();
const app = useAppStore();
const player = usePlayerStore();
const detail = ref(null);
const url = ref('');
const loading = ref(true);
const hash = computed(() => String(route.params.hash || ''));

async function load() {
  loading.value = true;
  url.value = '';
  detail.value = null;
  // 看 MV 时暂停正在播放的歌曲，避免两个声音叠在一起
  if (player.playing) player.pause();
  const key = hash.value;
  if (!key) {
    loading.value = false;
    return;
  }
  try {
    // 32 位十六进制 = 视频 hash，其他当作 video_id 走详情接口
    if (/^[0-9a-fA-F]{32}$/.test(key)) {
      const data = await videoUrl(key, app.platform);
      const item = data?.[key.toLowerCase()] || Object.values(data || {})[0] || {};
      url.value = item.downurl || (Array.isArray(item.backupdownurl) ? item.backupdownurl[0] : '') || '';
      detail.value = item;
    } else {
      const res = await mvStream(key, app.platform);
      url.value = res.url || '';
      detail.value = res.info || null;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(hash, load);
</script>

<template>
  <div class="mv-page page-scroll">
    <div class="player" v-loading="loading">
      <video v-if="url" :src="url" controls autoplay class="video" @play="player.playing && player.pause()" />
      <div v-else class="placeholder">
        <Icon name="mv" :size="38" color="#c2c7d0" />
        <div class="ph-text">该 MV 暂无可用播放地址（可能受版权限制）</div>
      </div>
    </div>
    <div class="info">
      <CoverImage :src="String(detail?.hdpic || detail?.thumb || detail?.imgurl || '').replace('{size}', '400')" :size="92" :radius="8" />
      <div class="meta">
        <h1>{{ detail?.video_name || detail?.mv_name || detail?.name || 'MV' }}</h1>
        <div class="sub">{{ detail?.author_name || detail?.singer || '' }}</div>
        <div class="stats">
          <span>播放 {{ detail?.play_count || detail?.playcount || 0 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mv-page {
  height: 100%;
  overflow-y: auto;
  padding: 8px 26px 40px;
}
.player {
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 62vh;
  background: #0f1115;
  border-radius: 12px;
  overflow: hidden;
  display: grid;
  place-items: center;
}
.video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.placeholder {
  display: grid;
  place-items: center;
  gap: 10px;
}
.ph-text {
  font-size: 12.5px;
  color: #9aa0ab;
}
.info {
  display: flex;
  gap: 14px;
  margin-top: 18px;
  align-items: center;
}
.meta h1 {
  margin: 0 0 6px;
  font-size: 19px;
  font-weight: 700;
}
.sub {
  font-size: 12px;
  color: var(--kg-text-2);
}
.stats {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 6px;
}
</style>
