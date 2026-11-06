<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { commentMusic, commentSend } from '@/api';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useUiStore } from '@/stores/ui';
import { useUserStore } from '@/stores/user';
import { usePlayerStore } from '@/stores/player';
import { formatCount } from '@/utils/format';

const ui = useUiStore();
const user = useUserStore();
const player = usePlayerStore();

const tab = ref('hot');
const loading = ref(false);
const total = ref(0);
const hot = ref([]);
const list = ref([]);
const hotwords = ref([]);
const page = ref(1);
const text = ref('');
const sending = ref(false);

const song = computed(() => ui.commentSong || player.current);
const shown = computed(() => (tab.value === 'hot' ? hot.value : list.value));

async function load(reset = true) {
  if (!song.value?.albumAudioId) return;
  loading.value = true;
  if (reset) page.value = 1;
  try {
    const res = await commentMusic(song.value.albumAudioId, page.value, 30);
    total.value = res.total;
    hot.value = res.hot || [];
    hotwords.value = (res.hotwords || []).slice(0, 8);
    if (reset) list.value = res.list;
    else list.value = [...list.value, ...res.list];
  } catch (e) {
    ElMessage.error(e.message || '评论加载失败');
  } finally {
    loading.value = false;
  }
}

async function send() {
  if (!user.isLogin) {
    ui.openLogin();
    return;
  }
  const content = text.value.trim();
  if (!content) return;
  sending.value = true;
  try {
    await commentSend({ mixsongid: song.value.albumAudioId, content, name: song.value.name });
    ElMessage.success('评论已发布');
    text.value = '';
    await load(true);
    tab.value = 'new';
  } catch (e) {
    ElMessage.error(e.message || '评论失败，请稍后再试');
  } finally {
    sending.value = false;
  }
}

function useHotword(w) {
  text.value = w;
}

function open(s) {
  ui.commentSong = s || player.current;
  ui.showComments = true;
  tab.value = 'hot';
  load(true);
}

watch(
  () => ui.showComments,
  (v) => {
    if (v) load(true);
  }
);

defineExpose({ open });
</script>

<template>
  <el-dialog v-model="ui.showComments" width="640" align-center append-to-body class="comment-dialog" :show-close="true">
    <template #header>
      <div class="head">
        <CoverImage :src="song?.cover" :size="46" :radius="7" />
        <div class="head-meta">
          <div class="name ellipsis">{{ song?.name || '评论' }}</div>
          <div class="sub ellipsis">歌手：{{ song?.singer || '-' }}</div>
        </div>
        <div class="head-actions">
          <button class="icon-act" title="收藏这首"><Icon name="heart" :size="16" /></button>
          <button class="icon-act" title="更多"><Icon name="more" :size="16" /></button>
        </div>
      </div>
    </template>

    <div class="cm-body">
      <div class="count-row">
        <span class="count-title">评论</span>
        <span class="count-num">{{ formatCount(total) }}</span>
      </div>

      <!-- 发表框：未登录时整块可点，登录后展开输入 -->
      <div class="composer" :class="{ locked: !user.isLogin }">
        <div v-if="!user.isLogin" class="login-tip" @click="ui.openLogin()">
          <span class="login-link">登录</span>
          <span>，一键即发</span>
        </div>
        <template v-else>
          <textarea v-model="text" rows="2" maxlength="200" placeholder="说点什么吧…" />
          <div class="composer-foot">
            <button class="send" :disabled="sending || !text.trim()" @click="send">
              {{ sending ? '发送中' : '发布' }}
            </button>
          </div>
        </template>
      </div>

      <div v-if="hotwords.length" class="hotwords">
        <button v-for="w in hotwords" :key="w" class="hw" @click="useHotword(w)">{{ w }}</button>
      </div>

      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'hot' }" @click="tab = 'hot'">推荐</button>
        <button class="tab" :class="{ active: tab === 'new' }" @click="tab = 'new'">最新</button>
      </div>

      <div v-loading="loading" class="comment-list">
        <div v-for="c in shown" :key="c.id" class="comment">
          <div class="avatar">
            <img v-if="c.avatar" :src="c.avatar" alt="" />
            <span v-else>{{ (c.user || '酷').slice(0, 1) }}</span>
          </div>
          <div class="body">
            <div class="row1">
              <span class="user">{{ c.user }}</span>
              <span v-if="c.vip" class="vip-tag">VIP</span>
              <span class="meta-time">{{ [c.time, c.location].filter(Boolean).join(' · ') }}</span>
            </div>
            <div class="text">{{ c.text }}</div>
            <div v-if="c.pics?.length" class="pics">
              <img v-for="p in c.pics.slice(0, 3)" :key="p" :src="p" alt="" />
            </div>
            <div class="row2">
              <button class="act"><Icon name="heart" :size="13" /> {{ c.likes || '点赞' }}</button>
              <button class="act"><Icon name="comment" :size="13" /> {{ c.replies || '回复' }}</button>
              <button class="act"><Icon name="share" :size="13" /> 分享</button>
            </div>
          </div>
        </div>
        <div v-if="!loading && !shown.length" class="empty">还没有评论，来抢沙发吧</div>
        <button v-if="tab === 'new' && list.length < total" class="more" @click="page += 1; load(false)">
          加载更多评论
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:global(body .el-dialog.comment-dialog) {
  border-radius: 14px;
}
.head {
  display: flex;
  align-items: center;
  gap: 11px;
}
.head-meta {
  min-width: 0;
  flex: 1;
}
.name {
  font-size: 14px;
  font-weight: 600;
}
.sub {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 4px;
}
.head-actions {
  display: flex;
  gap: 6px;
}
.icon-act {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--kg-line-2);
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
}
.icon-act:hover {
  color: var(--kg-accent-dark);
  border-color: var(--kg-accent);
}

.cm-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.count-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.count-title {
  font-size: 12.5px;
  color: var(--kg-text-2);
}
.count-num {
  font-size: 13px;
  font-weight: 700;
  color: var(--kg-text);
}
.composer {
  border: 1px solid var(--kg-line-2);
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--kg-panel-2);
}
.composer.locked {
  cursor: pointer;
}
.login-tip {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
  color: var(--kg-text-2);
}
.login-link {
  color: var(--kg-accent-dark);
  font-weight: 600;
}
textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  font-size: 13px;
  line-height: 1.6;
  font-family: inherit;
  color: var(--kg-text);
}
.composer-foot {
  display: flex;
  justify-content: flex-end;
}
.send {
  height: 28px;
  padding: 0 16px;
  border-radius: 14px;
  background: var(--kg-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.send:disabled {
  opacity: 0.5;
}
.hotwords {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.hw {
  height: 26px;
  padding: 0 11px;
  border-radius: 13px;
  background: var(--kg-panel);
  font-size: 11.5px;
  color: var(--kg-text-2);
}
.hw:hover {
  background: var(--kg-accent-soft);
  color: var(--kg-accent-dark);
}

.tabs {
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--kg-line);
}
.tab {
  padding-bottom: 8px;
  font-size: 12.5px;
  color: var(--kg-text-3);
  position: relative;
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
  bottom: -1px;
  width: 16px;
  height: 2px;
  background: var(--kg-accent);
  border-radius: 2px;
}
.comment-list {
  max-height: 380px;
  overflow-y: auto;
  padding: 6px 0 4px;
}
.comment {
  display: flex;
  gap: 10px;
  padding: 10px 2px;
}
.comment + .comment {
  border-top: 1px solid var(--kg-line);
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--kg-panel);
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--kg-accent-dark);
  overflow: hidden;
  flex: 0 0 34px;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.body {
  flex: 1;
  min-width: 0;
}
.row1 {
  display: flex;
  align-items: center;
  gap: 6px;
}
.user {
  font-size: 12px;
  color: var(--kg-text-2);
  font-weight: 500;
}
.vip-tag {
  font-size: 9px;
  font-weight: 700;
  color: #8a5a00;
  background: linear-gradient(135deg, #ffe6b0, #f3bd63);
  border-radius: 3px;
  padding: 0 3px;
  line-height: 13px;
}
.meta-time {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--kg-text-3);
  flex: 0 0 auto;
}
.text {
  font-size: 13px;
  color: var(--kg-text);
  line-height: 1.7;
  margin-top: 5px;
  word-break: break-word;
  white-space: pre-wrap;
}
.pics {
  display: flex;
  gap: 6px;
  margin-top: 7px;
}
.pics img {
  width: 84px;
  height: 84px;
  border-radius: 7px;
  object-fit: cover;
  background: var(--kg-panel);
}
.row2 {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 7px;
}
.act {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--kg-text-3);
}
.act:hover {
  color: var(--kg-accent-dark);
}
.empty {
  padding: 40px 0;
  text-align: center;
  font-size: 12px;
  color: var(--kg-text-3);
}
.more {
  width: 100%;
  height: 32px;
  border-radius: 8px;
  background: var(--kg-panel);
  font-size: 12px;
  color: var(--kg-text-2);
  margin-top: 6px;
}
</style>
