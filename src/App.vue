<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { usePlayerStore } from '@/stores/player';
import { useVipStore } from '@/stores/vip';
import { useUpdateStore } from '@/stores/update';
import { isAuxWindow } from '@/utils/windowRole';
import Sidebar from '@/components/layout/Sidebar.vue';
import TitleBar from '@/components/layout/TitleBar.vue';
import PlayerBar from '@/components/layout/PlayerBar.vue';
import AppBackground from '@/components/layout/AppBackground.vue';
import LoginDialog from '@/components/login/LoginDialog.vue';
import FullPlayer from '@/components/player/FullPlayer.vue';
import QueueDialog from '@/components/player/QueueDialog.vue';
import Icon from '@/components/common/Icon.vue';
import AddToPlaylistDialog from '@/components/common/AddToPlaylistDialog.vue';
import ThemeDialog from '@/components/common/ThemeDialog.vue';
import CommentDialog from '@/components/player/CommentDialog.vue';
import MvDialog from '@/components/player/MvDialog.vue';
import BackToTop from '@/components/common/BackToTop.vue';
import GreetToast from '@/components/common/GreetToast.vue';
import UpdateDialog from '@/components/common/UpdateDialog.vue';
import { readLyricCfg } from '@/utils/desktopLyric';
import { pickGreeting, playGreeting, readLastGreeting, saveLastGreeting } from '@/utils/greeting';

const app = useAppStore();
const user = useUserStore();
const library = useLibraryStore();
const ui = useUiStore();
const player = usePlayerStore();
const vip = useVipStore();
const update = useUpdateStore();
const route = useRoute();

const maximized = ref(false);
/** 启动问候语（语音 + 气泡），只在本进程首次挂载时触发一次 */
const greetItem = ref(null);
// 桌面歌词 / 托盘面板 / 任务栏歌词是独立小窗口，不渲染主界面
// 这里优先用 location.hash 判断：router 首次导航是异步的，onMounted 时
// route.name 还可能是 undefined，只靠它会把小窗误判成主窗口
const AUX_ROUTE_NAMES = ['desktop-lyric', 'tray', 'taskbar'];
const isStandalone = computed(
  () => isAuxWindow() || AUX_ROUTE_NAMES.includes(route.name)
);
const hasBackground = computed(() => app.settings.bgType !== 'none' && Boolean(app.settings.bgPath));

// 桌面端调试入口（便于排查播放/登录问题）
if (typeof window !== 'undefined') {
  window.__kgStores = { app, user, library, player, ui, vip };
}

let tickTimer = null;
let offPlayerCmd = null;
let offUpdate = [];

onMounted(async () => {
  // 桌面歌词 / 托盘面板窗口只负责渲染，不初始化播放器/账号/定时器
  if (isStandalone.value) return;
  await app.init();
  user.setPorts(app.ports);
  user.syncRuntime(app.platform);
  // 取流接口需要合法设备号（dfid），没有会被风控挡成 20028「无法播放」
  // 最多等 4 秒，避免接口异常时卡住启动
  await Promise.race([user.initDevice(), new Promise((r) => setTimeout(r, 4000))]);
  await user.refreshProfile();
  await Promise.allSettled([library.loadUserPlaylists(), library.loadDownloads()]);
  if (user.isLogin) await vip.load();

  // 重启续播：恢复上次的歌曲 / 队列 / 进度，并尝试接着播
  // 静默启动（开机自启、最小化启动）时只恢复状态不自动出声
  let startedHidden = false;
  try {
    startedHidden = Boolean((await window.kg?.info?.())?.startedHidden);
  } catch {}
  player.restoreResume({ autoplay: !startedHidden }).catch(() => {});

  if (window.kg) {
    window.kg.on('window:state', (s) => (maximized.value = s.maximized));
    offPlayerCmd = window.kg.on('player:command', (cmd) => {
      if (cmd === 'toggle') player.toggle();
      else if (cmd === 'next') player.next();
      else if (cmd === 'prev') player.prev();
    });
    if (app.settings.showDesktopLyric) window.kg.lyric.toggle(true);
    if (app.settings.showTaskbarLyric) window.kg.bar?.toggle(true);
    window.kg.bar?.position?.(app.settings.barPos || 'taskbar');
    window.kg.on('lyric:closed', () => {
      if (app.settings.showDesktopLyric) app.updateSettings({ showDesktopLyric: false });
    });
    // 任务栏歌词是常驻的，窗口若被意外销毁就在下一轮自动重建
    window.kg.on('bar:closed', () => {
      if (app.settings.showTaskbarLyric) setTimeout(() => window.kg?.bar?.toggle(true), 800);
    });
    // 在线更新：静默检查到新版本 / 下载进度
    update.init();
    offUpdate = [
      window.kg.on('update:available', (res) => update.applyResult(res)),
      window.kg.on('update:progress', (p) => update.onProgress(p)),
    ];
  }

  // 启动问候语：随机播一条语音 + 轻量气泡（不再用全局 ElMessage，避免挡视线）
  if (app.settings.greetOnStart !== false) {
    setTimeout(() => {
      const item = pickGreeting(readLastGreeting());
      saveLastGreeting(item.id);
      greetItem.value = item;
      // 已经在放歌时只显示气泡，不叠加第二路声音
      if (!player.playing && !player.current) playGreeting(item, 0.55);
    }, 1600);
  }

  // 会员每日自动领取：每分钟检查一次
  tickTimer = setInterval(() => vip.tick(), 60 * 1000);
  vip.tick();

  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  clearInterval(tickTimer);
  offPlayerCmd?.();
  offUpdate.forEach((off) => off?.());
  offUpdate = [];
});

watch(
  () => app.platform,
  async (p) => {
    user.syncRuntime(p);
    await user.refreshProfile();
    await vip.load();
    await Promise.allSettled([library.loadUserPlaylists(), library.loadDownloads()]);
  }
);

watch(
  () => user.isLogin,
  async (v) => {
    if (v) {
      await Promise.allSettled([
        library.loadUserPlaylists(),
        library.loadFollowSingers(),
        library.loadCloud(),
        vip.load(),
      ]);
      vip.tick();
    }
  }
);

// 背景开关 -> 根节点标记
watch(
  () => [app.settings.bgType, app.settings.bgPath, app.settings.glass, app.settings.glassBlur],
  () => {
    const on = app.settings.bgType !== 'none' && Boolean(app.settings.bgPath);
    document.documentElement.dataset.bg = on ? 'on' : 'off';
    document.documentElement.dataset.bgtype = on ? app.settings.bgType : 'none';
  },
  { immediate: true }
);

// 桌面歌词开关
watch(
  () => app.settings.showDesktopLyric,
  (v) => {
    window.kg?.lyric.toggle(Boolean(v));
  }
);

// 任务栏歌词开关
watch(
  () => app.settings.showTaskbarLyric,
  (v) => {
    window.kg?.bar?.toggle(Boolean(v));
  }
);

// 任务栏歌词位置
watch(
  () => app.settings.barPos,
  (v) => {
    window.kg?.bar?.position?.(v || 'taskbar');
  }
);

// 把播放状态推送到托盘面板
watch(
  () => [
    player.current?.hash,
    player.playing,
    Math.floor(player.progress || 0),
    Math.floor(player.duration || 0),
    player.lyricIndex,
    player.lyricLines.length,
  ],
  () => {
    if (!window.kg?.tray || isStandalone.value) return;
    const lines = player.lyricLines || [];
    // 跳过「作词/作曲」这类信息行，优先显示真正的歌词
    const CREDIT = /^(作词|作曲|编曲|曲|词|制作人|监制|混音|母带|吉他|贝斯|鼓|和声|录音|发行|出品|OP|SP|统筹|企划)[：:]/;
    let li = player.lyricIndex;
    let cur = lines[li];
    for (let i = 0; i < 6 && cur && CREDIT.test(cur.text || ''); i++) cur = lines[++li];
    window.kg.tray.update({
      name: player.current?.name || '',
      singer: player.current?.singer || '',
      cover: player.current?.coverBig || player.current?.cover || '',
      playing: Boolean(player.playing),
      progress: Math.floor(player.progress || 0),
      duration: Math.floor(player.duration || player.current?.duration || 0),
      lyric: cur?.text || '',
      nextLyric: lines[li + 1]?.text || '',
      version: app.appInfo?.version || '',
    });
  },
  { immediate: true }
);

// 把当前歌词推送到桌面歌词窗口（支持延迟 / 单行 / 颜色等自定义配置）
let lastLyricPayload = '';
watch(
  () => [
    player.lyricIndex,
    player.current?.hash,
    player.playing,
    app.settings.showDesktopLyric,
    player.lyricLines.length,
    Math.floor((player.progress || 0) * 2),
  ],
  () => {
    if (!window.kg || !app.settings.showDesktopLyric) return;
    const cfg = readLyricCfg();
    const lines = player.lyricLines || [];
    // 延迟：正数表示歌词晚出，用更早的时间点去找当前行
    const t = Math.max(0, (player.progress || 0) - (Number(cfg.delay) || 0) / 1000);
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= t + 0.12) idx = i;
      else break;
    }
    if (idx < 0) idx = Math.min(player.lyricIndex, Math.max(0, lines.length - 1));
    const cur = lines[idx];
    const next = lines[idx + 1];
    const payload = {
      song: player.current?.name || '',
      singer: player.current?.singer || '',
      text: cur?.text || (player.current ? `${player.current.name} - ${player.current.singer}` : '暂无播放'),
      tr: cur?.tr || '',
      next: next?.text || '',
      playing: player.playing,
      cfg,
    };
    const key = `${payload.song}|${payload.text}|${payload.playing}|${JSON.stringify(cfg)}`;
    if (key === lastLyricPayload) return;
    lastLyricPayload = key;
    window.kg.lyric.update(payload);
  },
  { deep: true, immediate: true }
);

function onKeydown(e) {
  const el = e.target;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    player.toggle();
  } else if (e.code === 'ArrowLeft') {
    player.seek(Math.max(0, player.progress - 5));
  } else if (e.code === 'ArrowRight') {
    player.seek(Math.min(player.duration || 0, player.progress + 5));
  } else if (e.code === 'ArrowUp') {
    e.preventDefault();
    player.setVolume(player.volume + 0.05);
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    player.setVolume(player.volume - 0.05);
  } else if (e.code === 'Escape') {
    if (ui.showPlayer) ui.showPlayer = false;
  }
}

const showBoot = computed(() => !app.booting && !app.serverReady && !isStandalone.value);
</script>

<template>
  <router-view v-if="isStandalone" />

  <template v-else>
    <div class="app-window" :class="{ maximized }">
      <AppBackground />
      <!-- 液态玻璃基底：给毛玻璃一层稳定的渐变背景，避免透出桌面导致忽明忽暗 -->
      <div v-if="app.settings.glass && !hasBackground" class="glass-base" />
      <div class="app-body">
        <Sidebar />
        <div class="workspace">
          <TitleBar />
          <main class="page-host">
            <router-view v-if="!app.booting" v-slot="{ Component }">
              <transition name="page" mode="out-in">
                <component :is="Component" :key="ui.refreshKey" />
              </transition>
            </router-view>
            <BackToTop />
          </main>
          <PlayerBar />
        </div>
      </div>

      <el-dialog v-model="ui.showLogin" width="430" :show-close="true" align-center append-to-body>
        <LoginDialog />
      </el-dialog>

      <transition name="slide-up">
        <FullPlayer v-if="ui.showPlayer" />
      </transition>

      <QueueDialog />
      <AddToPlaylistDialog />
      <ThemeDialog />
      <CommentDialog />
      <MvDialog />
      <UpdateDialog />
      <GreetToast :item="greetItem" @close="greetItem = null" />

      <transition name="fade">
        <div v-if="showBoot" class="boot-mask">
          <div class="boot-card">
            <div class="boot-logo"><Icon name="note" :size="30" color="#fff" /></div>
            <div class="boot-title">正在启动萌萌音乐服务…</div>
            <div class="boot-sub">
              首次启动需要初始化本地接口，请稍候
              <template v-if="app.serverError[app.platform]">（{{ app.serverError[app.platform] }}）</template>
            </div>
            <el-progress :percentage="100" :indeterminate="true" :show-text="false" :stroke-width="4" />
          </div>
        </div>
      </transition>
    </div>
  </template>
</template>

<style scoped>
.app-window {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--kg-bg);
  border-radius: 12px;
  /* clip-path 是硬裁切：即使子层用了 backdrop-filter 也不会把直角顶出来 */
  -webkit-clip-path: inset(0 round 12px);
  clip-path: inset(0 round 12px);
  overflow: hidden;
  position: relative;
  isolation: isolate;
  z-index: 1;
  box-shadow: inset 0 0 0 1px rgba(15, 20, 30, 0.08);
}
:global([data-bg='on']) .app-window {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
}
.app-window.maximized {
  border-radius: 0;
  -webkit-clip-path: none;
  clip-path: none;
}

.app-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
  z-index: 1;
}
.workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
}
.page-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
.page-enter-active,
.page-leave-active {
  transition: opacity 0.16s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0.6;
}
.boot-mask {
  position: absolute;
  inset: 0;
  background: var(--kg-bg);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 50;
}
.boot-card {
  width: 330px;
  padding: 26px;
  border-radius: 16px;
  background: var(--kg-surface);
  box-shadow: var(--kg-shadow);
  text-align: center;
}
.boot-logo {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--kg-accent), var(--kg-accent-dark));
  display: grid;
  place-items: center;
  margin: 0 auto 14px;
}
.boot-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}
.boot-sub {
  font-size: 12px;
  color: var(--kg-text-3);
  margin-bottom: 16px;
  line-height: 1.6;
}
</style>
