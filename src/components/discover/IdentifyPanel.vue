<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { audioMatch } from '@/api';
import { normalizeSongs } from '@/api/normalize';
import Icon from '@/components/common/Icon.vue';
import CoverImage from '@/components/common/CoverImage.vue';
import { useSongActions } from '@/composables/useSongActions';

const { play } = useSongActions();
const status = ref('idle'); // idle | recording | matching | done | error
const seconds = ref(0);
const results = ref([]);
const errorMsg = ref('');
let stream = null;
let recorder = null;
let chunks = [];
let timer = null;

const label = computed(() => {
  if (status.value === 'recording') return `正在聆听 ${seconds.value}s`;
  if (status.value === 'matching') return '正在识别…';
  if (status.value === 'done') return '识别完成';
  return '点击开始识别';
});

async function start() {
  if (status.value === 'recording') return stop();
  results.value = [];
  errorMsg.value = '';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } });
  } catch (e) {
    ElMessage.error('无法访问麦克风，请检查系统权限');
    return;
  }
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start();
  status.value = 'recording';
  seconds.value = 0;
  timer = setInterval(() => {
    seconds.value += 1;
    if (seconds.value >= 10) stop();
  }, 1000);
}

function cleanup() {
  clearInterval(timer);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

async function stop() {
  if (!recorder || status.value !== 'recording') return;
  const blob = await new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' }));
    recorder.stop();
  });
  cleanup();
  status.value = 'matching';
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new AudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const pcm = await toPcm16k(audioBuffer);
    ctx.close();
    const res = await audioMatch(pcm);
    const list = res?.data?.lists || res?.data?.list || res?.data || [];
    const songs = normalizeSongs(Array.isArray(list) ? list : []);
    results.value = songs;
    status.value = songs.length ? 'done' : 'error';
    if (!songs.length) errorMsg.value = res?.error || '没有听出来，换个环境再试试';
  } catch (e) {
    status.value = 'error';
    errorMsg.value = e.message || '识别失败';
  }
}

/** 重采样到 16k 单声道 16bit PCM */
async function toPcm16k(buffer) {
  const targetRate = 16000;
  const frames = Math.ceil(buffer.duration * targetRate);
  const offline = new OfflineAudioContext(1, frames, targetRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);
  const pcm = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm.buffer;
}

onBeforeUnmount(cleanup);
</script>

<template>
  <div class="identify">
    <div class="panel">
      <div class="ring" :class="status" @click="start">
        <div class="pulse" v-if="status === 'recording'" />
        <Icon :name="status === 'recording' ? 'pause' : 'mic'" :size="34" color="#fff" />
      </div>
      <div class="status-text">{{ label }}</div>
      <div class="hint">哼唱或外放音乐 10 秒，我们会帮你找到它</div>
      <div class="wave" :class="{ on: status === 'recording' }">
        <i v-for="n in 24" :key="n" :style="{ animationDelay: `${n * 0.05}s` }" />
      </div>
    </div>

    <div v-if="results.length" class="results">
      <div class="res-title">为你找到 {{ results.length }} 首匹配结果</div>
      <div v-for="(s, i) in results" :key="i" class="res-item" @click="play(s, results)">
        <CoverImage :src="s.cover" :size="52" :radius="7" />
        <div class="res-meta">
          <div class="res-name ellipsis">{{ s.name }}</div>
          <div class="res-singer ellipsis">{{ s.singer }} · {{ s.album }}</div>
        </div>
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
  padding: 30px 24px;
  border-radius: 14px;
  background: linear-gradient(160deg, #f4fdf8, #f7f9fb);
  border: 1px solid var(--kg-line);
  text-align: center;
}
.ring {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  margin: 0 auto 16px;
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
.status-text {
  font-size: 15px;
  font-weight: 600;
}
.hint {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 6px;
}
.wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 30px;
  margin-top: 16px;
}
.wave i {
  width: 3px;
  height: 6px;
  border-radius: 2px;
  background: #cfe9db;
}
.wave.on i {
  background: #35d287;
  animation: w 0.8s ease-in-out infinite alternate;
}
@keyframes w {
  from {
    height: 5px;
  }
  to {
    height: 24px;
  }
}
.results {
  margin-top: 18px;
}
.res-title {
  font-size: 12px;
  color: var(--kg-text-2);
  margin-bottom: 8px;
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
}
.res-singer {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 4px;
}
.res-play {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--kg-accent);
  display: grid;
  place-items: center;
}
.err {
  margin-top: 14px;
  font-size: 12px;
  color: #d9534f;
}
</style>
