import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * 独立小窗（桌面歌词 / 托盘面板 / 任务栏歌词）的主题同步
 *
 * 这些窗口不初始化 Pinia 主流程，但和主窗口同源：直接读取 localStorage 里的设置，
 * 再监听 storage 事件，主窗口改主题/主色时这里会立刻跟着变。
 */
const SETTINGS_KEY = 'kg-settings-v1';

export function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function hexToRgba(hex, alpha) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return `rgba(0, 210, 106, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shade(hex, percent) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0x00ff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0x0000ff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 把主题（明暗 + 主色）应用到当前文档 */
export function applyTheme(settings = readSettings()) {
  const appearance = settings.appearance || 'light';
  const mode =
    appearance === 'auto'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : appearance;
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle('dark', mode === 'dark');
  const accent = settings.accent || '#00d26a';
  root.style.setProperty('--kg-accent', accent);
  const rgb = parseInt(String(accent).replace('#', ''), 16);
  if (!Number.isNaN(rgb)) {
    root.style.setProperty('--kg-accent-rgb', `${(rgb >> 16) & 255}, ${(rgb >> 8) & 255}, ${rgb & 255}`);
  }
  root.style.setProperty('--kg-accent-dark', mode === 'dark' ? shade(accent, 22) : shade(accent, -12));
  root.style.setProperty('--kg-accent-soft', hexToRgba(accent, mode === 'dark' ? 0.16 : 0.12));
  document.body.dataset.theme = mode;
  return mode;
}

/** 在组件里调用：自动应用并跟随主窗口设置变化 */
export function useThemeSync() {
  const mode = ref('light');

  const sync = () => {
    mode.value = applyTheme(readSettings());
  };

  onMounted(() => {
    sync();
    window.addEventListener('storage', sync);
    try {
      window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', sync);
    } catch {}
  });

  onBeforeUnmount(() => {
    window.removeEventListener('storage', sync);
    try {
      window.matchMedia?.('(prefers-color-scheme: dark)').removeEventListener?.('change', sync);
    } catch {}
  });

  return { mode, sync };
}
