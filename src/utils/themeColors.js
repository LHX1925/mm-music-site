/**
 * 主题色（含渐变色）
 *
 * 每个主题给一对颜色：from / to。
 * - 单色主题 from == to，界面里就是纯色；
 * - 渐变主题会用在打卡卡片、按钮等大面积色块上（--kg-accent-grad）。
 * 设置里存的是 key，同时兼容旧版本存的十六进制色值。
 */
export const ACCENT_THEMES = [
  { key: 'green', label: '酷狗绿', from: '#00d26a', to: '#00a85a' },
  { key: 'blue', label: '晴空蓝', from: '#2f80ed', to: '#1b63cf' },
  { key: 'purple', label: '暮光紫', from: '#7c5cff', to: '#5b3ede' },
  { key: 'orange', label: '蜜柑橙', from: '#ff8a4c', to: '#ef5f1f' },
  { key: 'pink', label: '樱花粉', from: '#f26a92', to: '#d1416c' },
  { key: 'blueyellow', label: '蓝黄', from: '#3d7bfd', to: '#ffcb2e' },
  { key: 'deepgold', label: '深海金', from: '#1f4e79', to: '#d9a441' },
  { key: 'lime', label: '天青柠檬', from: '#4fc3c0', to: '#c3e04a' },
  { key: 'indigo', label: '靛金', from: '#6a5acd', to: '#e0b464' },
];

const DEFAULT_THEME = ACCENT_THEMES[0];

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function expand(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length === 3) return h.split('').map((c) => c + c).join('');
  return h.padEnd(6, '0').slice(0, 6);
}

export function hexToRgbString(hex) {
  const h = expand(hex);
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return '0, 210, 106';
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** 调亮 / 调暗：percent 为正时变亮，为负时变暗 */
export function shade(hex, percent) {
  const h = expand(hex);
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return hex;
  const amt = Math.round(2.55 * percent);
  const r = clamp(((n >> 16) & 255) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function withAlpha(hex, alpha) {
  return `rgba(${hexToRgbString(hex)}, ${alpha})`;
}

/**
 * 把设置里的值解析成主题对象。
 * 传 key 返回预设；传旧的十六进制色值时现场生成一对颜色，保证老用户设置不丢。
 */
export function resolveAccent(accent) {
  const raw = String(accent || '').trim();
  const preset = ACCENT_THEMES.find((t) => t.key === raw);
  if (preset) return { ...preset, gradient: `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`, isGradient: preset.from !== preset.to };
  // 旧版本存的是十六进制，如果正好等于某个预设的主色，直接认成那个预设
  const sameColor = ACCENT_THEMES.find((t) => t.from.toLowerCase() === raw.toLowerCase());
  if (sameColor) {
    return { ...sameColor, gradient: `linear-gradient(135deg, ${sameColor.from} 0%, ${sameColor.to} 100%)`, isGradient: sameColor.from !== sameColor.to };
  }
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    const to = shade(raw, -14);
    return {
      key: raw,
      label: '自定义',
      from: raw,
      to,
      gradient: `linear-gradient(135deg, ${raw} 0%, ${to} 100%)`,
      isGradient: false,
    };
  }
  const d = DEFAULT_THEME;
  return { ...d, gradient: `linear-gradient(135deg, ${d.from} 0%, ${d.to} 100%)`, isGradient: false };
}

/** 主题色背景（渐变色主题才有渐变感） */
export function accentGradient(accent) {
  return resolveAccent(accent).gradient;
}
