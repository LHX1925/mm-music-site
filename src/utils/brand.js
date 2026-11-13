/**
 * 平台品牌标识
 * 标准版用酷狗音乐官方图标，概念版用概念版（K 字渐变）图标。
 * 统一从这里取，避免各处散落硬编码路径。
 */
export const PLATFORM_ICONS = {
  std: '/assets/brand/kugou.png',
  lite: '/assets/brand/concept.webp',
};

export const PLATFORM_NAMES = {
  std: '酷狗音乐',
  lite: '酷狗音乐概念版',
};

export function platformIcon(platform) {
  return PLATFORM_ICONS[platform] || PLATFORM_ICONS.std;
}

export function platformName(platform) {
  return PLATFORM_NAMES[platform] || PLATFORM_NAMES.std;
}
