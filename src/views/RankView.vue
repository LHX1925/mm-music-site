<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { rankList } from '@/api';
import CoverImage from '@/components/common/CoverImage.vue';
import Icon from '@/components/common/Icon.vue';
import { useAppStore } from '@/stores/app';
import { useSongActions } from '@/composables/useSongActions';
import { formatCount } from '@/utils/format';

const app = useAppStore();
const router = useRouter();
const { playAll } = useSongActions();
const loading = ref(true);
const ranks = ref([]);
const activeGroup = ref('all');

const groups = computed(() => {
  const map = new Map();
  ranks.value.forEach((r) => {
    const key = r.raw?.classify === 2 ? '特色' : r.raw?.classify === 3 ? '地区' : '热门';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  return [{ key: 'all', label: '全部' }, ...[...map.keys()].map((k) => ({ key: k, label: k }))];
});

const shown = computed(() => {
  if (activeGroup.value === 'all') return ranks.value;
  return ranks.value.filter((r) => {
    const key = r.raw?.classify === 2 ? '特色' : r.raw?.classify === 3 ? '地区' : '热门';
    return key === activeGroup.value;
  });
});

async function load() {
  loading.value = true;
  try {
    ranks.value = await rankList();
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(() => app.platform, load);
</script>

<template>
  <div class="rank-page page-scroll">
    <div class="head">
      <h1>排行榜</h1>
      <div class="groups">
        <button
          v-for="g in groups"
          :key="g.key"
          class="group"
          :class="{ active: activeGroup === g.key }"
          @click="activeGroup = g.key"
        >
          {{ g.label }}
        </button>
      </div>
    </div>

    <div v-loading="loading" class="grid">
      <div v-for="r in shown" :key="r.id" class="card" @click="router.push(`/rank/${r.id}`)">
        <div class="card-cover">
          <CoverImage :src="r.cover" size="100%" :radius="10" />
          <button class="play" @click.stop="playAll(r.songs, 0)">
            <Icon name="play" :size="14" color="#fff" filled />
          </button>
        </div>
        <div class="card-meta">
          <div class="card-name ellipsis">{{ r.name }}</div>
          <div class="card-sub">{{ formatCount(r.playCount) }} 次播放</div>
          <div class="songs">
            <div v-for="(s, i) in r.songs.slice(0, 3)" :key="i" class="song-row">
              <span class="idx" :class="{ top: i === 0 }">{{ i + 1 }}</span>
              <span class="ellipsis">{{ s.name }}</span>
              <span class="singer ellipsis">{{ s.singer }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rank-page {
  height: 100%;
  overflow-y: auto;
  padding: 8px 26px 30px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.groups {
  display: flex;
  gap: 8px;
}
.group {
  height: 28px;
  padding: 0 14px;
  border-radius: 14px;
  font-size: 12px;
  color: var(--kg-text-2);
  background: var(--kg-panel);
}
.group.active {
  background: #1c1d21;
  color: #fff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 16px;
}
.card {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.card:hover {
  background: var(--kg-panel-2);
}
.card-cover {
  position: relative;
  width: 100px;
  height: 100px;
  flex: 0 0 100px;
}
.play {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.card:hover .play {
  opacity: 1;
}
.card-meta {
  min-width: 0;
  flex: 1;
}
.card-name {
  font-size: 13px;
  font-weight: 600;
}
.card-sub {
  font-size: 11px;
  color: var(--kg-text-3);
  margin: 3px 0 8px;
}
.song-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  font-size: 11.5px;
  color: var(--kg-text-2);
}
.idx {
  width: 12px;
  color: var(--kg-text-3);
  font-size: 10.5px;
}
.idx.top {
  color: #ef6c3f;
  font-weight: 700;
}
.singer {
  font-size: 10.5px;
  color: var(--kg-text-3);
  max-width: 42%;
  margin-left: auto;
}
@media (max-width: 1180px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
