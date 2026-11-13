import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { setRuntime } from '@/api/http';

const STORAGE_KEY = 'kg-settings-v1';
/** 任务栏歌词改为「默认常开」的一次性迁移标记 */
const BAR_MIGRATE_KEY = 'kg-taskbar-lyric-default-on';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * 应用级状态：平台模式、API 服务、外观、偏好设置
 */
export const useAppStore = defineStore('app', () => {
  const saved = loadSettings();
  // 老版本默认是关的，升级后先强制打开一次，之后以用户设置为准
  const barMigrated = (() => {
    try {
      return localStorage.getItem(BAR_MIGRATE_KEY) === '1';
    } catch {
      return true;
    }
  })();

  const platform = ref(saved.platform || 'std'); // std=酷狗音乐  lite=酷狗音乐概念版
  const ports = ref({ std: 32100, lite: 32101 });
  const ready = ref({ std: false, lite: false });
  const serverError = ref({ std: '', lite: '' });
  const desktop = ref(Boolean(window.kg?.isDesktop));
  const appInfo = ref({ version: '1.0.0', downloadDir: '', localDirs: [], proxy: '', apiDir: '', localServerPort: 0 });
  const booting = ref(true);

  const settings = ref({
    quality: saved.quality || '320',
    volume: saved.volume ?? 0.7,
    playMode: saved.playMode || 'order',
    playbackRate: saved.playbackRate || 1,
    downloadDir: saved.downloadDir || '',
    localDirs: saved.localDirs || [],
    proxy: saved.proxy || '',
    showTranslation: saved.showTranslation ?? true,
    lyricSize: saved.lyricSize || 26,
    lyricFont: saved.lyricFont || 'system',
    showDesktopLyric: saved.showDesktopLyric ?? false,
    showTaskbarLyric: barMigrated ? saved.showTaskbarLyric ?? true : true,
    /** 任务栏歌词位置：taskbar=压在任务栏上，screen=贴在屏幕最底部（悬浮在任务栏上方） */
    barPos: saved.barPos || 'taskbar',
    showPlayCount: saved.showPlayCount ?? true,
    closeToTray: saved.closeToTray ?? false,
    accent: saved.accent || '#00d26a',
    // 外观
    appearance: saved.appearance || 'light', // light | dark | auto
    navMode: saved.navMode || 'left',
    playerLayout: saved.playerLayout || 'bottom',
    nativeFrame: saved.nativeFrame ?? false,
    fontSetting: saved.fontSetting || 'default',
    // 播放
    balanceAudio: saved.balanceAudio ?? false,
    autoPauseDeviceChange: saved.autoPauseDeviceChange ?? false,
    audioOutput: saved.audioOutput || '',
    greetOnStart: saved.greetOnStart ?? true,
    searchMode: saved.searchMode || 'recommend', // recommend | lyric
    // 系统
    gpuDisabled: saved.gpuDisabled ?? false,
    highDpi: saved.highDpi ?? false,
    autoStart: saved.autoStart ?? false,
    startMinimized: saved.startMinimized ?? false,
    preventSleep: saved.preventSleep ?? false,
    apiMode: saved.apiMode ?? false,
    blockThrottle: saved.blockThrottle ?? true,
    globalShortcut: saved.globalShortcut ?? false,
    logLevel: saved.logLevel || 'info',
    // 背景与玻璃
    bgType: saved.bgType || 'none', // none | image | video
    bgPath: saved.bgPath || '',
    bgUrl: saved.bgUrl || '',
    bgDim: saved.bgDim ?? 0.35,
    glass: saved.glass ?? false,
    glassBlur: saved.glassBlur ?? 18,
    // 每日自动领取会员
    autoVip: saved.autoVip || { enabled: false, time: '09:00', upgrade: false },
    /** 进入页面时自动弹出功能引导（可在设置里关闭） */
    guideOn: saved.guideOn ?? true,
  });

  const platformLabel = computed(() => (platform.value === 'lite' ? '概念版' : '标准版'));
  const platformName = computed(() => (platform.value === 'lite' ? '酷狗音乐概念版' : '酷狗音乐'));
  const currentPort = computed(() => ports.value[platform.value]);
  const serverReady = computed(() => ready.value[platform.value]);
  const accent = computed(() => settings.value.accent || '#00d26a');
  const isDark = computed(() => settings.value.appearance === 'dark');

  const effectiveAppearance = computed(() => {
    if (settings.value.appearance !== 'auto') return settings.value.appearance;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ platform: platform.value, ...settings.value }));
  }

  try {
    localStorage.setItem(BAR_MIGRATE_KEY, '1');
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }

  watch(platform, persist);
  watch(settings, persist, { deep: true });
  watch(
    () => settings.value.appearance,
    () => {
      applyAppearance();
      applyAccent();
    }
  );
  watch(
    () => [settings.value.glass, settings.value.glassBlur],
    () => applyGlass()
  );
  // 主色变化时统一在这里重算变量（任何入口改 accent 都会生效）
  watch(
    () => settings.value.accent,
    () => applyAccent()
  );

  /** 应用主题色 */
  function applyAccent() {
    const c = settings.value.accent;
    if (!c) return;
    const root = document.documentElement;
    root.style.setProperty('--kg-accent', c);
    // 半透明阴影/描边统一用 RGB 分量，主题色一变就全部跟着变
    root.style.setProperty('--kg-accent-rgb', rgbOf(c));
    // 深色主题下浅色调更适合做文字色，浅色主题用加深色
    root.style.setProperty('--kg-accent-dark', effectiveAppearance.value === 'dark' ? shade(c, 22) : shade(c, -12));
    root.style.setProperty('--kg-accent-soft', hexToRgba(c, effectiveAppearance.value === 'dark' ? 0.16 : 0.12));
    root.style.setProperty('--el-color-primary', c);
    root.style.setProperty('--el-color-primary-light-9', hexToRgba(c, 0.12));
  }

  function rgbOf(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    if (Number.isNaN(n)) return '0, 210, 106';
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  function hexToRgba(hex, alpha) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function shade(hex, percent) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0x00ff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0x0000ff) + amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  function applyAppearance() {
    const mode = effectiveAppearance.value;
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.font = settings.value.fontSetting || 'default';
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }

  function applyGlass() {
    document.documentElement.dataset.glass = settings.value.glass ? 'on' : 'off';
    document.documentElement.style.setProperty('--kg-glass-blur', `${settings.value.glassBlur || 18}px`);
  }

  /** 背景媒体地址（重启后重新拼装） */
  function backgroundUrl() {
    if (!settings.value.bgPath || settings.value.bgType === 'none') return '';
    if (settings.value.bgUrl) return settings.value.bgUrl;
    const port = appInfo.value.localServerPort;
    if (!port) return '';
    const b64 = btoa(unescape(encodeURIComponent(settings.value.bgPath)));
    return `http://127.0.0.1:${port}/__media?p=${encodeURIComponent(b64)}`;
  }

  async function pickBackground() {
    if (!window.kg?.chooseBackground) return null;
    const res = await window.kg.chooseBackground();
    if (!res) return null;
    settings.value.bgType = res.type;
    settings.value.bgPath = res.path;
    settings.value.bgUrl = res.url;
    return res;
  }

  function clearBackground() {
    settings.value.bgType = 'none';
    settings.value.bgPath = '';
    settings.value.bgUrl = '';
  }

  async function init() {
    applyAccent();
    applyAppearance();
    applyGlass();

    if (window.kg?.isDesktop) {
      const info = await window.kg.info();
      appInfo.value = info;
      ports.value = {
        std: info.servers?.std?.port || 32100,
        lite: info.servers?.lite?.port || 32101,
      };
      ready.value = {
        std: Boolean(info.servers?.std?.ready),
        lite: Boolean(info.servers?.lite?.ready),
      };
      serverError.value = {
        std: info.servers?.std?.error || '',
        lite: info.servers?.lite?.error || '',
      };
      if (info.downloadDir && !settings.value.downloadDir) settings.value.downloadDir = info.downloadDir;
      if (info.localDirs?.length && !settings.value.localDirs.length) settings.value.localDirs = info.localDirs;
      if (info.background?.path) {
        settings.value.bgType = info.background.type || settings.value.bgType;
        settings.value.bgPath = info.background.path;
        settings.value.bgUrl = `http://127.0.0.1:${info.localServerPort}/__media?p=${encodeURIComponent(
          btoa(unescape(encodeURIComponent(info.background.path)))
        )}`;
      }
      window.kg.on('server:status', (status) => {
        ports.value = { std: status.std.port || ports.value.std, lite: status.lite.port || ports.value.lite };
        ready.value = { std: Boolean(status.std.ready), lite: Boolean(status.lite.ready) };
        serverError.value = { std: status.std.error || '', lite: status.lite.error || '' };
      });

      if (!ready.value[platform.value]) {
        for (let i = 0; i < 5; i++) {
          if (await probe(platform.value)) {
            ready.value = { ...ready.value, [platform.value]: true };
            break;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const [std, lite] = await Promise.all([probe('std'), probe('lite')]);
        if (std || lite) ready.value = { std: std || ready.value.std, lite: lite || ready.value.lite };
        if (ready.value[platform.value]) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!ready.value[platform.value]) {
        const other = platform.value === 'std' ? 'lite' : 'std';
        if (ready.value[other]) platform.value = other;
      }
    }

    setRuntime({ ports: ports.value, platform: platform.value });
    booting.value = false;
  }

  async function probe(p) {
    const port = ports.value[p];
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`http://127.0.0.1:${port}/search/suggest?keywords=a&timestamp=${Date.now()}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);
      return res.status === 200 || res.status === 502;
    } catch {
      return false;
    }
  }

  function switchPlatform(next) {
    if (next === platform.value) return;
    platform.value = next;
    setRuntime({ platform: next });
  }

  function togglePlatform() {
    switchPlatform(platform.value === 'std' ? 'lite' : 'std');
  }

  async function updateSettings(patch) {
    Object.assign(settings.value, patch);
    if (window.kg?.isDesktop) {
      const sys = {};
      let hasSys = false;
      for (const k of ['closeToTray', 'nativeFrame', 'startMinimized', 'gpuDisabled', 'highDpi', 'disableThrottle', 'autoStart', 'preventSleep', 'globalShortcut']) {
        if (k in patch) {
          sys[k] = patch[k];
          hasSys = true;
        }
      }
      if (hasSys) await window.kg.setConfig(sys);
      if ('downloadDir' in patch || 'localDirs' in patch || 'proxy' in patch) {
        await window.kg.setConfig({
          downloadDir: settings.value.downloadDir,
          localDirs: settings.value.localDirs,
          proxy: settings.value.proxy,
        });
      }
      if ('autoStart' in patch) await window.kg.setLoginItem(patch.autoStart);
      if ('preventSleep' in patch) await window.kg.preventSleep(patch.preventSleep);
      if ('globalShortcut' in patch) await window.kg.setGlobalShortcut(patch.globalShortcut);
    }
  }

  function setPort(p, port) {
    ports.value = { ...ports.value, [p]: port };
  }

  return {
    platform,
    ports,
    ready,
    serverError,
    desktop,
    appInfo,
    booting,
    settings,
    platformLabel,
    platformName,
    currentPort,
    serverReady,
    accent,
    isDark,
    effectiveAppearance,
    init,
    switchPlatform,
    togglePlatform,
    updateSettings,
    setPort,
    setRuntime,
    applyAccent,
    applyAppearance,
    applyGlass,
    backgroundUrl,
    pickBackground,
    clearBackground,
  };
});
