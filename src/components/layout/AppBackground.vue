<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
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

onBeforeUnmount(() => {
  try {
    videoEl.value?.pause();
  } catch {}
});
</script>

<template>
  <div v-if="url && !failed" class="app-bg">
    <video
      v-if="isVideo"
      ref="videoEl"
      :src="url"
      autoplay
      loop
      muted
      playsinline
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
