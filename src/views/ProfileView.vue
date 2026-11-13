<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import VipBadge from '@/components/common/VipBadge.vue';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { useLibraryStore } from '@/stores/library';
import { useVipStore } from '@/stores/vip';
import { useUiStore } from '@/stores/ui';
import { formatCount } from '@/utils/format';
import { platformIcon } from '@/utils/brand';

const app = useAppStore();
const user = useUserStore();
const library = useLibraryStore();
const vip = useVipStore();
const ui = useUiStore();
const router = useRouter();

const loading = ref(false);
const platformSwitching = ref(false);
/** 未登录时的默认头像 */
const DEFAULT_AVATAR = '/assets/profile.jpg';

const accountId = computed(() => user.session?.userid || '—');
const joined = computed(() => user.session?.createTime || '');

const stats = computed(() => [
  { key: 'favorite', label: '我喜欢', value: library.favorites.length, icon: 'heart', path: '/favorite' },
  { key: 'recent', label: '最近播放', value: library.recent.length, icon: 'clock', path: '/recent' },
  { key: 'playlist', label: '我的歌单', value: library.userPlaylists.length, icon: 'list', path: '/my/playlists' },
  { key: 'cloud', label: '音乐云盘', value: library.cloudSongs.length, icon: 'cloud', path: '/cloud' },
  { key: 'follow', label: '关注歌手', value: library.followSingers.length, icon: 'singer', path: '/follow' },
]);

const shortcuts = [
  { icon: 'list', label: '我的歌单', desc: '创建与收藏', path: '/my/playlists' },
  { icon: 'heart', label: '我喜欢', desc: '红心收藏', path: '/favorite' },
  { icon: 'cloud', label: '音乐云盘', desc: '云端曲库', path: '/cloud' },
  { icon: 'singer', label: '关注歌手', desc: '追更动态', path: '/follow' },
  { icon: 'folder', label: '本地音乐', desc: '本机歌曲', path: '/local' },
  { icon: 'clock', label: '最近播放', desc: '听歌足迹', path: '/recent' },
  { icon: 'vip', label: '会员中心', desc: '领取与记录', path: '/vip' },
  { icon: 'settings', label: '设置', desc: '偏好与系统', path: '/settings' },
];

async function refresh() {
  loading.value = true;
  try {
    await user.refreshProfile();
    await Promise.allSettled([
      library.loadUserPlaylists(),
      library.loadCloud(),
      library.loadFollowSingers(),
      vip.load(),
    ]);
  } finally {
    loading.value = false;
  }
}

async function switchPlatform() {
  platformSwitching.value = true;
  try {
    app.togglePlatform();
    await refresh();
    ElMessage.success(`已切换到${app.platformName}`);
  } finally {
    platformSwitching.value = false;
  }
}

async function logout() {
  try {
    await ElMessageBox.confirm(
      '退出后需要重新登录才能同步歌单、收藏与会员信息，确定退出吗？',
      '退出登录',
      { confirmButtonText: '退出登录', cancelButtonText: '再想想', type: 'warning' }
    );
  } catch {
    return;
  }
  user.logout();
  library.userPlaylists = [];
  ElMessage.success('已退出登录');
  router.push('/');
}

onMounted(refresh);
</script>

<template>
  <div class="profile-page page-scroll" v-loading="loading">
    <!-- 个人信息 -->
    <section class="hero">
      <div class="ava-col">
        <div class="avatar-lg">
          <img :src="user.avatar || DEFAULT_AVATAR" alt="" />
        </div>
      </div>

      <div class="hero-meta">
        <div class="name-row">
          <h1>{{ user.isLogin ? user.nickname : '未登录' }}</h1>
          <!-- 会员图标横排在名字右边 -->
          <VipBadge v-if="user.isLogin && vip.badges.length" :size="16" />
          <span class="plat-chip">
            <img :src="platformIcon(app.platform)" alt="" draggable="false" />
            {{ app.platformName }}
          </span>
        </div>
        <p class="sub">
          <template v-if="user.isLogin">
            账号 {{ accountId }} · {{ vip.isVip ? `会员剩余 ${vip.remainText}` : '每日可免费领取 1 天会员' }}
          </template>
          <template v-else>登录后可同步歌单、收藏、云盘与会员权益</template>
        </p>
        <div class="hero-actions">
          <button v-if="!user.isLogin" class="btn primary" @click="ui.openLogin()">
            <Icon name="user" :size="15" /> 立即登录
          </button>
          <template v-else>
            <button class="btn" @click="router.push('/vip')"><Icon name="crown" :size="15" /> 会员中心</button>
            <button class="btn ghost" :disabled="platformSwitching" @click="switchPlatform">
              <img class="btn-plat" :src="platformIcon(app.platform === 'std' ? 'lite' : 'std')" alt="" draggable="false" />
              切换到{{ app.platform === 'std' ? '概念版' : '标准版' }}
            </button>
            <button class="btn danger" @click="logout"><Icon name="logout" :size="15" /> 退出登录</button>
          </template>
        </div>
      </div>

    </section>

    <!-- 数据概览 -->
    <section class="stats">
      <button v-for="s in stats" :key="s.key" class="stat" @click="router.push(s.path)">
        <Icon :name="s.icon" :size="18" class="stat-icon" />
        <span class="stat-value">{{ formatCount(s.value) }}</span>
        <span class="stat-label">{{ s.label }}</span>
      </button>
    </section>

    <!-- 快捷入口 -->
    <section class="block">
      <header class="block-head">
        <h2>我的音乐</h2>
        <span class="note">常用入口</span>
      </header>
      <div class="grid">
        <button v-for="s in shortcuts" :key="s.path" class="cell" @click="router.push(s.path)">
          <span class="cell-icon"><Icon :name="s.icon" :size="17" /></span>
          <span class="cell-text">
            <span class="cell-label">{{ s.label }}</span>
            <span class="cell-desc">{{ s.desc }}</span>
          </span>
          <Icon name="arrow-right" :size="12" class="cell-chev" />
        </button>
      </div>
    </section>

    <!-- 我的歌单预览 -->
    <section class="block">
      <header class="block-head">
        <h2>我的歌单</h2>
        <button class="more" @click="router.push('/my/playlists')">全部 {{ library.userPlaylists.length }} 个 <Icon name="arrow-right" :size="11" /></button>
      </header>
      <div v-if="library.userPlaylists.length" class="pl-row">
        <button
          v-for="pl in library.userPlaylists.slice(0, 6)"
          :key="pl.id"
          class="pl-mini"
          @click="router.push(`/playlist/${pl.id}`)"
        >
          <span class="pl-cover-box">
            <CoverImage :src="pl.cover" size="100%" :radius="10" :letter="pl.name.slice(0, 1)" :seed="pl.id" />
          </span>
          <span class="pl-name ellipsis">{{ pl.name }}</span>
          <span class="pl-sub">{{ pl.songCount || 0 }} 首</span>
        </button>
      </div>
      <div v-else class="empty">
        {{ user.isLogin ? '还没有歌单，去创建一个吧' : '登录后显示你的歌单' }}
        <button class="link" @click="router.push(user.isLogin ? '/my/playlists' : '/settings')">
          {{ user.isLogin ? '去创建' : '去登录' }}
        </button>
      </div>
    </section>

    <!-- 账号安全 -->
    <section class="block">
      <header class="block-head"><h2>账号与安全</h2></header>
      <div class="rows">
        <div class="row">
          <span class="k">当前平台</span>
          <span class="v">{{ app.platformName }} · 端口 {{ app.ports[app.platform] }}</span>
        </div>
        <div class="row">
          <span class="k">登录状态</span>
          <span class="v">{{ user.isLogin ? '已登录' : '未登录' }}</span>
        </div>
        <div class="row">
          <span class="k">账号 ID</span>
          <span class="v">{{ accountId }}</span>
        </div>
        <div class="row danger-row">
          <span class="k">退出登录</span>
          <button class="btn danger" :disabled="!user.isLogin" @click="logout">
            <Icon name="logout" :size="14" /> {{ user.isLogin ? '退出当前账号' : '当前未登录' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>


<style scoped>
.profile-page {
  padding: 22px 34px 40px;
  max-width: 1080px;
}
.hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px;
  border-radius: 16px;
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
}
.ava-col {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}
.avatar-lg {
  width: 82px;
  height: 82px;
  border-radius: 50%;
  overflow: hidden;
  flex: 0 0 82px;
  display: grid;
  place-items: center;
  background: var(--kg-panel);
  color: var(--kg-accent-dark);
  font-size: 30px;
  font-weight: 700;
  box-shadow: 0 8px 22px rgba(var(--kg-accent-rgb), 0.22), 0 0 0 1px var(--kg-line);
}
.avatar-lg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-meta {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.name-row h1 {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
}
.vip-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  font-size: 11px;
  color: var(--kg-text-2);
  background: var(--kg-panel);
  border: 1px solid var(--kg-line);
}
.vip-chip.on {
  color: #7a4d00;
  background: linear-gradient(135deg, #ffe6b0, #f6c678);
  border-color: transparent;
  font-weight: 600;
}
.plat-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--kg-text-3);
  border: 1px dashed var(--kg-line-2);
  border-radius: 10px;
  padding: 2px 8px 2px 4px;
}
.plat-chip img {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  object-fit: cover;
}
.btn-plat {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  object-fit: cover;
}
.sub {
  margin: 8px 0 14px;
  font-size: 12.5px;
  color: var(--kg-text-2);
}
.hero-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  background: var(--kg-panel);
  border: 1px solid var(--kg-line);
  font-size: 12.5px;
  color: var(--kg-text);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease, transform 0.15s ease;
}
.btn:hover {
  background: var(--kg-hover);
}
.btn:active {
  transform: scale(0.98);
}
.btn.primary {
  background: var(--kg-accent);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
}
.btn.primary:hover {
  background: var(--kg-accent-dark);
}
.btn.ghost {
  background: transparent;
}
.btn.danger {
  color: #e5484d;
  border-color: rgba(229, 72, 77, 0.4);
  background: rgba(229, 72, 77, 0.08);
  font-weight: 600;
}
.btn.danger:hover {
  background: rgba(229, 72, 77, 0.16);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0 26px;
}
.stat {
  padding: 14px;
  border-radius: 12px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  transition: background 0.15s ease, transform 0.15s ease;
}
.stat:hover {
  background: var(--kg-hover);
  transform: translateY(-1px);
}
.stat-icon {
  color: var(--kg-accent-dark);
  margin-bottom: 4px;
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 11.5px;
  color: var(--kg-text-3);
}

.block {
  margin-bottom: 24px;
}
.block-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.block-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.note {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.more {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--kg-text-3);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.more:hover {
  color: var(--kg-accent-dark);
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.cell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
  text-align: left;
  transition: background 0.15s ease, transform 0.15s ease;
}
.cell:hover {
  background: var(--kg-hover);
  transform: translateX(1px);
}
.cell-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--kg-accent-soft);
  color: var(--kg-accent-dark);
  flex: 0 0 30px;
}
.cell-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.cell-label {
  font-size: 12.5px;
}
.cell-desc {
  font-size: 10.5px;
  color: var(--kg-text-3);
}
.cell-chev {
  color: var(--kg-text-3);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.cell:hover .cell-chev {
  opacity: 1;
}

.pl-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.pl-mini {
  min-width: 0;
  text-align: left;
}
.pl-cover-box {
  display: block;
  width: 100%;
  aspect-ratio: 1;
}
.pl-cover-box :deep(.cover) {
  width: 100% !important;
  height: 100% !important;
}
.pl-name {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--kg-text);
}
.pl-sub {
  font-size: 10.5px;
  color: var(--kg-text-3);
}
.empty {
  padding: 26px 0;
  font-size: 12.5px;
  color: var(--kg-text-3);
}
.link {
  color: var(--kg-accent-dark);
  margin-left: 4px;
}

.rows {
  border-radius: 12px;
  border: 1px solid var(--kg-line);
  background: var(--kg-surface);
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--kg-line);
}
.row:last-child {
  border-bottom: 0;
}
.row .k {
  width: 96px;
  font-size: 12.5px;
  color: var(--kg-text-3);
  flex: 0 0 96px;
}
.row .v {
  flex: 1;
  font-size: 12.5px;
  color: var(--kg-text);
}
.danger-row .k {
  color: #e5484d;
  font-weight: 600;
}
</style>
