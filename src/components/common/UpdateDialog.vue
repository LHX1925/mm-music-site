<script setup>
import { computed } from 'vue';
import Icon from '@/components/common/Icon.vue';
import { useUpdateStore } from '@/stores/update';

const update = useUpdateStore();

const title = computed(() => (update.hasUpdate ? '发现新版本' : '检查更新'));
const latestVer = computed(() => update.latest?.version || '');
const primaryText = computed(() => {
  if (update.installing) return '正在启动安装程序…';
  if (update.done) return update.portable ? '立即安装并重启' : '立即安装';
  if (update.downloading) return `下载中 ${update.percent}%`;
  return '立即更新';
});
const canClose = computed(() => !update.force && !update.installing);

function onClose() {
  if (update.downloading) return; // 下载中不允许直接关，先取消
  update.dismiss();
}
</script>

<template>
  <el-dialog
    v-model="update.visible"
    width="520"
    align-center
    append-to-body
    :close-on-click-modal="canClose"
    :close-on-press-escape="canClose"
    :show-close="canClose"
    class="update-dlg"
    @close="onClose"
  >
    <template #header>
      <div class="up-head">
        <img class="up-icon" src="/icon.png" alt="" />
        <div class="up-title">
          <h3>{{ title }}</h3>
          <p v-if="update.hasUpdate">
            <span class="cur">v{{ update.version || '—' }}</span>
            <Icon name="arrow-right" :size="13" class="arrow" />
            <span class="new">v{{ latestVer }}</span>
          </p>
          <p v-else>当前版本 v{{ update.version || '—' }}</p>
        </div>
        <span v-if="update.force" class="force-tag">重要更新</span>
      </div>
    </template>

    <div v-if="update.hasUpdate" class="up-body">
      <div class="up-meta">
        <span v-if="update.latest?.releasedAt"><Icon name="clock" :size="13" />{{ update.latest.releasedAt }}</span>
        <span v-if="update.sizeText"><Icon name="download" :size="13" />{{ update.sizeText }}</span>
        <span><Icon name="shield" :size="13" />{{ update.portable ? '便携版' : '安装版' }}</span>
      </div>

      <div v-if="update.latest?.title" class="up-sub">{{ update.latest.title }}</div>

      <ul class="up-notes">
        <li v-for="(n, i) in update.notes" :key="i">{{ n }}</li>
        <li v-if="!update.notes.length" class="muted">本次更新包含若干优化与问题修复。</li>
      </ul>

      <div v-if="update.downloading || update.done" class="up-progress">
        <div class="bar">
          <i :style="{ width: (update.done ? 100 : update.percent) + '%' }"></i>
        </div>
        <div class="bar-info">
          <span v-if="update.done" class="ok"><Icon name="check" :size="12" />下载完成</span>
          <span v-else>{{ update.percent }}%<em v-if="update.speedText"> · {{ update.speedText }}</em></span>
          <button v-if="update.downloading" class="link" @click="update.cancelDownload()">取消</button>
          <button v-else class="link" @click="update.reveal()">打开所在文件夹</button>
        </div>
      </div>

      <p v-if="update.error" class="up-err">{{ update.error }}</p>
    </div>

    <div v-else class="up-empty">
      <Icon name="check" :size="26" class="ok-ico" />
      <p>已经是最新版本{{ update.version ? ' v' + update.version : '' }}</p>
      <span>有新版本时这里会第一时间提示你。</span>
    </div>

    <template #footer>
      <div class="up-foot">
        <button v-if="update.hasUpdate && !update.force" class="ghost" @click="update.skip()">跳过此版本</button>
        <button class="ghost" @click="update.openSite()">
          <Icon name="download" :size="13" />官网下载
        </button>
        <button
          v-if="update.hasUpdate"
          class="primary"
          :disabled="update.downloading || update.installing"
          @click="update.done ? update.install() : update.download()"
        >
          {{ primaryText }}
        </button>
        <button v-else class="primary" :disabled="update.checking" @click="update.check({ silent: false })">
          {{ update.checking ? '检查中…' : '重新检查' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.up-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.up-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex: none;
  box-shadow: 0 6px 18px -6px rgba(var(--kg-accent-rgb), 0.6);
}
.up-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--kg-text);
}
.up-title p {
  margin: 3px 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--kg-text-3);
}
.up-title .cur {
  color: var(--kg-text-3);
}
.up-title .new {
  color: var(--kg-accent);
  font-weight: 700;
}
.up-title .arrow {
  color: var(--kg-text-3);
}
.force-tag {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(100deg, #ff6b6b, #ff8f3f);
  padding: 3px 9px;
  border-radius: 999px;
}
.up-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.up-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  color: var(--kg-text-3);
}
.up-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.up-sub {
  font-size: 13px;
  font-weight: 600;
  color: var(--kg-text);
}
.up-notes {
  margin: 0;
  padding: 12px 14px;
  list-style: none;
  border-radius: 12px;
  background: var(--kg-panel);
  border: 1px solid var(--kg-line);
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.up-notes li {
  position: relative;
  padding-left: 13px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--kg-text-2);
}
.up-notes li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--kg-accent);
  opacity: 0.7;
}
.up-notes li.muted {
  color: var(--kg-text-3);
}
.up-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.up-progress .bar {
  height: 6px;
  border-radius: 999px;
  background: var(--kg-line);
  overflow: hidden;
}
.up-progress .bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--kg-accent), var(--kg-accent-dark, var(--kg-accent)));
  transition: width 0.25s ease;
}
.bar-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.bar-info em {
  font-style: normal;
  color: var(--kg-text-3);
}
.bar-info .ok {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--kg-accent);
  font-weight: 600;
}
.link {
  margin-left: auto;
  border: 0;
  background: none;
  padding: 0;
  font-size: 11.5px;
  color: var(--kg-accent);
  cursor: pointer;
}
.up-err {
  margin: 0;
  font-size: 12px;
  color: #e5484d;
}
.up-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 14px 0 6px;
  text-align: center;
}
.up-empty .ok-ico {
  color: var(--kg-accent);
}
.up-empty p {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--kg-text);
}
.up-empty span {
  font-size: 12px;
  color: var(--kg-text-3);
}
.up-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.up-foot button {
  height: 32px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.up-foot .ghost {
  border: 1px solid var(--kg-line-2);
  background: transparent;
  color: var(--kg-text-2);
}
.up-foot .ghost:hover {
  border-color: var(--kg-accent);
  color: var(--kg-accent);
}
.up-foot .primary {
  border: 0;
  color: #fff;
  font-weight: 600;
  background: var(--kg-accent);
  box-shadow: 0 6px 18px -8px rgba(var(--kg-accent-rgb), 0.9);
}
.up-foot .primary:hover {
  filter: brightness(1.06);
}
.up-foot .primary:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
