/**
 * 窗口角色判定
 *
 * 桌面歌词 / 托盘面板 / 任务栏歌词都是「只读小窗」：它们只负责渲染，
 * 播放状态由主窗口通过 IPC 同步过去，绝不能自己初始化播放器。
 *
 * 为什么不能用 route.name 判断：router 的首次导航是异步的（组件还是动态 import），
 * App.vue 的 onMounted 执行时 route.name 仍然是 undefined，小窗会被误判成主窗口，
 * 于是它也跑了一遍 restoreResume —— 结果就是「重启后音乐从后台响、切歌还在放、
 * 关掉主窗口它还在唱」。这里直接读 location.hash，同步且不可靠性为零。
 */

const AUX_ROUTES = ['desktop-lyric', 'tray', 'taskbar'];

/** 当前 hash 路由的第一段，例如 #/taskbar?a=1 -> taskbar */
export function hashRoute() {
  const raw = typeof location === 'undefined' ? '' : String(location.hash || '');
  return raw.replace(/^#\/?/, '').split('?')[0].split('/')[0] || '';
}

/** 是否处在辅助小窗里（不可出声） */
export function isAuxWindow() {
  return AUX_ROUTES.includes(hashRoute());
}

/** 是否主窗口：只有它为 true 时才允许创建音频实例 */
export const IS_MAIN_WINDOW = typeof location !== 'undefined' && !isAuxWindow();
