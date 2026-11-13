<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { commentFloor, commentFloorSend, commentMusic, commentSend } from '@/api';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useUiStore } from '@/stores/ui';
import { useUserStore } from '@/stores/user';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { copyText, songShareUrl } from '@/utils/clipboard';
import { formatCount } from '@/utils/format';

const ui = useUiStore();
const user = useUserStore();
const player = usePlayerStore();
const library = useLibraryStore();

/** 已点赞的评论（接口没有点赞能力，这里按设备记住，点了立刻有反馈） */
const LIKE_KEY = 'kg-comment-likes-v1';
function readLikes() {
  try {
    return JSON.parse(localStorage.getItem(LIKE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
const likedMap = ref(readLikes());
function saveLikes() {
  try {
    localStorage.setItem(LIKE_KEY, JSON.stringify(likedMap.value));
  } catch {}
}

const tab = ref('hot');
const loading = ref(false);
const total = ref(0);
const hot = ref([]);
const list = ref([]);
const hotwords = ref([]);
const page = ref(1);
const text = ref('');
const sending = ref(false);
const specialId = ref('');
const moreOpen = ref(false);

/** 楼中楼：按评论 id 记录加载状态与内容 */
const floors = reactive({});
const replyOpen = ref('');
const replyText = reactive({});
const replySending = ref('');

const song = computed(() => ui.commentSong || player.current);
const shown = computed(() => (tab.value === 'hot' ? hot.value : list.value));
const liked = computed(() => library.isFavorite(song.value));

function shareUrl() {
  return songShareUrl(song.value);
}

async function load(reset = true) {
  if (!song.value?.albumAudioId) {
    total.value = 0;
    hot.value = [];
    list.value = [];
    return;
  }
  loading.value = true;
  if (reset) page.value = 1;
  try {
    const res = await commentMusic(song.value.albumAudioId, page.value, 30);
    total.value = res.total;
    specialId.value = res.specialId || '';
    hot.value = res.hot || [];
    hotwords.value = (res.hotwords || []).slice(0, 8);
    if (reset) list.value = res.list || [];
    else list.value = [...list.value, ...(res.list || [])];
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
    await commentSend({
      mixsongid: song.value.albumAudioId,
      special_id: specialId.value || undefined,
      name: song.value.name,
      content,
    });
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

/** 展开 / 收起某条评论的回复，第一次展开时去拉楼中楼 */
async function toggleReplies(c) {
  const id = c.tid || c.id;
  if (!id) return;
  if (replyOpen.value === id) {
    replyOpen.value = '';
    return;
  }
  replyOpen.value = id;
  if (floors[id]?.list?.length) return;
  floors[id] = { loading: true, list: [], total: 0, error: '' };
  try {
    const res = await commentFloor(specialId.value || c.specialId, id, song.value?.albumAudioId);
    floors[id] = { loading: false, list: res.list || [], total: res.total || 0, error: '' };
  } catch (e) {
    floors[id] = { loading: false, list: [], total: 0, error: e.message || '回复加载失败' };
  }
}

async function sendReply(c) {
  if (!user.isLogin) {
    ui.openLogin();
    return;
  }
  const id = c.tid || c.id;
  const content = String(replyText[id] || '').trim();
  if (!content) return;
  replySending.value = id;
  try {
    await commentFloorSend({
      special_id: specialId.value || c.specialId,
      mixsongid: song.value?.albumAudioId,
      tid: id,
      content,
      name: song.value?.name,
      reply_user_name: c.user,
      reply_content: c.text,
    });
    replyText[id] = '';
    ElMessage.success('回复已发布');
    floors[id] = { loading: true, list: [], total: 0, error: '' };
    const res = await commentFloor(specialId.value || c.specialId, id, song.value?.albumAudioId);
    floors[id] = { loading: false, list: res.list || [], total: res.total || 0, error: '' };
    c.replies = (c.replies || 0) + 1;
  } catch (e) {
    ElMessage.error(e.message || '回复失败，可能触发了内容审核');
  } finally {
    replySending.value = '';
  }
}

function toggleLike(c) {
  const id = c.tid || c.id;
  if (!id) return;
  const next = { ...likedMap.value };
  if (next[id]) delete next[id];
  else next[id] = true;
  likedMap.value = next;
  saveLikes();
}

function isLiked(c) {
  return Boolean(likedMap.value[c.tid || c.id]);
}

function likeCount(c) {
  return Number(c.likes || 0) + (isLiked(c) ? 1 : 0);
}

function useHotword(w) {
  text.value = w;
}

/** 分享评论：把「谁说了什么 + 歌曲页地址」复制走 */
async function share(c) {
  const link = shareUrl();
  const payload = c ? `${c.user}：${c.text}\n${link}` : `${song.value?.name} - ${song.value?.singer}\n${link}`;
  const ok = await copyText(payload);
  ElMessage({
    message: ok ? '评论内容与歌曲链接已复制，去粘贴分享吧' : '复制失败，请手动选择文本复制',
    type: ok ? 'success' : 'warning',
    grouping: true,
  });
}

/** 三个点：复制评论 / 复制歌曲链接 / 看回复 */
async function onMore(cmd, c) {
  moreOpen.value = false;
  if (cmd === 'copy-comment') {
    const ok = await copyText(`${c.user}：${c.text}`);
    ElMessage({ message: ok ? '已复制这条评论' : '复制失败', type: ok ? 'success' : 'warning', grouping: true });
  } else if (cmd === 'copy-link') {
    const ok = await copyText(shareUrl());
    ElMessage({ message: ok ? '歌曲链接已复制' : '复制失败', type: ok ? 'success' : 'warning', grouping: true });
  } else if (cmd === 'reply') {
    toggleReplies(c);
  }
}

function toggleFav() {
  library.toggleFavorite(song.value);
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
  <el-dialog
    v-model="ui.showComments"
    width="660"
    align-center
    append-to-body
    class="comment-dialog"
    :show-close="true"
  >
    <template #header>
      <div class="head">
        <CoverImage :src="song?.cover" :size="46" :radius="9" />
        <div class="head-meta">
          <div class="name ellipsis">{{ song?.name || '评论' }}</div>
          <div class="sub ellipsis">{{ song?.singer || '—' }}</div>
        </div>
        <div class="head-actions">
          <button class="icon-act" :class="{ on: liked }" :title="liked ? '取消喜欢' : '喜欢这首歌'" @click="toggleFav">
            <Icon name="heart" :size="16" :filled="liked" />
          </button>
          <button class="icon-act" title="分享这首歌" @click="share(null)">
            <Icon name="share" :size="15" />
          </button>
        </div>
      </div>
    </template>

    <div class="cm-body">
      <div class="count-row">
        <span class="count-title">全部评论</span>
        <span class="count-num">{{ formatCount(total) }}</span>
        <span class="count-hint">点赞会保存在本机</span>
      </div>

      <!-- 发表框 -->
      <div class="composer" :class="{ locked: !user.isLogin }">
        <div v-if="!user.isLogin" class="login-tip" @click="ui.openLogin()">
          <span class="login-link">登录</span>
          <span>后即可发表评论、回复和点赞</span>
        </div>
        <template v-else>
          <textarea v-model="text" rows="2" maxlength="200" placeholder="说点什么吧…" />
          <div class="composer-foot">
            <span class="word-count">{{ text.length }}/200</span>
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
        <div v-for="c in shown" :key="c.tid || c.id" class="comment">
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
              <el-image
                v-for="(p, pi) in c.pics.slice(0, 3)"
                :key="p + pi"
                class="pic"
                :src="p"
                :preview-src-list="c.pics"
                :initial-index="pi"
                fit="cover"
                preview-teleported
                hide-on-click-modal
              />
            </div>

            <div class="row2">
              <button class="act" :class="{ on: isLiked(c) }" @click="toggleLike(c)">
                <Icon name="heart" :size="13" :filled="isLiked(c)" />
                <span>{{ likeCount(c) || '点赞' }}</span>
              </button>
              <button class="act" :class="{ on: replyOpen === (c.tid || c.id) }" @click="toggleReplies(c)">
                <Icon name="comment" :size="13" />
                <span>{{ c.replies || '回复' }}</span>
              </button>
              <button class="act" @click="share(c)">
                <Icon name="share" :size="13" />
                <span>分享</span>
              </button>
              <el-dropdown trigger="click" placement="bottom-start" @command="onMore($event, c)">
                <button class="act icon-only" title="更多"><Icon name="more" :size="14" /></button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="copy-comment">复制评论</el-dropdown-item>
                    <el-dropdown-item command="copy-link">复制歌曲链接</el-dropdown-item>
                    <el-dropdown-item command="reply" divided>查看 / 发表回复</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <!-- 楼中楼 -->
            <div v-if="replyOpen === (c.tid || c.id)" class="floor-box">
              <div v-if="floors[c.tid || c.id]?.loading" class="floor-loading">回复加载中…</div>
              <div v-else-if="floors[c.tid || c.id]?.error" class="floor-error">
                {{ floors[c.tid || c.id].error }}
              </div>
              <template v-else>
                <div v-for="r in floors[c.tid || c.id]?.list || []" :key="r.tid || r.id" class="floor-item">
                  <div class="floor-avatar">
                    <img v-if="r.avatar" :src="r.avatar" alt="" />
                    <span v-else>{{ (r.user || '酷').slice(0, 1) }}</span>
                  </div>
                  <div class="floor-body">
                    <div class="floor-row">
                      <span class="floor-user">{{ r.user }}</span>
                      <span class="floor-time">{{ r.time }}</span>
                    </div>
                    <div class="floor-text">{{ r.text }}</div>
                  </div>
                </div>
                <div v-if="!(floors[c.tid || c.id]?.list || []).length" class="floor-empty">
                  还没有人回复，来抢个沙发
                </div>
              </template>
              <div v-if="user.isLogin" class="floor-composer">
                <input
                  v-model="replyText[c.tid || c.id]"
                  maxlength="200"
                  :placeholder="`回复 @${c.user}`"
                  @keyup.enter="sendReply(c)"
                />
                <button
                  class="send tiny"
                  :disabled="replySending === (c.tid || c.id) || !String(replyText[c.tid || c.id] || '').trim()"
                  @click="sendReply(c)"
                >
                  {{ replySending === (c.tid || c.id) ? '发送中' : '回复' }}
                </button>
              </div>
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
  margin-right: 6px;
}
.icon-act {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--kg-line-2);
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.icon-act:hover {
  color: var(--kg-accent-dark);
  border-color: var(--kg-accent);
}
.icon-act.on {
  color: var(--kg-accent);
  border-color: var(--kg-accent);
  background: var(--kg-accent-soft);
}

.cm-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.count-row {
  display: flex;
  align-items: baseline;
  gap: 7px;
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
.count-hint {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--kg-text-3);
}
.composer {
  border: 1px solid var(--kg-line-2);
  border-radius: 12px;
  padding: 9px 11px;
  background: var(--kg-panel-2);
  transition: border-color 0.15s ease;
}
.composer:focus-within {
  border-color: var(--kg-accent);
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
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.word-count {
  font-size: 10.5px;
  color: var(--kg-text-3);
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
.send.tiny {
  height: 26px;
  padding: 0 12px;
  font-size: 11.5px;
  flex: 0 0 auto;
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
  max-height: 400px;
  overflow-y: auto;
  padding: 6px 2px 4px;
}
.comment {
  display: flex;
  gap: 10px;
  padding: 11px 2px;
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
  margin-top: 8px;
}
.pic {
  width: 84px;
  height: 84px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--kg-panel);
  cursor: zoom-in;
}
.row2 {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}
.act {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--kg-text-3);
  transition: color 0.15s ease;
}
.act:hover {
  color: var(--kg-accent-dark);
}
.act.on {
  color: var(--kg-accent);
  font-weight: 600;
}
.act.icon-only {
  padding: 2px;
  margin-left: auto;
}
.floor-box {
  margin-top: 10px;
  padding: 9px 11px;
  border-radius: 10px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
}
.floor-loading,
.floor-empty,
.floor-error {
  font-size: 11.5px;
  color: var(--kg-text-3);
  padding: 4px 2px;
}
.floor-error {
  color: #e5484d;
}
.floor-item {
  display: flex;
  gap: 8px;
  padding: 6px 0;
}
.floor-item + .floor-item {
  border-top: 1px dashed var(--kg-line);
}
.floor-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--kg-panel);
  display: grid;
  place-items: center;
  font-size: 10px;
  color: var(--kg-accent-dark);
  flex: 0 0 24px;
}
.floor-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.floor-body {
  min-width: 0;
  flex: 1;
}
.floor-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.floor-user {
  font-size: 11.5px;
  color: var(--kg-text-2);
  font-weight: 500;
}
.floor-time {
  font-size: 10px;
  color: var(--kg-text-3);
}
.floor-text {
  font-size: 12px;
  color: var(--kg-text);
  line-height: 1.65;
  margin-top: 2px;
  word-break: break-word;
  white-space: pre-wrap;
}
.floor-composer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.floor-composer input {
  flex: 1;
  min-width: 0;
  height: 30px;
  border-radius: 15px;
  padding: 0 12px;
  border: 1px solid var(--kg-line-2);
  background: var(--kg-surface);
  font-size: 12px;
  color: var(--kg-text);
  outline: none;
}
.floor-composer input:focus {
  border-color: var(--kg-accent);
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
