/**
 * 启动问候语
 *
 * 每次启动从下面几条里随机挑一条，播放对应语音 + 弹出一个轻量气泡。
 * 语音文件放在 public/assets/sound/，走应用自带的静态资源目录。
 */
export const GREETINGS = [
  {
    id: 'qiqi-zh',
    name: '琪琪',
    lang: '中文',
    file: '/assets/sound/qiqi-zh.mp3',
    text: '欢迎回来～今天想听点什么呀？',
  },
  {
    id: 'qiqi-jp',
    name: '琪琪',
    lang: '日本語',
    file: '/assets/sound/qiqi-jp.mp3',
    text: 'おかえりなさい！一緒に音楽を聴こう～',
  },
  {
    id: 'yise-jp',
    name: '伊瑟',
    lang: '日本語',
    file: '/assets/sound/yise-jp.mp3',
    text: 'また会えたね。今日もいい一日にしよう！',
  },
];

/** 随机挑一条（尽量不和上一条重复） */
export function pickGreeting(lastId = '') {
  const pool = GREETINGS.length > 1 ? GREETINGS.filter((g) => g.id !== lastId) : GREETINGS;
  return pool[Math.floor(Math.random() * pool.length)] || GREETINGS[0];
}

let current = null;

/** 播放问候语音；返回 Audio 元素，方便调用方停止 */
export function playGreeting(item, volume = 0.55) {
  stopGreeting();
  if (!item?.file) return null;
  try {
    const audio = new Audio(item.file);
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.play().catch(() => {});
    current = audio;
    audio.addEventListener('ended', () => {
      if (current === audio) current = null;
    });
    return audio;
  } catch {
    return null;
  }
}

export function stopGreeting() {
  if (!current) return;
  try {
    current.pause();
    current.currentTime = 0;
  } catch {}
  current = null;
}

/** 记住上一条，避免连续两次都是同一句 */
const LAST_KEY = 'kg-last-greeting';
export function readLastGreeting() {
  try {
    return localStorage.getItem(LAST_KEY) || '';
  } catch {
    return '';
  }
}
export function saveLastGreeting(id) {
  try {
    localStorage.setItem(LAST_KEY, id || '');
  } catch {}
}
