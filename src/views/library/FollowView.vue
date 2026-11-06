<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useLibraryStore } from '@/stores/library';
import { useUserStore } from '@/stores/user';
import { useUiStore } from '@/stores/ui';
import { formatCount } from '@/utils/format';

const library = useLibraryStore();
const user = useUserStore();
const ui = useUiStore();
const router = useRouter();
const loading = ref(false);

async function load() {
  if (!user.isLogin) return;
  loading.value = true;
  try {
    await library.loadFollowSingers();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="lib-page page-scroll">
    <div class="head">
      <h1>关注的歌手</h1>
      <span class="sub">{{ library.followSingers.length }} 位</span>
      <div class="spacer" />
      <button class="btn ghost" @click="load"><Icon name="refresh" :size="13" /> 刷新</button>
    </div>

    <div v-if="!user.isLogin" class="empty">
      <Icon name="singer" :size="34" color="#c6cbd4" />
      <div class="empty-title">登录后同步你关注的歌手</div>
      <button class="btn primary" @click="ui.openLogin()">立即登录</button>
    </div>

    <div v-else v-loading="loading" class="grid">
      <div v-for="a in library.followSingers" :key="a.id" class="artist" @click="router.push(`/artist/${a.id}`)">
        <CoverImage :src="a.cover" :size="104" :radius="52" />
        <div class="name ellipsis">{{ a.name }}</div>
        <div class="sub">{{ formatCount(a.fans) }} 粉丝</div>
      </div>
      <div v-if="!library.followSingers.length && !loading" class="tip">还没有关注歌手，去歌手页发现更多</div>
    </div>
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
  align-items: baseline;
  gap: 12px;
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
.spacer {
  flex: 1;
}
.btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 15px;
  font-size: 12px;
}
.btn.ghost {
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
  color: var(--kg-text-2);
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn.primary {
  margin-top: 12px;
  background: var(--kg-accent);
  color: #fff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 22px 12px;
}
.artist {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  text-align: center;
}
.name {
  margin-top: 8px;
  font-size: 12.5px;
  max-width: 100%;
}
.sub {
  font-size: 10.5px;
  color: var(--kg-text-3);
}
.empty {
  padding: 70px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.empty-title {
  font-size: 13px;
  color: var(--kg-text-2);
  margin-top: 4px;
}
.tip {
  grid-column: 1 / -1;
  text-align: center;
  font-size: 12px;
  color: var(--kg-text-3);
  padding: 30px;
}
</style>
