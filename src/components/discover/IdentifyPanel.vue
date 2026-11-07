<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { audioMatch, searchSongs } from '@/api';
import { normalizeSong } from '@/api/normalize';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useSongActions } from '@/composables/useSongActions';

const { play } = useSongActions();

/** 酷狗指纹接口要求：8kHz 单声道 16bit PCM（见 KuGouMusicApi 官方示例） */
const TARGET_RATE = 8000;
const MAX_SECONDS = 12;
const MIN_SECONDS = 4;
const BARS = 24;
const DEVICE_KEY = 'mm-identify-device';
const SOURCE_KEY = 'mm-identify-source';

const source = ref(localStorage.getItem(SOURCE_KEY) === 'system' ? 'system' : 'mic');
const status = ref('idle'); // idle | recording | matching | done | error
const seconds = ref(0);
const results = ref([]);
const errorMsg = ref('');
const tip = ref('');
const devices = ref([]);
const deviceId = ref(localStorage.getItem(DEVICE_KEY) || '');
const levels = ref(Array.from({ length: BARS }, () => 0.05));

let stream = null;
let recorder = null;
let chunks = [];
let timer = null;
let meterCtx = null;
let raf = null;
let startedAt = 0;
let peak = 0;
let silentWarned = false;

const busy = computed(() => status.value === 'recording' || status.value === 'matching');

const label = computed(() => {
  if (status.value === 'recording') return `正在聆听 ${seconds.value}s`;
  if (status.value === 'matching') return '正在识别…';
  if (status.value === 'done') return `识别完成 · ${results.value.length} 个结果`;
  return '点击开始识别';
});

const subHint = computed(() => {
  if (source.value === 'system') return '录下电脑正在播放的声音，比外放给麦克风更准';
  return '外放音乐或直接哼唱 8~12 秒，越完整越准';
});

/* ------------------------------ 设备管理 ------------------------------ */

function labelOf(d, i) {
  return d.label || `麦克风 ${i + 1}`;
}

async function refreshDevices(interactive = false) {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    const inputs = list
      .filter((d) => d.kind === 'audioinput' && d.deviceId)
      .filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications');
    devices.value = inputs;
    if (deviceId.value && !inputs.some((d) => d.deviceId === deviceId.value)) {
      deviceId.value = '';
      localStorage.removeItem(DEVICE_KEY);
    }
    if (interactive && !inputs.length) ElMessage.warning('没有找到可用的麦克风设备');
  } catch {
    /* 枚举失败不影响录音，走系统默认 */
  }
}

function onDeviceChange() {
  if (deviceId.value) localStorage.setItem(DEVICE_KEY, deviceId.value);
  else localStorage.removeItem(DEVICE_KEY);
}

function switchSource(next) {
  if (busy.value || source.value === next) return;
  source.value = next;
  localStorage.setItem(SOURCE_KEY, next);
  errorMsg.value = '';
  results.value = [];
  status.value = 'idle';
}

/* ------------------------------ 录音链路 ------------------------------ */

function pickMime() {
  const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const mr = window.MediaRecorder;
  if (!mr?.isTypeSupported) return undefined;
  for (const m of list) {
    if (mr.isTypeSupported(m)) return { mimeType: m };
  }
  return undefined;
}

async function acquireStream() {
  if (source.value === 'system') {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('当前版本不支持系统内录，请改用麦克风');
    const display = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
    const audioTracks = display.getAudioTracks();
    display.getVideoTracks().forEach((t) => t.stop());
    if (!audioTracks.length) {
      display.getTracks().forEach((t) => t.stop());
      throw new Error('没有拿到系统声音，请确认系统弹窗里勾选了「分享系统音频」');
    }
    return new MediaStream(audioTracks);
  }
  // 识曲要保留音乐本身的动态，回声消除/降噪/自动增益都会劣化指纹
  const audio = {
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: deviceId.value ? { ...audio, deviceId: { exact: deviceId.value } } : audio,
      video: false,
    });
  } catch (e) {
    // 选中的设备被拔掉时会 OverconstrainedError，清掉选择再走默认设备
    if (deviceId.value) {
      deviceId.value = '';
      localStorage.removeItem(DEVICE_KEY);
      return navigator.mediaDevices.getUserMedia({ audio, video: false });
    }
    throw e;
  }
}

function mediaError(e) {
  const name = e?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '没有录制权限，请在系统设置里允许「萌萌音乐」使用麦克风';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '没有找到可用的麦克风，换一个输入设备再试';
  if (name === 'NotReadableError') return '麦克风被其他程序占用了，关掉占用它的软件再试';
  return e?.message || '无法打开录音设备';
}

async function start() {
  if (status.value === 'recording') return stop();
  if (busy.value) return;
  results.value = [];
  errorMsg.value = '';
  tip.value = '正在打开录音设备…';
  status.value = 'idle';

  let s;
  try {
    s = await acquireStream();
  } catch (e) {
    tip.value = '';
    errorMsg.value = mediaError(e);
    return;
  }
  stream = s;
  if (source.value === 'mic') refreshDevices();

  chunks = [];
  try {
    recorder = new MediaRecorder(stream, pickMime());
  } catch {
    recorder = new MediaRecorder(stream);
  }
  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  try {
    recorder.start(400);
  } catch (e) {
    cleanupMedia();
    errorMsg.value = e?.message || '录音启动失败';
    return;
  }

  startMeter(stream);
  status.value = 'recording';
  seconds.value = 0;
  peak = 0;
  silentWarned = false;
  startedAt = Date.now();
  tip.value = source.value === 'system' ? '正在录制电脑播放的声音' : '对准音源，尽量保持环境安静';
  timer = setInterval(() => {
    seconds.value = Math.min(MAX_SECONDS, Math.round((Date.now() - startedAt) / 1000));
    if (!silentWarned && seconds.value >= 3 && peak < 0.012) {
      silentWarned = true;
      tip.value = source.value === 'system' ? '没有检测到系统声音，先播放一段音乐再试' : '没听到声音：检查输入设备、音量和系统麦克风权限';
    }
    if (seconds.value >= MAX_SECONDS) stop();
  }, 200);
}

function cleanupMedia() {
  clearInterval(timer);
  timer = null;
  if (raf) {
    cancelAnimationFrame(raf);
    raf = null;
  }
  try {
    meterCtx?.close();
  } catch {
    /* ignore */
  }
  meterCtx = null;
  try {
    stream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  stream = null;
  recorder = null;
  levels.value = Array.from({ length: BARS }, () => 0.05);
}

async function stop() {
  if (!recorder || status.value !== 'recording') return;
  const elapsed = (Date.now() - startedAt) / 1000;
  const blob = await new Promise((resolve) => {
    const done = () => resolve(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
    recorder.onstop = done;
    try {
      recorder.stop();
    } catch {
      done();
    }
  });
  cleanupMedia();

  if (elapsed < 2.5 || !blob.size) {
    status.value = 'idle';
    errorMsg.value = `录音太短了，至少录 ${MIN_SECONDS} 秒左右再停`;
    return;
  }
  status.value = 'matching';
  tip.value = '';
  await match(blob);
}

/** 重采样成 8k 单声道 16bit PCM，跟官方 audio_match 示例保持一致 */
async function toPcm(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const decodeCtx = new AudioContext();
  let decoded;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    decodeCtx.close();
  }
  if (!decoded?.length) throw new Error('这段录音解析不出来，换一种录制方式再试');
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);
  const pcm = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return pcm.buffer;
}

/* ------------------------------ 结果处理 ------------------------------ */

function extractList(res) {
  if (!res) return [];
  const d = res.data ?? res;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.lists)) return d.lists;
  if (Array.isArray(d?.list)) return d.list;
  if (Array.isArray(d?.songs)) return d.songs;
  if (Array.isArray(d?.result)) return d.result;
  return [];
}

function messageOf(res) {
  if (!res || typeof res !== 'object') return '';
  return res.error || res.msg || res.message || res.errmsg || res.data?.msg || res.data?.error || '';
}

function confidenceOf(item) {
  const v = Number(item?.dist ?? item?.score ?? 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v <= 1 ? v * 100 : v);
}

function mapItem(item = {}) {
  const album = Array.isArray(item.album) ? item.album[0] || {} : item.album || {};
  const ms = Number(item.timelength_128 || item.timelength || item.duration || 0);
  return {
    ...item,
    hash: item.hash || item.FileHash || item.file_hash || '',
    mixsongid: item.album_audio_id || item.audio_id || item.mixsongid || item.MixSongID || 0,
    album_id: item.album_id || album.album_id || 0,
    album_name: item.album_name || album.albumname || '',
    // 指纹接口返回的是毫秒时长
    timelength: ms > 1000 ? Math.round(ms / 1000) : Math.round(ms),
    cover: item.union_cover || item.cover || item.Image || '',
    singername: item.singername || item.singer || '',
    songname: item.songname || item.name || '',
  };
}

/** 指纹结果偶尔不带 hash，退回搜索补一条可播放的 */
async function searchFallback(item) {
  const kw = `${item.songname || ''} ${item.singername || ''}`.trim();
  if (!kw) return null;
  try {
    const res = await searchSongs(kw, 1, 5);
    return (res?.songs || []).find((s) => s?.hash) || null;
  } catch {
    return null;
  }
}

async function buildSongs(list) {
  const out = [];
  const seen = new Set();
  for (const item of list.slice(0, 4)) {
    const confidence = confidenceOf(item);
    let song = normalizeSong(mapItem(item));
    if (!song?.hash) song = await searchFallback(item);
    if (!song?.hash) continue;
    const key = song.hash || song.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...song, confidence });
  }
  return out;
}

async function match(blob) {
  try {
    const pcm = await toPcm(blob);
    const res = await audioMatch(pcm);
    const list = extractList(res);
    if (!list.length) {
      status.value = 'error';
      errorMsg.value = messageOf(res) || '没识别出来：把外放音量调大些，或者改用「系统声音」再试';
      return;
    }
    const songs = await buildSongs(list);
    results.value = songs;
    if (!songs.length) {
      status.value = 'error';
      errorMsg.value = '识别到了结果，但拿不到可播放的歌曲信息，请重试';
      return;
    }
    status.value = 'done';
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e?.message || '识别失败，请重试';
  }
}

/* ------------------------------ 实时电平 ------------------------------ */

function startMeter(s) {
  try {
    meterCtx = new AudioContext();
    const srcNode = meterCtx.createMediaStreamSource(s);
    const analyser = meterCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.55;
    srcNode.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const step = Math.floor(buf.length / BARS) || 1;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      const next = [];
      let top = 0;
      for (let b = 0; b < BARS; b++) {
        let sum = 0;
        const from = b * step;
        for (let i = from; i < from + step && i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / step);
        if (rms > top) top = rms;
        next.push(Math.min(1, rms * 4.4));
      }
      peak = Math.max(peak * 0.9, top);
      levels.value = next;
      raf = requestAnimationFrame(tick);
    };
    tick();
  } catch {
    /* 拿不到电平不影响录音 */
  }
}

onMounted(() => {
  refreshDevices();
  try {
    navigator.mediaDevices?.addEventListener('devicechange', () => refreshDevices());
  } catch {
    /* ignore */
  }
});

onBeforeUnmount(cleanupMedia);
</script>

<template>
  <div class="identify">
    <div class="panel">
      <div class="p-head">
        <div class="seg">
          <button type="button" class="seg-btn" :class="{ on: source === 'mic' }" :disabled="busy" @click="switchSource('mic')">
            <Icon name="mic" :size="13" />麦克风
          </button>
          <button type="button" class="seg-btn" :class="{ on: source === 'system' }" :disabled="busy" @click="switchSource('system')">
            <Icon name="volume" :size="13" />系统声音
          </button>
        </div>
        <button v-if="source === 'mic'" type="button" class="mini" :disabled="busy" @click="refreshDevices(true)">
          <Icon name="refresh" :size="12" />刷新
        </button>
      </div>

      <div v-if="source === 'mic'" class="dev">
        <Icon name="mic" :size="13" class="dev-ico" />
        <select v-model="deviceId" class="dev-sel" :disabled="busy" @change="onDeviceChange">
          <option value="">系统默认输入设备</option>
          <option v-for="(d, i) in devices" :key="d.deviceId" :value="d.deviceId">{{ labelOf(d, i) }}</option>
        </select>
        <Icon name="chevron-down" :size="12" class="dev-caret" />
      </div>

      <div class="ring" :class="status" @click="start">
        <span v-if="status === 'recording'" class="pulse" />
        <span v-if="status === 'matching'" class="spin" />
        <Icon v-else :name="status === 'recording' ? 'pause' : 'mic'" :size="32" color="#fff" />
      </div>

      <div class="status-text">{{ label }}</div>
      <div class="hint">{{ subHint }}</div>

      <div class="wave" :class="{ on: status === 'recording' }">
        <i v-for="(v, n) in levels" :key="n" :style="{ height: `${Math.max(4, Math.round(v * 30))}px` }" />
      </div>

      <div v-if="tip" class="tip">{{ tip }}</div>
      <div v-else-if="status === 'done'" class="tip ok">点下面的结果直接播放</div>
    </div>

    <div v-if="results.length" class="results">
      <div class="res-head">
        <span class="res-title">匹配结果</span>
        <button type="button" class="mini" @click="results = []; status = 'idle'">再识别一次</button>
      </div>
      <div v-for="(s, i) in results" :key="s.id || i" class="res-item" @click="play(s, results)">
        <CoverImage :src="s.cover" :size="52" :radius="7" />
        <div class="res-meta">
          <div class="res-name ellipsis">{{ s.name }}</div>
          <div class="res-singer ellipsis">{{ s.singer }}<span v-if="s.album"> · {{ s.album }}</span></div>
        </div>
        <span v-if="s.confidence" class="res-conf">{{ s.confidence }}%</span>
        <button class="res-play"><Icon name="play" :size="14" color="#fff" filled /></button>
      </div>
    </div>

    <div v-if="errorMsg" class="err">{{ errorMsg }}</div>
  </div>
</template>

<style scoped>
.identify {
  max-width: 560px;
}
.panel {
  padding: 16px 18px 22px;
  border-radius: 14px;
  background: var(--kg-panel);
  border: 1px solid var(--kg-line);
  text-align: center;
}

/* 顶部：输入源切换 + 刷新 */
.p-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--kg-bg);
  border: 1px solid var(--kg-line);
  gap: 2px;
}
.seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--kg-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: 0.15s;
}
.seg-btn:hover:not(:disabled) {
  color: var(--kg-text);
}
.seg-btn.on {
  background: var(--kg-accent);
  color: #fff;
  box-shadow: 0 3px 10px rgba(var(--kg-accent-rgb), 0.28);
}
.seg-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
.mini {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--kg-line);
  border-radius: 999px;
  background: var(--kg-bg);
  color: var(--kg-text-3);
  font-size: 11.5px;
  cursor: pointer;
}
.mini:hover:not(:disabled) {
  color: var(--kg-accent);
  border-color: var(--kg-accent);
}
.mini:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 设备下拉 */
.dev {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0 0;
  height: 32px;
  padding: 0 26px 0 10px;
  border-radius: 9px;
  border: 1px solid var(--kg-line);
  background: var(--kg-bg);
}
.dev-ico {
  flex: none;
  color: var(--kg-text-3);
}
.dev-sel {
  appearance: none;
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--kg-text);
  font-size: 12px;
  cursor: pointer;
  outline: none;
}
.dev-sel option {
  background: var(--kg-card);
  color: var(--kg-text);
}
.dev-sel:disabled {
  cursor: not-allowed;
  color: var(--kg-text-3);
}
.dev-caret {
  position: absolute;
  right: 9px;
  pointer-events: none;
  color: var(--kg-text-3);
}

/* 录制按钮 */
.ring {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  margin: 18px auto 12px;
  background: linear-gradient(135deg, var(--kg-accent), var(--kg-accent-dark));
  display: grid;
  place-items: center;
  cursor: pointer;
  position: relative;
  box-shadow: 0 10px 26px rgba(var(--kg-accent-rgb), 0.28);
  transition: transform 0.15s ease;
}
.ring:hover {
  transform: scale(1.03);
}
.ring.recording {
  background: linear-gradient(135deg, #ff8a65, #ef5350);
  box-shadow: 0 10px 26px rgba(239, 83, 80, 0.3);
}
.ring.matching {
  cursor: progress;
  opacity: 0.92;
}
.pulse {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  border: 2px solid rgba(239, 83, 80, 0.4);
  animation: pulse 1.6s ease-out infinite;
}
@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 1;
  }
  100% {
    transform: scale(1.25);
    opacity: 0;
  }
}
.spin {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2.5px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--kg-text);
}
.hint {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 6px;
}
.tip {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 10px;
}
.tip.ok {
  color: var(--kg-accent);
}

.wave {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  height: 32px;
  margin-top: 12px;
}
.wave i {
  width: 3px;
  border-radius: 2px;
  background: var(--kg-line);
  transition: height 0.08s linear;
}
.wave.on i {
  background: var(--kg-accent);
}

/* 结果 */
.results {
  margin-top: 18px;
}
.res-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.res-title {
  font-size: 12px;
  color: var(--kg-text-2);
}
.res-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 9px;
  cursor: pointer;
}
.res-item:hover {
  background: var(--kg-panel);
}
.res-meta {
  flex: 1;
  min-width: 0;
}
.res-name {
  font-size: 13px;
  color: var(--kg-text);
}
.res-singer {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 4px;
}
.res-conf {
  font-size: 11px;
  color: var(--kg-accent);
  background: rgba(var(--kg-accent-rgb), 0.1);
  border-radius: 999px;
  padding: 2px 8px;
}
.res-play {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--kg-accent);
  display: grid;
  place-items: center;
  border: 0;
  cursor: pointer;
}
.err {
  margin-top: 14px;
  font-size: 12px;
  color: #d9534f;
  line-height: 1.7;
}
</style>
