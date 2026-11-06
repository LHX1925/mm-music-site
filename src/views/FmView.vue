<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { personalFm } from '@/api';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import SongList from '@/components/common/SongList.vue';
import { useAppStore } from '@/stores/app';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useSongActions } from '@/composables/useSongActions';

const app = useAppStore();
const player = usePlayerStore();
const library = useLibraryStore();
const { playAll } = useSongActions();

const loading = ref(false);
const songs = ref([]);
const started = ref(false);

const hero = computed(() => songs.value[0] || player.current);

async function load(autoPlay = false) {
  loading.value = true;
  try {
    const list = await personalFm(app.platform, { action: 'play' });
    songs.value = list;
    if (autoPlay && list.length) {
      playAll(list, 0);
      started.value = true;
    }
  } catch (e) {
    ElMessage.warning(e.message || '私人 FM 加载失败，登录后体验更佳');
  } finally {
    loading.value = false;
  }
}

function dislike() {
  const cur = player.current;
  if (cur) songs.value = songs.value.filter((s) => s.hash !== cur.hash);
  player.next();
}

onMounted(async () => {
  await load(false);
});
watch(() => app.platform, () => load(false));
</script>

<template>
  <div class="fm-page page-scroll">
    <div class="hero">
      <div class="hero-bg" :style="{ backgroundImage: hero?.coverBig ? `url(${hero.coverBig})` : '' }" />
      <div class="hero-content">
        <div class="tag"><Icon name="radio" :size="13" /> 私人 FM · 猜你喜欢</div>
        <h1>{{ started ? player.current?.name || '正在为你播放' : '为你定制的私人电台' }}</h1>
        <p class="desc">
          {{ started ? `${player.current?.singer || ''} · ${player.current?.album || ''}` : '根据你的听歌口味实时生成，越听越懂你' }}
        </p>
        <div class="hero-acts">
          <button class="btn primary" @click="load(true)">
            <Icon name="play" :size="15" color="#fff" filled />
            {{ started ? '换一批继续听' : '开始收听' }}
          </button>
          <button class="btn" :disabled="!player.current" @click="library.toggleFavorite(player.current)">
            <Icon name="heart" :size="15" :filled="library.isFavorite(player.current)" /> 喜欢
          </button>
          <button class="btn" :disabled="!player.current" @click="dislike">
            <Icon name="close-small" :size="15" /> 不喜欢
          </button>
        </div>
      </div>
      <div class="hero-cover">
        <CoverImage :src="hero?.cover" :size="176" :radius="12" />
      </div>
    </div>

    <div class="rec">
      <div class="rec-head">
        <h2>本批推荐</h2>
        <button class="play-all" @click="playAll(songs, 0)">
          <Icon name="play" :size="12" color="#fff" filled /> 播放全部
        </button>
      </div>
      <SongList :songs="songs" :loading="loading" show-header :show-album="false" empty-text="暂无推荐歌曲" />
    </div>
  </div>
</template>

<style scoped>
.fm-page {
  height: 100%;
  overflow-y: auto;
  padding: 8px 26px 40px;
}
.hero {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  padding: 26px 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: #f4f6f8;
  margin-bottom: 26px;
}
.hero-bg {
  position: absolute;
  inset: -30px;
  background-size: cover;
  background-position: center;
  filter: blur(40px) saturate(1.4);
  opacity: 0.55;
}
.hero-content {
  position: relative;
  z-index: 1;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #0a8f52;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 3px 9px;
}
.hero h1 {
  margin: 12px 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #12151a;
}
.desc {
  margin: 0 0 18px;
  font-size: 12.5px;
  color: #4d545f;
}
.hero-acts {
  display: flex;
  gap: 10px;
}
.btn {
  height: 34px;
  padding: 0 16px;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.9);
  color: #333a44;
  border: 1px solid rgba(0, 0, 0, 0.06);
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
.btn:disabled {
  opacity: 0.5;
}
.hero-cover {
  position: relative;
  z-index: 1;
  box-shadow: 0 18px 40px rgba(20, 24, 32, 0.24);
  border-radius: 12px;
  overflow: hidden;
}
.rec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.rec-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}
.play-all {
  height: 28px;
  padding: 0 12px;
  border-radius: 14px;
  background: #1c1d21;
  color: #fff;
  font-size: 11.5px;
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
