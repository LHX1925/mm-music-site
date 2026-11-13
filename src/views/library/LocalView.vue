<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import Icon from '@/components/common/Icon.vue';
import SongList from '@/components/common/SongList.vue';
import { useAppStore } from '@/stores/app';
import { useLibraryStore } from '@/stores/library';
import { useSongActions } from '@/composables/useSongActions';

const app = useAppStore();
const library = useLibraryStore();
const { playAll } = useSongActions();

const scanning = ref(false);

const localSongs = computed(() => library.localSongs);

async function addFolder() {
  const dir = await window.kg?.chooseFolder();
  if (!dir) return;
  const dirs = [...new Set([...(app.settings.localDirs || []), dir])];
  await app.updateSettings({ localDirs: dirs });
  await scan();
}

async function scan() {
  scanning.value = true;
  try {
    await library.loadLocal();
    ElMessage.success(`已扫描到 ${library.localSongs.length} 首本地音乐`);
  } finally {
    scanning.value = false;
  }
}

async function removeFolder(dir) {
  const dirs = (app.settings.localDirs || []).filter((d) => d !== dir);
  await app.updateSettings({ localDirs: dirs });
  await library.loadLocal();
}

function playLocal(song) {
  playAll(localSongs.value, localSongs.value.indexOf(song));
}

onMounted(async () => {
  if (app.settings.localDirs?.length) await library.loadLocal();
});
</script>

<template>
  <div class="lib-page page-scroll">
    <div class="head">
      <h1>本地音乐</h1>
      <div class="spacer" />
      <button class="btn ghost" @click="addFolder"><Icon name="folder" :size="13" /> 添加文件夹</button>
      <button class="btn" :disabled="scanning" @click="scan">
        <Icon name="refresh" :size="13" /> {{ scanning ? '扫描中…' : '重新扫描' }}
      </button>
      <button
        v-if="(app.settings.localDirs || []).length"
        class="btn ghost"
        @click="window.kg?.openPath(app.settings.localDirs[0])"
      >
        <Icon name="folder" :size="13" /> 打开文件夹
      </button>
    </div>

    <div v-if="app.settings.localDirs?.length" class="folders">
      <span v-for="d in app.settings.localDirs" :key="d" class="folder-chip">
        {{ d }}
        <button @click="removeFolder(d)"><Icon name="close-small" :size="11" /></button>
      </span>
    </div>
    <SongList
      v-if="localSongs.length"
      :songs="localSongs"
      :show-album="false"
      :highlight="false"
      @play="playLocal"
      empty-text="没有扫描到本地音乐"
    />
    <div v-else class="empty">
      <Icon name="folder" :size="36" color="#c6cbd4" />
      <div class="empty-title">还没有添加本地音乐</div>
      <div class="empty-sub">添加文件夹后会自动扫描 mp3 / flac / m4a / wav 等格式</div>
      <button class="btn primary" @click="addFolder">添加音乐文件夹</button>
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
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.spacer {
  flex: 1;
}
.btn {
  height: 30px;
  padding: 0 13px;
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
  margin-top: 14px;
}
.folders {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.folder-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--kg-text-2);
  background: var(--kg-panel);
  padding: 4px 8px;
  border-radius: 6px;
}
.folder-chip button {
  display: grid;
  place-items: center;
  color: var(--kg-text-3);
}
.empty {
  padding: 60px 0;
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
.empty-sub {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
</style>
