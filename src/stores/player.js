import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { lyric as fetchLyric, mvOfSong, searchSongs, songClimax, songUrl, songUrlAuth, songUrlNew, userCloudUrl, userVerify } from '@/api';
import { useAppStore } from './app';
import { useLibraryStore } from './library';
import { useUserStore } from './user';
import { ensureDfid } from '@/utils/device';
import { IS_MAIN_WINDOW } from '@/utils/windowRole';

const QUALITY_ORDER = ['128', '320', 'flac', 'high'];
const QUALITY_LABEL = { '128': '标准', '320': '高品', flac: '无损', high: 'Hi-Res' };

/** KRC / LRC 歌词解析 */
export function parseLyric(text) {
  if (!text) return { lines: [], translations: new Map() };
  const raw = [];

  for (const line of String(text).split(/\r?\n/)) {
    const s = line.replace(/^\uFEFF/, '').trim();
    if (!s) continue;
    // 跳过元信息行（[ti:]、[language:] 等）
    if (/^\[(ti|ar|al|by|offset|id|hash|total|sign|krc|ver|encoding|qq|au|language):/i.test(s)) continue;

    let time = -1;
    let content = '';
    // KRC: [起始毫秒,持续毫秒]字<偏移,时长,0>...
    const krc = /^\[(\d+),(\d+)\]/.exec(s);
    if (krc) {
      time = Number(krc[1]) / 1000;
      content = s.slice(krc[0].length);
    } else {
      // LRC: [mm:ss.xxx]
      const lrc = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/.exec(s);
      if (!lrc) continue;
      time = Number(lrc[1]) * 60 + Number(lrc[2]) + (lrc[3] ? Number(`0.${lrc[3]}`) : 0);
      content = s.slice(lrc[0].length);
    }

    content = content.replace(/<\d+,\d+,\d+>/g, '').trim();
    if (content) raw.push({ time, text: content });
  }

  // KRC 的翻译行紧跟在正文之后，时间戳与正文相同：
  // 同一时间戳出现第二次即视为该行翻译
  const map = new Map();
  const order = [];
  for (const item of raw) {
    const key = item.time.toFixed(2);
    const exist = map.get(key);
    if (!exist) {
      map.set(key, { time: item.time, text: item.text, tr: '' });
      order.push(key);
    } else if (!exist.tr && exist.text !== item.text) {
      exist.tr = item.text;
    }
  }

  const lines = order.map((k) => map.get(k)).sort((a, b) => a.time - b.time);
  const translations = new Map(lines.map((l) => [l.time.toFixed(2), l.tr]));
  return { lines, translations };
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 播放器
 */
export const usePlayerStore = defineStore('player', () => {
  const app = useAppStore();
  const user = useUserStore();

  // 只有主窗口能持有音频实例：桌面歌词 / 托盘 / 任务栏歌词这些辅助窗口
  // 一旦也创建 Audio 并恢复续播，就会出现「声音从后台出来、关掉主窗口还在唱」
  const audio = IS_MAIN_WINDOW && typeof Audio !== 'undefined' ? new Audio() : null;
  if (audio) {
    audio.preload = 'auto';
    audio.volume = app.settings.volume ?? 0.7;
    // 便于排查播放问题（桌面端调试用）
    if (typeof window !== 'undefined') window.__kgAudio = audio;
  }

  const queue = ref([]);
  /** 当前队列来源名（每日推荐 / 某张歌单 / 某个榜单），队列面板里展示，方便追溯在播什么 */
  const queueName = ref('');
  const index = ref(-1);
  const current = ref(null);
  const playing = ref(false);
  const loading = ref(false);
  const duration = ref(0);
  const progress = ref(0);
  const buffered = ref(0);
  const volume = ref(app.settings.volume ?? 0.7);
  const muted = ref(false);
  const mode = ref(app.settings.playMode || 'order');
  const quality = ref(app.settings.quality || '320');
  const rate = ref(app.settings.playbackRate || 1);
  const activeQuality = ref('');
  const lyricLines = ref([]);
  const lyricIndex = ref(0);
  /** 高潮（副歌）区间 { start, end }，单位秒 */
  const climax = ref(null);
  const lyricLoading = ref(false);
  const error = ref('');
  const trial = ref(false);
  const history = ref([]);

  const playModeLabel = computed(() => ({ order: '列表循环', single: '单曲循环', shuffle: '随机播放' }[mode.value]));
  const qualityLabel = computed(() => QUALITY_LABEL[activeQuality.value || quality.value] || '标准');
  const progressText = computed(() => formatTime(progress.value));
  const durationText = computed(() => formatTime(duration.value || current.value?.duration || 0));
  const hasPrev = computed(() => mode.value === 'shuffle' || index.value > 0);
  const hasNext = computed(() => queue.value.length > 1);

  let seeking = false;
  let currentLyricTr = false;

  if (audio) {
    const applyDuration = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) duration.value = d;
    };
    audio.addEventListener('timeupdate', () => {
      if (seeking) return;
      progress.value = audio.currentTime;
      syncLyric(audio.currentTime);
      // 每 8 秒记一次进度，重启后能续上
      if (Date.now() - lastResumeSave > 8000) {
        lastResumeSave = Date.now();
        saveResume();
      }
    });
    audio.addEventListener('durationchange', applyDuration);
    audio.addEventListener('loadedmetadata', applyDuration);
    audio.addEventListener('canplay', applyDuration);
    audio.addEventListener('progress', () => {
      try {
        if (audio.buffered.length) buffered.value = audio.buffered.end(audio.buffered.length - 1);
      } catch {}
    });
    audio.addEventListener('play', () => {
      playing.value = true;
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    });
    audio.addEventListener('pause', () => {
      playing.value = false;
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });
    audio.addEventListener('ended', () => onEnded());
    audio.addEventListener('error', () => {
      const src = audio.currentSrc || audio.src;
      if (!src || !current.value) return;
      error.value = '音频加载失败';
      playing.value = false;
      if (!loading.value) scheduleAutoSkip(current.value, '音频加载失败');
    });
  }

  function syncLyric(t) {
    const lines = lyricLines.value;
    if (!lines.length) return;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= t + 0.12) idx = i;
      else break;
    }
    if (idx >= 0 && idx !== lyricIndex.value) lyricIndex.value = idx;
  }

  /** 记录播放历史 */
  function recordHistory(song) {
    if (!song) return;
    history.value = [song, ...history.value.filter((s) => s.hash !== song.hash)].slice(0, 100);
    const lib = useLibraryStore();
    lib.pushRecent(song);
  }

  async function loadClimax(song) {
    climax.value = null;
    if (!song?.hash) return;
    let res = await songClimax(song.hash, app.platform).catch(() => null);
    // 概念版接口偶尔没有高潮数据，回退到标准版再取一次
    if (!res && app.platform !== 'std') res = await songClimax(song.hash, 'std').catch(() => null);
    if (!res) return;
    // 只校验区间合法性，时长字段有时是 0/不准确，不做硬性上限判断
    if (res.end > res.start && (!song.duration || res.start < song.duration)) {
      climax.value = { start: res.start, end: Math.min(res.end, song.duration || res.end) };
    }
  }

  /** 当前歌曲 MV 可用性（用于底部播放条显示「看 MV」按钮） */
  const mvInfo = ref({ hash: '', ready: false, has: false, count: 0 });
  let mvToken = 0;

  async function loadMvInfo(song) {
    const token = ++mvToken;
    if (!song?.hash) {
      mvInfo.value = { hash: '', ready: false, has: false, count: 0 };
      return;
    }
    if (song.mvHash || song.videoId) {
      mvInfo.value = { hash: song.hash, ready: true, has: true, count: 1, videoId: song.videoId || '' };
      return;
    }
    mvInfo.value = { hash: song.hash, ready: false, has: false, count: 0 };
    if (!song.albumAudioId) {
      mvInfo.value = { hash: song.hash, ready: true, has: false, count: 0 };
      return;
    }
    try {
      const list = await mvOfSong(song.albumAudioId, app.platform);
      if (token !== mvToken) return;
      mvInfo.value = { hash: song.hash, ready: true, has: Boolean(list?.length), count: list?.length || 0 };
    } catch {
      if (token === mvToken) mvInfo.value = { hash: song.hash, ready: true, has: false, count: 0 };
    }
  }

  /** 当前歌曲是否有 MV（搜索到的歌曲 mvHash 经常为空，这里统一按 albumAudioId 探测） */
  const hasMv = computed(() => {
    if (!current.value) return false;
    if (mvInfo.value.hash === current.value.hash) return mvInfo.value.has;
    return Boolean(current.value.mvHash || current.value.videoId || current.value.hasMv);
  });

  async function loadLyric(song) {
    lyricLines.value = [];
    lyricIndex.value = 0;
    if (!song?.hash) return;
    lyricLoading.value = true;
    try {
      loadClimax(song);
      const res = await fetchLyric(song);
      const parsed = parseLyric(res.lyric || res.krc || '');
      lyricLines.value = parsed.lines;
      currentLyricTr = parsed.lines.some((l) => l.tr);
    } catch {
      lyricLines.value = [];
    } finally {
      lyricLoading.value = false;
    }
  }

  /** 按音质从高到低尝试取流，失败时抛出带原因的错误 */
  async function pickStream(song) {
    const prefer = quality.value;
    const order = [prefer, ...QUALITY_ORDER.filter((q) => q !== prefer)];
    let lastError = '该歌曲暂无可用音源（可能为 VIP 专享）';
    let dfidRetried = false;
    trial.value = false;

    for (const q of order) {
      let res = {};
      try {
        res = await songUrl(song, q, true, false);
      } catch (e) {
        lastError = e.message || lastError;
        continue;
      }
      if (res.url) {
        activeQuality.value = q;
        return res.url;
      }
      lastError = res.error || lastError;

      // VIP 曲目：普通 /song/url 拿不到，再走一次网关 priv_url（带 vip_token）
      if (q === prefer) {
        try {
          const vipRes = await songUrlNew(song, q, app.platform, false);
          if (vipRes.url) {
            activeQuality.value = q;
            return vipRes.url;
          }
        } catch {
          /* 该接口未登录时会返回 20028，忽略继续走后面的兜底 */
        }
      }

      // 触发风控（20028）：先换一个新的设备号重试一次，还不行再走 auth 验证
      if (res.errcode === 20028 || /需要验证/.test(res.error || '')) {
        if (!dfidRetried) {
          dfidRetried = true;
          await ensureDfid(app.platform, true).catch(() => '');
          const again = await songUrl(song, q, true, false).catch(() => ({}));
          if (again.url) {
            activeQuality.value = q;
            return again.url;
          }
          res = again;
        }
        try {
          const auth = await userVerify(app.platform);
          if (auth) {
            const r = await songUrlAuth(song, q);
            if (r.url) {
              activeQuality.value = q;
              return r.url;
            }
          }
        } catch {}
        throw new Error('该歌曲被版权风控拦截，换设备号重试仍未通过');
      }

      // 该音质无版权/需付费，尝试试听片段（部分歌曲返回 60s）
      if (res.needBuy && q === prefer) {
        for (const tq of ['320', '128']) {
          const trialRes = await songUrl(song, tq, true, true).catch(() => ({}));
          if (trialRes.url) {
            activeQuality.value = tq;
            trial.value = true;
            ElMessage({
              message: `${song.name}：VIP 专享，正在为你试听 60 秒`,
              type: 'info',
              grouping: true,
              duration: 3200,
            });
            return trialRes.url;
          }
        }
      }
    }
    throw new Error(lastError);
  }

  /**
   * 用歌名 + 歌手重新搜一次，拿另一条可播放的 hash。
   * 歌单里经常存着早就失效/被下架的 hash，直接播放会「无法播放」，
   * 这里用同名歌曲的新 hash 兜底，能救回大部分「罗生门」这类情况。
   */
  async function searchAltSong(song) {
    const base = String(song?.name || '')
      .replace(/[（(【\[].*?[)）】\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!base) return null;
    const singer = String(song.singer || '').split(/[、,&/]/)[0].trim();
    try {
      const res = await searchSongs([base, singer].filter(Boolean).join(' '), 1, 10);
      const cand = (res.songs || []).find((s) => s.hash && s.hash !== song.hash);
      if (!cand) return null;
      return {
        ...song,
        hash: cand.hash,
        albumAudioId: cand.albumAudioId || song.albumAudioId,
        albumId: cand.albumId || song.albumId,
        cover: cand.cover || song.cover,
        __alt: true,
      };
    } catch {
      return null;
    }
  }

  /** 解析可播放地址，带多级兜底 */
  async function resolveUrl(song) {
    if (!song) throw new Error('无歌曲');
    if (song.localPath) {
      const url = window.kg ? await window.kg.localUrl(song.localPath) : '';
      if (!url) throw new Error('本地文件不可用');
      return url;
    }
    if (song.isCloud) {
      const r = await userCloudUrl(song, app.platform);
      if (r.url) return r.url;
      throw new Error(r.error || '云盘文件地址获取失败');
    }

    try {
      return await pickStream(song);
    } catch (e) {
      // 换一条同名歌曲的 hash 再试一次（歌单里的旧 hash 经常已经取不到流）
      const alt = await searchAltSong(song);
      if (alt) {
        try {
          const url = await pickStream(alt);
          if (current.value && current.value.hash === song.hash) current.value.__altHash = alt.hash;
          return url;
        } catch {}
      }
      throw e;
    }
  }

  /** 无法播放时的自动跳过：3 秒后切下一首 */
  const AUTO_SKIP_DELAY = 3000;
  let skipTimer = null;
  /** 连续失败计数：连续 5 首都播不了就停下来，避免无限跳歌 */
  let failStreak = 0;

  function clearAutoSkip() {
    if (skipTimer) {
      clearTimeout(skipTimer);
      skipTimer = null;
    }
  }

  /** 顺序切下一首（不理会单曲循环，避免卡在同一首死循环） */
  function skipToNext() {
    if (queue.value.length < 2) {
      playing.value = false;
      return;
    }
    let i = index.value + 1;
    if (i >= queue.value.length) i = 0;
    if (i === index.value) return;
    playQueueItem(i);
  }

  function scheduleAutoSkip(song, reason) {
    if (!song || queue.value.length < 2) return;
    clearAutoSkip();
    failStreak += 1;
    if (failStreak > 5) {
      failStreak = 0;
      ElMessage({ message: '连续多首歌曲无法播放，已停止自动跳过', type: 'error', grouping: true, duration: 3600 });
      return;
    }
    ElMessage({
      message: `${song.name}：${reason || '无法播放'}，3 秒后自动跳过`,
      type: 'warning',
      grouping: true,
      duration: AUTO_SKIP_DELAY,
    });
    skipTimer = setTimeout(() => {
      skipTimer = null;
      skipToNext();
    }, AUTO_SKIP_DELAY);
  }

  async function loadAndPlay(song, autoplay = true, resumeAt = 0) {
    if (!audio) return;
    clearAutoSkip();
    loading.value = true;
    error.value = '';
    progress.value = 0;
    buffered.value = 0;
    duration.value = song.duration || 0;
    try {
      const url = await resolveUrl(song);
      audio.src = url;
      audio.playbackRate = rate.value;
      audio.load();
      // 续播：拿到元数据后跳到上次的进度
      if (resumeAt > 0) {
        const seekOnce = () => {
          try {
            const max = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 1) : resumeAt;
            audio.currentTime = Math.min(resumeAt, max);
            progress.value = audio.currentTime;
          } catch {}
          audio.removeEventListener('loadedmetadata', seekOnce);
        };
        audio.addEventListener('loadedmetadata', seekOnce);
      }
      if (autoplay) {
        await audio.play().catch((e) => {
          if (e.name !== 'AbortError') {
            playing.value = false;
          }
        });
      }
      playing.value = !audio.paused;
      failStreak = 0;
      clearAutoSkip();
    } catch (e) {
      error.value = e.message;
      playing.value = false;
      // 播不了的曲子 3 秒后自动跳过，不再干巴巴停在这里
      scheduleAutoSkip(song, e.message);
    } finally {
      loading.value = false;
    }
  }

  /** 播放歌曲 */
  async function play(song, list = null, opts = {}) {
    // 辅助小窗没有音频实例，任何播放请求都直接忽略
    if (!audio) return;
    clearAutoSkip();
    if (Array.isArray(list) && list.length) {
      queue.value = list.map((s) => ({ ...s }));
      if (typeof opts.name === 'string') queueName.value = opts.name;
      const found = queue.value.findIndex((s) => s.hash === song.hash && s.albumAudioId === song.albumAudioId);
      // 传进来的队列里没有这首歌时，插到队首，而不是莫名其妙播第一首
      if (found >= 0) {
        index.value = found;
      } else {
        queue.value.unshift({ ...song });
        index.value = 0;
      }
      song = queue.value[index.value];
    } else if (!queue.value.length) {
      queue.value = [{ ...song }];
      index.value = 0;
    }

    const same = current.value && current.value.hash === song.hash && current.value.albumAudioId === song.albumAudioId;
    current.value = { ...song };
    if (!same || opts.force) {
      recordHistory(song);
      loadLyric(song);
      loadMvInfo(song);
      updateMediaSession(song);
      await loadAndPlay(current.value, opts.autoplay !== false, opts.resumeAt || 0);
    } else if (audio?.paused) {
      audio.play().catch(() => {});
    }
  }

  function playQueueItem(i) {
    if (i < 0 || i >= queue.value.length) return;
    clearAutoSkip();
    index.value = i;
    play(queue.value[i], null, { force: true });
  }

  function next(auto = false) {
    if (!queue.value.length) return;
    clearAutoSkip();
    if (mode.value === 'single' && auto) {
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    let i;
    if (mode.value === 'shuffle' && queue.value.length > 1) {
      do {
        i = Math.floor(Math.random() * queue.value.length);
      } while (i === index.value);
    } else {
      i = index.value + 1;
      if (i >= queue.value.length) i = 0;
    }
    playQueueItem(i);
  }

  function prev() {
    if (!queue.value.length) return;
    clearAutoSkip();
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let i = index.value - 1;
    if (i < 0) i = queue.value.length - 1;
    playQueueItem(i);
  }

  function onEnded() {
    next(true);
  }

  function toggle() {
    if (!current.value) return;
    if (!audio?.src) {
      loadAndPlay(current.value, true);
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function pause() {
    audio?.pause();
  }

  function seek(sec) {
    if (!audio) return;
    seeking = true;
    audio.currentTime = sec;
    progress.value = sec;
    setTimeout(() => (seeking = false), 260);
    syncLyric(sec);
  }

  function setVolume(v) {
    volume.value = Math.min(1, Math.max(0, v));
    if (audio) audio.volume = muted.value ? 0 : volume.value;
    app.settings.volume = volume.value;
  }

  function toggleMute() {
    muted.value = !muted.value;
    if (audio) audio.volume = muted.value ? 0 : volume.value;
  }

  function setMode(m = null) {
    if (m) {
      mode.value = m;
    } else {
      mode.value = mode.value === 'order' ? 'single' : mode.value === 'single' ? 'shuffle' : 'order';
    }
    app.settings.playMode = mode.value;
  }

  function setQuality(q) {
    quality.value = q;
    const song = current.value;
    app.settings.quality = q;
    if (song && !song.localPath && !song.isCloud) {
      const at = audio?.currentTime || 0;
      resolveUrl(song).then((url) => {
        if (!audio) return;
        audio.src = url;
        audio.currentTime = at;
        audio.playbackRate = rate.value;
        audio.play().catch(() => {});
      });
    }
  }

  /** 播放倍速 */
  function setRate(v) {
    rate.value = v;
    app.settings.playbackRate = v;
    if (audio) audio.playbackRate = v;
  }

  /** 插入到下一首 */
  function playNext(song) {
    if (!queue.value.length) return play(song, [song]);
    queue.value.splice(index.value + 1, 0, { ...song });
  }

  /** 添加到队列末尾 */
  function addToQueue(songs, silent = false) {
    const list = Array.isArray(songs) ? songs : [songs];
    const exists = new Set(queue.value.map((s) => `${s.hash}_${s.albumAudioId}`));
    const add = list.filter((s) => !exists.has(`${s.hash}_${s.albumAudioId}`)).map((s) => ({ ...s }));
    queue.value.push(...add);
    if (!silent) ElMessage({ message: `已添加 ${add.length} 首到播放列表`, type: 'success', grouping: true });
  }

  function playAll(list, startIndex = 0, name = '') {
    if (!list?.length) return;
    clearAutoSkip();
    queue.value = list.map((s) => ({ ...s }));
    queueName.value = name || '';
    index.value = startIndex;
    current.value = { ...queue.value[startIndex] };
    recordHistory(current.value);
    loadLyric(current.value);
    loadMvInfo(current.value);
    updateMediaSession(current.value);
    loadAndPlay(current.value, true);
  }

  function removeFromQueue(i) {
    if (i < 0 || i >= queue.value.length) return;
    queue.value.splice(i, 1);
    if (i < index.value) index.value -= 1;
    else if (i === index.value) {
      if (!queue.value.length) {
        current.value = null;
        audio?.pause();
      } else {
        index.value = Math.min(index.value, queue.value.length - 1);
        current.value = queue.value[index.value];
      }
    }
  }

  function clearQueue() {
    queue.value = [];
    queueName.value = '';
    index.value = -1;
    current.value = null;
    audio?.pause();
    if (audio) audio.src = '';
  }

  function updateMediaSession(song) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name,
        artist: song.singer,
        album: song.album,
        artwork: song.cover ? [{ src: song.cover, sizes: '240x240', type: 'image/jpeg' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => toggle());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
    } catch {}
  }

  watch(
    () => user.platformRef,
    () => {
      // 平台切换后清空队列，避免跨平台混播
      clearQueue();
    }
  );

  /* ---------------------- 重启续播 ---------------------- */
  const RESUME_KEY = 'kg-player-resume';
  let lastResumeSave = 0;

  /** 只存播放必需的字段，避免把接口原始对象塞爆 localStorage */
  const slim = (x) => ({
    hash: x.hash, name: x.name, singer: x.singer, singerIds: x.singerIds,
    album: x.album, albumId: x.albumId, albumAudioId: x.albumAudioId,
    duration: x.duration, cover: x.cover, payType: x.payType,
    privilege: x.privilege, isOriginal: x.isOriginal, mvHash: x.mvHash,
    videoId: x.videoId, qualities: x.qualities, localPath: x.localPath, isCloud: x.isCloud,
  });

  function saveResume() {
    if (!current.value?.hash) return;
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({
        song: slim(current.value),
        queue: queue.value.slice(-120).map(slim),
        index: index.value,
        progress: Math.floor(progress.value || 0),
        mode: mode.value, quality: quality.value, volume: volume.value,
        muted: muted.value, rate: rate.value,
      }));
    } catch {}
  }

  /** 启动时恢复上次播放的歌曲、队列与进度，并尝试继续播放 */
  async function restoreResume(opts = {}) {
    // 只有主窗口做续播，辅助窗口重复执行就会变成两路声音
    if (!audio) return;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null'); } catch { return; }
    if (!d?.song?.hash) return;
    if (typeof d.volume === 'number') { volume.value = d.volume; if (audio) audio.volume = d.volume; }
    if (d.muted) { muted.value = true; if (audio) audio.muted = true; }
    if (d.mode) mode.value = d.mode;
    if (d.quality) quality.value = d.quality;
    if (d.rate) rate.value = d.rate;
    const list = Array.isArray(d.queue) && d.queue.length ? d.queue : [d.song];
    const at = Math.max(0, Math.min(Number(d.progress) || 0, (d.song.duration || 99999) - 2));
    // 静默启动（开机自启/最小化）时只恢复队列与进度、不出声，
    // 否则窗口还在后台就已经开始唱歌，看着像「卡在后台」
    try { await play(d.song, list, { force: true, resumeAt: at, autoplay: opts.autoplay !== false }); } catch {}
  }

  watch(() => [current.value?.hash, index.value, mode.value, volume.value, quality.value], saveResume);
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', saveResume);
    // 页面卸载（退出/刷新）时立刻停声，别让音频进程继续在后台唱
    window.addEventListener('pagehide', () => {
      try {
        audio?.pause();
      } catch {}
    });
  }

  return {
    audio,
    queue,
    queueName,
    index,
    current,
    playing,
    loading,
    duration,
    progress,
    buffered,
    volume,
    muted,
    mode,
    quality,
    activeQuality,
    rate,
    lyricLines,
    climax,
    mvInfo,
    hasMv,
    lyricIndex,
    lyricLoading,
    error,
    trial,
    history,
    playModeLabel,
    qualityLabel,
    progressText,
    durationText,
    hasPrev,
    hasNext,
    play,
    playAll,
    playQueueItem,
    toggle,
    pause,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    setMode,
    setQuality,
    setRate,
    playNext,
    addToQueue,
    removeFromQueue,
    clearQueue,
    formatTime,
    loadLyric,
    loadMvInfo,
    restoreResume,
    saveResume,
  };
});
