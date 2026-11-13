<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
const videoEl = ref(null);
const failed = ref(false);

const url = computed(() => app.backgroundUrl());
const isVideo = computed(() => app.settings.bgType === 'video');
const dim = computed(() => Number(app.settings.bgDim) || 0);

watch(
  () => app.settings.bgPath,
  () => {
    failed.value = false;
  }
);

/**
 * 背景视频偶发「加速播放」的兜底
 *
 * 成因是 Chromium 在窗口最小化 / 被遮挡 / 切走 GPU 合成之后，媒体时钟会跳一下，
 * 重新可见时 currentTime 已经往前跳了一大段，看起来就是在快进。
 * 这里做三件事：
 * 1. 任何播放速率变化都强制拉回 1（防止别处意外改了 rate）；
 * 2. 每 2 秒校验一次「视频走了多少秒 vs 真实过了多少秒」，超前就拉回真实进度；
 * 3. 窗口重新可见 / 重新聚焦时补一次 play()，避免停在半路。
 */
let watchdog = null;
let lastVideoTime = 0;
let lastWallClock = 0;

function resetDriftSample() {
  lastVideoTime = 0;
  lastWallClock = 0;
}

function ensureRate(v = videoEl.value) {
  if (!v) return;
  if (v.playbackRate !== 1) v.playbackRate = 1;
  if (v.defaultPlaybackRate !== 1) v.defaultPlaybackRate = 1;
}

function sample() {
  const v = videoEl.value;
  if (!v || v.paused || v.seeking || v.ended) return;
  ensureRate(v);
  const now = performance.now();
  if (lastVideoTime && lastWallClock) {
    const dVideo = v.currentTime - lastVideoTime;
    const dWall = (now - lastWallClock) / 1000;
    // 循环回绕时 currentTime 会变小，dVideo <= 0 直接跳过
    if (dVideo > 0 && dWall > 0 && dVideo > dWall * 1.4 + 0.4) {
      try {
        v.currentTime = Math.max(0, lastVideoTime + dWall);
      } catch {}
    }
  }
  lastVideoTime = v.currentTime;
  lastWallClock = now;
}

function bindVideo() {
  const v = videoEl.value;
  resetDriftSample();
  if (!v) return;
  ensureRate(v);
  // 元数据就绪后强制从 1 倍速开始，并确保在播
  const onReady = () => {
    ensureRate(v);
    resetDriftSample();
    v.play().catch(() => {});
  };
  v.addEventListener('loadedmetadata', onReady);
  v.addEventListener('play', onReady);
  v.addEventListener('ratechange', () => ensureRate(v));
}

function onVisible() {
  if (document.hidden) return;
  const v = videoEl.value;
  if (!v) return;
  ensureRate(v);
  resetDriftSample();
  if (v.paused) v.play().catch(() => {});
}

onMounted(() => {
  nextTick(bindVideo);
  watchdog = setInterval(sample, 2000);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
});

watch(isVideo, async () => {
  failed.value = false;
  await nextTick();
  bindVideo();
});

onBeforeUnmount(() => {
  clearInterval(watchdog);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', onVisible);
  try {
    videoEl.value?.pause();
  } catch {}
});
</script>

<template>
  <div v-if="url && !failed" class="app-bg">
    <video
      v-if="isVideo"
      :key="url"
      ref="videoEl"
      :src="url"
      autoplay
      loop
      muted
      playsinline
      preload="auto"
      @error="failed = true"
    />
    <img v-else :src="url" alt="" @error="failed = true" />
    <div class="dim" :style="{ opacity: dim }" />
  </div>
</template>

<style scoped>
.app-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0b0c0f;
  border-radius: inherit;
}
.app-bg video,
.app-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.dim {
  position: absolute;
  inset: 0;
  background: #000;
  transition: opacity 0.2s ease;
}
</style>
