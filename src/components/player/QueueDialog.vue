<script setup>
import { computed, ref } from 'vue';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { formatDuration } from '@/utils/format';

const player = usePlayerStore();
const library = useLibraryStore();
const ui = useUiStore();

const tab = ref('queue');
const keyword = ref('');

const source = computed(() => (tab.value === 'queue' ? player.queue : player.history));

const list = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return source.value;
  return source.value.filter((s) => `${s.name}${s.singer}`.toLowerCase().includes(k));
});

const totalDuration = computed(() =>
  source.value.reduce((sum, s) => sum + (Number(s.duration) || 0), 0)
);

function playAt(song) {
  if (tab.value === 'queue') {
    const i = player.queue.findIndex((s) => s.hash === song.hash && s.albumAudioId === song.albumAudioId);
    if (i >= 0) player.playQueueItem(i);
  } else {
    player.play(song, player.history);
  }
}

function clearAll() {
  if (tab.value === 'queue') player.clearQueue();
  else player.history = [];
}

function isCurrent(s) {
  return player.current && player.current.hash === s.hash && player.current.albumAudioId === s.albumAudioId;
}
</script>

<template>
  <el-dialog v-model="ui.showQueue" width="660" align-center append-to-body class="queue-dialog">
    <template #header>
      <div class="qd-head">
        <div class="tabs">
          <button class="tab" :class="{ active: tab === 'queue' }" @click="tab = 'queue'">
            当前播放 <span class="count">{{ player.queue.length }}</span>
          </button>
          <button class="tab" :class="{ active: tab === 'history' }" @click="tab = 'history'">最近播放</button>
          <span v-if="tab === 'queue' && player.queueName" class="source" :title="player.queueName">
            <Icon name="list" :size="11" />
            {{ player.queueName }}
          </span>
        </div>
        <div class="search">
          <Icon name="search" :size="13" color="#9aa0ab" />
          <input v-model="keyword" placeholder="搜索列表内歌曲" />
        </div>
      </div>
    </template>

    <div class="qd-list">
      <div
        v-for="(s, i) in list"
        :key="`${s.hash}-${i}`"
        class="qd-item"
        :class="{ active: isCurrent(s) }"
        @dblclick="playAt(s)"
      >
        <span class="idx">{{ i + 1 }}</span>
        <div class="cover" @click="playAt(s)">
          <CoverImage :src="s.cover" :size="38" :radius="6" />
          <span class="play-mask"><Icon name="play" :size="12" color="#fff" filled /></span>
        </div>
        <div class="meta">
          <div class="name ellipsis">{{ s.name }}</div>
          <div class="singer ellipsis">{{ s.singer }}</div>
        </div>
        <span class="dur">{{ formatDuration(s.duration) }}</span>
        <button
          v-if="tab === 'queue'"
          class="del"
          title="从列表移除"
          @click.stop="player.removeFromQueue(player.queue.indexOf(s))"
        >
          <Icon name="close-small" :size="13" />
        </button>
      </div>
      <div v-if="!list.length" class="empty">{{ keyword ? '没有匹配的歌曲' : '列表还是空的，去挑几首歌吧' }}</div>
    </div>

    <template #footer>
      <div class="qd-foot">
        <span class="sum">{{ source.length }} 首 · 共 {{ formatDuration(totalDuration) }}</span>
        <div class="actions">
          <button class="btn ghost" @click="library.addPreview(source)">全部加入试听列表</button>
          <button class="btn ghost" :disabled="!source.length" @click="clearAll">清空列表</button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.qd-head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.tabs {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}
.source {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 190px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--kg-accent-dark);
  background: var(--kg-accent-soft);
  border-radius: 9px;
  padding: 2px 8px;
  flex: 0 0 auto;
}
.tab {
  font-size: 13.5px;
  color: var(--kg-text-2);
  padding: 4px 0;
  position: relative;
  font-weight: 500;
}
.tab.active {
  color: var(--kg-text);
  font-weight: 600;
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -6px;
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--kg-accent);
}
.count {
  font-size: 10.5px;
  color: var(--kg-text-3);
  margin-left: 2px;
}
.search {
  height: 30px;
  width: 180px;
  border-radius: 15px;
  background: var(--kg-panel);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
}
.search input {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}
.qd-list {
  max-height: 420px;
  overflow-y: auto;
  margin: 0 -6px;
  padding: 2px 6px;
}
.qd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 54px;
  padding: 0 8px;
  border-radius: 9px;
}
.qd-item:hover {
  background: var(--kg-panel);
}
.qd-item.active {
  background: var(--kg-accent-soft);
}
.idx {
  width: 20px;
  font-size: 11.5px;
  color: var(--kg-text-3);
  text-align: center;
}
.cover {
  position: relative;
  cursor: pointer;
  flex: 0 0 38px;
}
.play-mask {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.qd-item:hover .play-mask {
  opacity: 1;
}
.meta {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 12.8px;
}
.qd-item.active .name {
  color: var(--kg-accent-dark);
  font-weight: 600;
}
.singer {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 3px;
}
.dur {
  font-size: 11px;
  color: var(--kg-text-3);
  font-variant-numeric: tabular-nums;
}
.del {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-text-3);
  opacity: 0;
}
.qd-item:hover .del {
  opacity: 1;
}
.del:hover {
  background: var(--kg-hover);
  color: #d9534f;
}
.empty {
  padding: 50px 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--kg-text-3);
}
.qd-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sum {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.actions {
  display: flex;
  gap: 8px;
}
.btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 12px;
}
.btn.ghost {
  border: 1px solid var(--kg-line);
  color: var(--kg-text-2);
  background: var(--kg-surface);
}
.btn.ghost:hover {
  background: var(--kg-panel);
}
.btn:disabled {
  opacity: 0.5;
}
</style>
