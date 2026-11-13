<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import VipBadge from '@/components/common/VipBadge.vue';
import { useAppStore } from '@/stores/app';
import { useLibraryStore } from '@/stores/library';
import { useUserStore } from '@/stores/user';
import { useUiStore } from '@/stores/ui';
import { useVipStore } from '@/stores/vip';

const app = useAppStore();
const user = useUserStore();
const library = useLibraryStore();
const ui = useUiStore();
const vip = useVipStore();
const router = useRouter();
const route = useRoute();

const playlistTab = ref('created');
/** 侧栏收起：只留图标，给内容区腾出宽度 */
const collapsed = computed(() => app.settings.sidebarCollapsed === true);
const scrollEl = ref(null);
/** 未登录时的默认头像 */
const DEFAULT_AVATAR = '/assets/profile.jpg';

watch(
  () => route.fullPath,
  () => {
    if (scrollEl.value) scrollEl.value.scrollTop = 0;
  }
);
const quick = [
  { name: 'home', icon: 'home', label: '首页推荐', desc: '今日为你推荐', path: '/' },
  { name: 'discover', icon: 'compass', label: '发现音乐', desc: '歌单 · 榜单 · 新碟', path: '/discover' },
  { name: 'fm', icon: 'radio', label: '私人电台', desc: '越听越懂你', path: '/fm' },
  { name: 'book', icon: 'headphones', label: '听书电台', desc: '用耳朵读完一本书', path: '/book' },
];

const navs = [
  { icon: 'user', label: '个人中心', path: '/profile' },
  { icon: 'vip', label: '会员中心', path: '/vip', badge: () => (vip.claimedToday ? '' : '可领') },
  { icon: 'heart', label: '喜欢', path: '/favorite', count: () => library.favorites.length },
  { icon: 'clock', label: '最近播放', path: '/recent' },
  { icon: 'folder', label: '本地音乐', path: '/local' },
  { icon: 'list', label: '试听列表', path: '/preview', count: () => library.preview.length },
];

const visiblePlaylists = computed(() => {
  const list = library.userPlaylists || [];
  const created = list.filter((p) => !p.collected);
  const collected = list.filter((p) => p.collected);
  return (playlistTab.value === 'created' ? created : collected).slice(0, 20);
});
const createdCount = computed(() => (library.userPlaylists || []).filter((p) => !p.collected).length);
const collectedCount = computed(() => (library.userPlaylists || []).filter((p) => p.collected).length);

const isActive = (path) => (path === '/' ? route.path === '/' : route.path.startsWith(path));

/** 太阳按钮只做一件事：切换浅色 / 深色，不再弹主题设置面板 */
function toggleAppearance() {
  app.updateSettings({ appearance: app.effectiveAppearance === 'dark' ? 'light' : 'dark' });
}

function go(path) {
  router.push(path);
}

function toggleCollapse() {
  app.updateSettings({ sidebarCollapsed: !collapsed.value });
}

async function openVip() {
  window.kg?.openExternal('https://vip.kugou.com/');
}

async function createPlaylist() {
  if (!user.isLogin) return ui.openLogin();
  try {
    const { value } = await ElMessageBox.prompt('给你的新歌单起个名字', '新建歌单', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: '默认歌单名称',
      inputValue: `我的歌单 ${new Date().getMonth() + 1}/${new Date().getDate()}`,
    });
    if (!value) return;
    await library.createPlaylist(value);
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '创建失败');
  }
}

function onUserCommand(cmd) {
  if (cmd === 'logout') {
    user.logout();
    ElMessage.success('已退出登录');
    library.loadUserPlaylists();
  } else if (cmd === 'login') {
    ui.openLogin();
  } else if (cmd === 'settings') {
    go('/settings');
  } else if (cmd === 'cloud') {
    go('/cloud');
  } else if (cmd === 'follow') {
    go('/follow');
  } else if (cmd === 'switch') {
    app.togglePlatform();
  } else if (cmd === 'profile') {
    go('/profile');
  }
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="side-scroll" ref="scrollEl">
      <!-- 用户卡片 -->
      <el-dropdown trigger="click" placement="bottom-start" @command="onUserCommand">
        <div class="user-card">
          <div class="user-ava">
            <div class="avatar">
              <img :src="user.avatar || DEFAULT_AVATAR" alt="" />
            </div>
          </div>
          <div class="user-meta">
            <div class="user-name ellipsis">{{ user.isLogin ? user.nickname : '未登录' }}</div>
            <!-- 会员等级横排放用户名下面，替换掉「会员剩余 xx」文字 -->
            <div class="user-sub">
              <VipBadge v-if="user.isLogin && vip.badges.length" :size="12" />
              <span v-else class="ellipsis">{{ user.isLogin ? '每日可领 1 天会员' : '登录后同步歌单与收藏' }}</span>
            </div>
          </div>
          <Icon name="chevron-down" :size="16" color="#9aa0ab" />
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile"><Icon name="user" :size="14" /> 个人中心</el-dropdown-item>
            <el-dropdown-item v-if="!user.isLogin" command="login" divided>
              <Icon name="phone" :size="14" /> 登录账号
            </el-dropdown-item>
            <template v-else>
              <el-dropdown-item command="cloud"><Icon name="cloud" :size="14" /> 音乐云盘</el-dropdown-item>
              <el-dropdown-item command="follow"><Icon name="singer" :size="14" /> 关注的歌手</el-dropdown-item>
              <el-dropdown-item command="settings" divided><Icon name="settings" :size="14" /> 设置</el-dropdown-item>
              <el-dropdown-item command="logout"><Icon name="logout" :size="14" /> 退出登录</el-dropdown-item>
            </template>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 快捷入口（横向按钮） -->
      <div class="quick-list">
        <button
          v-for="q in quick"
          :key="q.name"
          class="quick-item"
          :class="{ active: isActive(q.path) }"
          :title="collapsed ? q.label : q.desc"
          @click="go(q.path)"
        >
          <span class="q-icon"><Icon :name="q.icon" :size="18" :filled="q.icon === 'home'" /></span>
          <span class="q-text">
            <span class="q-label">{{ q.label }}</span>
            <span class="q-desc">{{ q.desc }}</span>
          </span>
          <Icon name="arrow-right" :size="12" class="q-chev" />
        </button>
      </div>

      <button class="add-btn" @click="createPlaylist">
        <Icon name="plus" :size="18" color="#9aa0ab" />
        <span>新建歌单</span>
      </button>

      <!-- 主导航 -->
      <nav class="nav-list">
        <button
          v-for="n in navs"
          :key="n.path"
          class="nav-item"
          :class="{ active: isActive(n.path) }"
          :title="collapsed ? n.label : ''"
          @click="go(n.path)"
        >
          <Icon :name="n.icon" :size="19" />
          <span class="nav-label">{{ n.label }}</span>
          <span v-if="n.badge && n.badge()" class="nav-badge">{{ n.badge() }}</span>
          <span v-if="n.count && n.count()" class="nav-count">{{ n.count() }}</span>
        </button>
      </nav>

      <!-- 歌单 -->
      <div class="pl-head">
        <button
          class="pl-tab"
          :class="{ active: playlistTab === 'created' }"
          @click="playlistTab = 'created'"
        >
          自建歌单 <i v-if="createdCount" class="pl-num">{{ createdCount }}</i>
        </button>
        <button
          class="pl-tab"
          :class="{ active: playlistTab === 'collected' }"
          @click="playlistTab = 'collected'"
        >
          收藏歌单 <i v-if="collectedCount" class="pl-num">{{ collectedCount }}</i>
        </button>
        <button class="pl-add" title="新建歌单" @click="createPlaylist">
          <Icon name="plus" :size="14" color="#9aa0ab" />
        </button>
      </div>

      <div v-if="user.isLogin" class="pl-list">
        <button
          v-for="pl in visiblePlaylists"
          :key="pl.id"
          class="pl-item"
          :class="{ active: route.path === `/playlist/${pl.id}` }"
          :title="pl.name"
          @click="go(`/playlist/${pl.id}`)"
        >
          <CoverImage
            :src="pl.cover"
            :size="collapsed ? 34 : 26"
            :radius="collapsed ? 8 : 6"
            :letter="pl.name.slice(0, 1)"
            :seed="pl.id"
            class="pl-cover"
          />
          <span class="ellipsis pl-name">{{ pl.name }}</span>
          <span class="pl-count">{{ pl.songCount || '' }}</span>
        </button>
        <button v-if="!visiblePlaylists.length" class="pl-empty" @click="go('/my/playlists')">
          还没有歌单，去创建
        </button>
        <button class="pl-more" @click="go('/my/playlists')">查看全部歌单</button>
      </div>
      <div v-else class="pl-login" @click="ui.openLogin()">
        <Icon name="plus" :size="14" color="#9aa0ab" />
        <span>登录后同步我的歌单</span>
      </div>
    </div>

    <!-- 底部工具：只保留收起 / 深浅主题 / 设置 -->
    <div class="side-bottom">
      <button class="round-btn" :title="collapsed ? '展开侧边栏' : '收起侧边栏'" @click="toggleCollapse">
        <Icon name="sidebar" :size="17" />
      </button>
      <button class="round-btn" title="切换深浅主题" @click="toggleAppearance">
        <Icon :name="app.effectiveAppearance === 'dark' ? 'moon' : 'sun'" :size="17" />
      </button>
      <button class="round-btn" title="设置" @click="go('/settings')">
        <Icon name="settings" :size="17" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 256px;
  flex: 0 0 256px;
  background: var(--kg-side);
  border-right: 1px solid var(--kg-line-2);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: width 0.2s ease, flex-basis 0.2s ease;
}

/* ---------------- 收起状态：只留一列图标 ---------------- */
.sidebar.collapsed {
  width: 68px;
  flex: 0 0 68px;
}
.sidebar.collapsed .user-card {
  justify-content: center;
  padding: 16px 0 10px;
  gap: 0;
  width: 100%;
}
/* 收起态：el-dropdown 默认 inline-block，会收缩到内容宽度把头像挤到左边，
   必须让它铺满并居中，头像才能真正水平居中 */
.sidebar.collapsed :deep(.el-dropdown) {
  width: 100%;
  display: flex;
  justify-content: center;
}
/* 收起态：头像整体水平居中（含包裹层），避免偏左 */
.sidebar.collapsed .user-ava {
  width: 100%;
  display: flex;
  justify-content: center;
  flex: 1 1 auto;
}
.sidebar.collapsed .user-meta,
.sidebar.collapsed .user-card > svg,
.sidebar.collapsed .q-text,
.sidebar.collapsed .q-chev,
.sidebar.collapsed .nav-label,
.sidebar.collapsed .nav-badge,
.sidebar.collapsed .nav-count,
.sidebar.collapsed .add-btn span,
.sidebar.collapsed .pl-head,
.sidebar.collapsed .pl-login span,
.sidebar.collapsed .pl-name,
.sidebar.collapsed .pl-count,
.sidebar.collapsed .pl-more,
.sidebar.collapsed .pl-empty {
  display: none;
}
/* 收起态：歌单不清空，改成一列圆形封面缩略图（悬停有名字提示） */
.sidebar.collapsed .pl-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0 6px;
}
.sidebar.collapsed .pl-item {
  width: 42px;
  height: 42px;
  min-height: 42px;
  padding: 0;
  border-radius: 10px !important;
  justify-content: center;
  overflow: hidden;
}
.sidebar.collapsed .pl-item .pl-cover {
  width: 34px !important;
  height: 34px !important;
  border-radius: 8px !important;
}
.sidebar.collapsed .pl-item.active {
  box-shadow: 0 0 0 2px var(--kg-accent);
}
.sidebar.collapsed .pl-login {
  width: 34px;
  height: 34px;
  margin: 8px auto 2px;
  padding: 0;
  border-radius: 8px;
  justify-content: center;
}
.sidebar.collapsed .quick-list {
  padding: 0 10px;
}
.sidebar.collapsed .quick-item {
  justify-content: center;
  padding: 0;
  height: 40px;
}
.sidebar.collapsed .q-icon {
  width: auto;
}
.sidebar.collapsed .add-btn {
  margin: 10px 14px 4px;
  height: 34px;
}
.sidebar.collapsed .nav-list {
  padding: 8px 10px 4px;
}
.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 0;
  height: 40px;
}
.sidebar.collapsed .side-bottom {
  flex-direction: column;
  height: auto;
  padding: 8px 0;
  gap: 4px;
}
.side-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 14px;
}
.side-scroll::-webkit-scrollbar {
  width: 6px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 10px;
  cursor: pointer;
  outline: none;
}
.user-ava {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--kg-panel);
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  flex: 0 0 36px;
  box-shadow: 0 0 0 1px var(--kg-line);
}
.avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--kg-accent-dark);
}
.vip-dot {
  position: absolute;
  left: -4px;
  bottom: -4px;
  font-style: normal;
  font-size: 7px;
  font-weight: 700;
  color: #6b4200;
  background: linear-gradient(135deg, #ffe6b0, #f3bd63);
  border-radius: 4px;
  padding: 1px 3px;
  border: 1px solid #fff;
}
.user-meta {
  flex: 1;
  min-width: 0;
}
.user-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
}
.user-sub {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 14px;
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 3px;
}
.user-sub .ellipsis {
  min-width: 0;
}

.quick-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 16px;
}
.quick-item {
  height: 44px;
  border-radius: 10px;
  background: var(--kg-panel);
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  transition: background 0.15s ease, transform 0.15s ease;
}
.quick-item:hover {
  background: var(--kg-hover);
  transform: translateX(1px);
}
.quick-item.active {
  background: var(--kg-accent-soft);
}
.quick-item.active .q-label {
  color: var(--kg-accent-dark);
  font-weight: 600;
}
.quick-item.active .q-icon {
  color: var(--kg-accent-dark);
}
.q-icon {
  width: 24px;
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
}
.q-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  text-align: left;
  gap: 1px;
}
.q-label {
  font-size: 12.5px;
  color: var(--kg-text);
}
.q-desc {
  font-size: 10px;
  color: var(--kg-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.q-chev {
  color: var(--kg-text-3);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.quick-item:hover .q-chev {
  opacity: 1;
}

.add-btn {
  margin: 10px 16px 4px;
  height: 36px;
  border-radius: 9px;
  border: 1px dashed var(--kg-line-2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--kg-text-3);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.add-btn:hover {
  border-color: var(--kg-line-2);
  background: var(--kg-panel);
  color: var(--kg-text-2);
}

.nav-list {
  padding: 8px 10px 4px;
}
.nav-item {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--kg-text);
  font-size: 13px;
  transition: background 0.14s ease;
}
.nav-item:hover {
  background: var(--kg-hover);
}
.nav-item.active {
  background: var(--kg-accent-soft);
  color: var(--kg-accent-dark);
  font-weight: 600;
}
.nav-label {
  flex: 1;
  text-align: left;
}
.nav-count {
  font-size: 11px;
  color: var(--kg-text-3);
}
.nav-badge {
  font-size: 9.5px;
  font-weight: 600;
  color: #8a5a00;
  background: linear-gradient(135deg, #ffe6b0, #f3bd63);
  border-radius: 4px;
  padding: 1px 4px;
}

.pl-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 4px;
}
.pl-tab {
  font-size: 12px;
  color: var(--kg-text-3);
  font-weight: 500;
  transition: color 0.15s ease;
}
.pl-tab.active {
  color: var(--kg-text);
  font-weight: 600;
}
.pl-add {
  margin-left: auto;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 5px;
}
.pl-add:hover {
  background: var(--kg-hover);
}
.pl-list {
  padding: 4px 10px 0;
}
.pl-item {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 12.5px;
  color: var(--kg-text-2);
  text-align: left;
}
.pl-item .pl-cover {
  flex: 0 0 auto;
}
.pl-item .pl-name {
  flex: 1;
  min-width: 0;
}
.pl-item.active .pl-name {
  font-weight: 600;
}
.pl-item:hover {
  background: var(--kg-hover);
}
.pl-item.active {
  background: var(--kg-accent-soft);
  color: var(--kg-accent-dark);
}
.pl-count {
  font-size: 10px;
  color: var(--kg-text-3);
  flex: 0 0 auto;
}
.pl-num {
  font-style: normal;
  font-size: 10px;
  color: var(--kg-text-3);
  margin-left: 2px;
}
.pl-empty,
.pl-more {
  width: 100%;
  height: 30px;
  font-size: 12px;
  color: var(--kg-text-3);
  text-align: left;
  padding-left: 8px;
}
.pl-more:hover {
  color: var(--kg-accent-dark);
}
.pl-login {
  margin: 6px 16px;
  height: 34px;
  border-radius: 8px;
  border: 1px dashed var(--kg-line-2);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--kg-text-3);
  cursor: pointer;
}
.pl-login:hover {
  color: var(--kg-text-2);
  border-color: var(--kg-line-2);
}

.side-bottom {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 0 12px;
  border-top: 1px solid var(--kg-line-2);
  background: var(--kg-hover);
}
.round-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-text-2);
  background: var(--kg-panel);
  transition: background 0.15s ease, color 0.15s ease;
}
.round-btn:hover {
  background: var(--kg-hover);
  color: var(--kg-text);
}
</style>
