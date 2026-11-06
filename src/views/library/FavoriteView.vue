<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '@/components/common/Icon.vue';
import SongList from '@/components/common/SongList.vue';
import { useLibraryStore } from '@/stores/library';
import { useSongActions } from '@/composables/useSongActions';

const library = useLibraryStore();
const router = useRouter();
const { playAll } = useSongActions();

const songs = computed(() => library.favorites);
</script>

<template>
  <div class="lib-page page-scroll">
    <div class="hero">
      <div class="hero-icon"><Icon name="heart" :size="30" color="#fff" filled /></div>
      <div class="hero-meta">
        <h1>我喜欢的音乐</h1>
        <div class="sub">{{ songs.length }} 首 · 仅保存在当前设备</div>
      </div>
      <button class="btn primary" :disabled="!songs.length" @click="playAll(songs, 0)">
        <Icon name="play" :size="14" color="#fff" filled /> 播放全部
      </button>
    </div>

    <SongList :songs="songs" show-header empty-text="还没有喜欢的歌曲，点击歌曲行的爱心即可收藏" />
    <div v-if="!songs.length" class="tip">
      去 <button class="link" @click="router.push('/')">首页</button> 发现好音乐
    </div>
  </div>
</template>

<style scoped>
.lib-page {
  height: 100%;
  overflow-y: auto;
  padding: 10px 26px 40px;
}
.hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  border-radius: 14px;
  background: linear-gradient(120deg, #fdeef2, #f6f7fa);
  margin-bottom: 20px;
}
.hero-icon {
  width: 62px;
  height: 62px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ff7a9c, #e8436b);
  display: grid;
  place-items: center;
  box-shadow: 0 10px 24px rgba(232, 67, 107, 0.24);
}
.hero-meta {
  flex: 1;
}
.hero-meta h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.sub {
  font-size: 11.5px;
  color: var(--kg-text-2);
  margin-top: 6px;
}
.btn {
  height: 34px;
  padding: 0 18px;
  border-radius: 17px;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn.primary {
  background: var(--kg-accent);
  color: #fff;
  font-weight: 600;
}
.btn:disabled {
  opacity: 0.5;
}
.tip {
  text-align: center;
  font-size: 12px;
  color: var(--kg-text-3);
  padding: 10px;
}
.link {
  color: var(--kg-accent-dark);
}
</style>
