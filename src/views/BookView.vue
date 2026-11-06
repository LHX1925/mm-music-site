<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { longaudioDaily, longaudioRank, longaudioVip, longaudioWeek } from '@/api';
import { img } from '@/api/normalize';
import CoverImage from '@/components/common/CoverImage.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import { useAppStore } from '@/stores/app';
import { formatCount } from '@/utils/format';

const app = useAppStore();
const router = useRouter();
const loading = ref(true);
const sections = ref([]);

function normalizeAlbumItem(x) {
  const info = x.album_info || x.info || x;
  return {
    id: info.album_id || x.album_id || x.id,
    name: info.album_name || x.album_name || x.name || '听书专辑',
    cover: img(info.sizable_cover || info.cover || x.cover || x.pic, 300),
    author: info.author_name || x.author_name || x.author || '',
    playCount: info.play_count || x.play_count || 0,
    intro: x.intro || info.intro || '',
  };
}

async function load() {
  loading.value = true;
  try {
    const [daily, week, vip, rank] = await Promise.allSettled([
      longaudioDaily(app.platform),
      longaudioWeek(app.platform),
      longaudioVip(app.platform),
      longaudioRank(app.platform),
    ]);
    sections.value = [
      { key: 'daily', title: '每日推荐', list: daily.status === 'fulfilled' ? daily.value.map(normalizeAlbumItem) : [] },
      { key: 'week', title: '每周精选', list: week.status === 'fulfilled' ? week.value.map(normalizeAlbumItem) : [] },
      { key: 'vip', title: 'VIP 专享', list: vip.status === 'fulfilled' ? vip.value.map(normalizeAlbumItem) : [] },
      { key: 'rank', title: '听书榜单', list: rank.status === 'fulfilled' ? rank.value.map(normalizeAlbumItem) : [] },
    ].filter((s) => s.list.length);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => app.platform, load);
</script>

<template>
  <div class="book-page page-scroll">
    <div class="head">
      <h1>听书</h1>
      <span class="sub">用耳朵读完一本书</span>
    </div>

    <div v-loading="loading">
      <section v-for="s in sections" :key="s.key" class="block">
        <SectionHeader :title="s.title" />
        <div class="grid">
          <div v-for="b in s.list.slice(0, 12)" :key="b.id" class="card" @click="router.push(`/book/${b.id}`)">
            <CoverImage :src="b.cover" :size="132" :radius="10" />
            <div class="name clamp-2">{{ b.name }}</div>
            <div class="meta ellipsis">{{ b.author }} · {{ formatCount(b.playCount) }}</div>
          </div>
        </div>
      </section>
      <div v-if="!loading && !sections.length" class="empty">听书内容加载失败，请稍后重试</div>
    </div>
  </div>
</template>

<style scoped>
.book-page {
  height: 100%;
  overflow-y: auto;
  padding: 8px 26px 40px;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 18px;
}
.head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.sub {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.block {
  margin-bottom: 28px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 18px 16px;
}
.card {
  cursor: pointer;
  min-width: 0;
}
.name {
  margin-top: 7px;
  font-size: 12.5px;
  line-height: 1.45;
}
.meta {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 4px;
}
.empty {
  padding: 60px;
  text-align: center;
  color: var(--kg-text-3);
  font-size: 12.5px;
}
</style>
