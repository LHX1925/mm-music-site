<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  height: { type: Number, default: 3 },
  buffered: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
  /** 高潮区间 { start, end }，单位与 modelValue 一致 */
  climax: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'change', 'dragstart', 'dragend']);

const trackEl = ref(null);
const dragging = ref(false);
const inner = ref(0);

const ratio = computed(() => {
  if (dragging.value) return inner.value;
  if (!props.max) return 0;
  return Math.min(1, Math.max(0, props.modelValue / props.max));
});
const pct = computed(() => `${ratio.value * 100}%`);
const bufferPct = computed(() => `${props.max ? Math.min(100, (props.buffered / props.max) * 100) : 0}%`);

/** 高潮片段在进度条上的高亮区间 */
const climaxBand = computed(() => {
  if (!props.climax || !props.max) return null;
  const left = Math.max(0, Math.min(1, props.climax.start / props.max));
  const right = Math.max(0, Math.min(1, props.climax.end / props.max));
  if (right - left < 0.01) return null;
  return { left: `${left * 100}%`, width: `${(right - left) * 100}%` };
});

function valueFromEvent(e) {
  const rect = trackEl.value.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

function onDown(e) {
  if (props.disabled) return;
  dragging.value = true;
  inner.value = valueFromEvent(e);
  emit('dragstart');
  trackEl.value.setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function onMove(e) {
  if (!dragging.value) return;
  inner.value = valueFromEvent(e);
  emit('update:modelValue', inner.value * props.max);
}

function onUp() {
  if (!dragging.value) return;
  dragging.value = false;
  emit('change', inner.value * props.max);
  emit('dragend');
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
}
</script>

<template>
  <div
    ref="trackEl"
    class="pslider"
    :class="{ dragging, disabled }"
    :style="{ '--h': height + 'px' }"
    @pointerdown="onDown"
  >
    <div class="rail">
      <div class="buffer" :style="{ width: bufferPct }" />
      <div class="fill" :style="{ width: pct }" />
      <div v-if="climaxBand" class="climax" :style="climaxBand" title="高潮片段，可点底部「高潮」跳转" />
      <div class="knob" :style="{ left: pct }" />
    </div>
  </div>
</template>

<style scoped>
.pslider {
  position: relative;
  height: 14px;
  display: flex;
  align-items: center;
  cursor: pointer;
  width: 100%;
}
.pslider.disabled {
  cursor: default;
  opacity: 0.6;
}
.rail {
  position: relative;
  width: 100%;
  height: var(--h);
  border-radius: 99px;
  background: var(--kg-line-2);
}
.buffer {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: 99px;
  background: #dcdfe4;
}
/* 高潮区间：用暖色高亮压在进度条上层，绿/灰底上都看得见 */
.climax {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 2px;
  background: rgba(255, 168, 38, 0.62);
  pointer-events: none;
  z-index: 3;
  transition: background 0.15s ease;
}
.pslider:hover .climax {
  background: rgba(255, 168, 38, 0.85);
}
.fill {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: 99px;
  background: var(--kg-accent);
  z-index: 2;
}
.pslider:not(.disabled):hover .fill {
  background: var(--kg-accent);
}
.knob {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--kg-surface);
  border: 2px solid var(--kg-accent);
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.12s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}
.pslider:hover .knob,
.pslider.dragging .knob {
  transform: translate(-50%, -50%) scale(1);
}
</style>
