<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
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
const loading = ref(false);

async function load() {
  if (!user.isLogin) return;
  loading.value = true;
  try {
    await library.loadCloud();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="lib-page page-scroll">
    <div class="head">
      <h1>音乐云盘</h1>
      <span class="sub">上传的歌曲可跨设备播放</span>
      <div class="spacer" />
      <button class="btn" :disabled="!library.cloudSongs.length" @click="playAll(library.cloudSongs, 0)">
        <Icon name="play" :size="13" color="#fff" filled /> 播放全部
      </button>
      <button class="btn ghost" @click="load"><Icon name="refresh" :size="13" /> 刷新</button>
    </div>

    <div v-if="!user.isLogin" class="empty">
      <Icon name="cloud" :size="34" color="#c6cbd4" />
      <div class="empty-title">登录后查看你的云盘音乐</div>
      <button class="btn primary" @click="ui.openLogin()">立即登录</button>
    </div>

    <template v-else>
      <div class="hint">
        <Icon name="cloud" :size="13" color="#7d838f" />
        云盘歌曲通过酷狗账号同步，删除与上传请前往手机客户端操作
      </div>
      <SongList :songs="library.cloudSongs" :loading="loading" show-header :show-album="false" empty-text="云盘还没有歌曲" />
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
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
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
.btn.primary {
  margin-top: 12px;
}
.btn:disabled {
  opacity: 0.5;
}
.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--kg-text-3);
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
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
</style>
