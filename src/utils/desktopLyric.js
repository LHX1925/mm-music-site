/**
 * 桌面歌词配置 & 歌词收藏
 *
 * 桌面歌词是独立窗口，读不到 Pinia 状态，这里用 localStorage 作为唯一数据源：
 * - 主窗口推歌词时读取配置（字号/颜色/方向/单行/延迟/动画）
 * - 歌词窗口、设置页写配置；同源窗口通过 storage 事件即时感知
 */
export const LYRIC_CFG_KEY = 'kg-desktop-lyric-cfg';
export const LYRIC_FAV_KEY = 'kg-lyric-favorites';

export const LYRIC_COLORS = [
  { label: '纯白', value: '#ffffff' },
  { label: '奶油黄', value: '#ffe6a7' },
  { label: '天空蓝', value: '#8fd8ff' },
  { label: '薄荷绿', value: '#7df3c1' },
  { label: '樱花粉', value: '#ffb3cd' },
  { label: '暮光紫', value: '#c7b3ff' },
  { label: '墨黑', value: '#181a20' },
];

export const DEFAULT_LYRIC_CFG = {
  /** 字号 px */
  size: 30,
  /** 字体颜色，空字符串 = 跟随主题 */
  color: '',
  /** 单行模式：只显示当前歌词 */
  single: false,
  /** 方向：horizontal=横排单行，vertical=竖排（竖屏） */
  direction: 'horizontal',
  /** 歌词延迟（毫秒，正数=歌词更晚出现，负数=提前） */
  delay: 0,
  /** 切行跳跃动画 */
  animate: true,
};

export function readLyricCfg() {
  try {
    const raw = JSON.parse(localStorage.getItem(LYRIC_CFG_KEY) || '{}');
    return { ...DEFAULT_LYRIC_CFG, ...(raw || {}) };
  } catch {
    return { ...DEFAULT_LYRIC_CFG };
  }
}

export function saveLyricCfg(patch) {
  const next = { ...readLyricCfg(), ...(patch || {}) };
  try {
    localStorage.setItem(LYRIC_CFG_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function readLyricFavs() {
  try {
    const list = JSON.parse(localStorage.getItem(LYRIC_FAV_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addLyricFav(item) {
  if (!item?.text) return readLyricFavs();
  const key = `${item.song || ''}__${item.text}`;
  const list = readLyricFavs().filter((x) => `${x.song || ''}__${x.text}` !== key);
  list.unshift({ ...item, at: Date.now() });
  const next = list.slice(0, 200);
  try {
    localStorage.setItem(LYRIC_FAV_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function removeLyricFav(index) {
  const list = readLyricFavs();
  list.splice(index, 1);
  try {
    localStorage.setItem(LYRIC_FAV_KEY, JSON.stringify(list));
  } catch {}
  return list;
}
