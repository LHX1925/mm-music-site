<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  src: { type: String, default: '' },
  size: { type: [Number, String], default: 48 },
  radius: { type: [Number, String], default: 6 },
  alt: { type: String, default: '' },
  /** 无封面时显示的占位文字（一般为歌单名首字） */
  letter: { type: String, default: '' },
  /** 占位底色种子，决定渐变色调 */
  seed: { type: [String, Number], default: 0 },
});

const failed = ref(false);
const loaded = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
    loaded.value = false;
  }
);

const px = (v) => (typeof v === 'number' ? `${v}px` : v);

const palettes = [
  ['#8fd6ff', '#5aa8f0'],
  ['#ffd28f', '#f0a45a'],
  ['#b7e7c9', '#6ccf97'],
  ['#d3c4ff', '#9a86f0'],
  ['#ffc2cf', '#ef7f9b'],
  ['#bfe3e0', '#66bdb5'],
];
const letterSize = computed(() =>
  typeof props.size === 'number' ? `${Math.max(10, Math.round(props.size * 0.42))}px` : '18px'
);
const palette = computed(() => {
  const s = String(props.seed || props.letter || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return palettes[h % palettes.length];
});
</script>

<template>
  <div class="cover" :style="{ width: px(size), height: px(size), borderRadius: px(radius) }">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      loading="lazy"
      :class="{ loaded }"
      @load="loaded = true"
      @error="failed = true"
    />
    <div
      v-if="!src || failed"
      class="fallback"
      :style="letter ? { background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` } : {}"
    >
      <span v-if="letter" class="letter" :style="{ fontSize: letterSize }">{{ letter }}</span>
      <svg v-else width="42%" height="42%" viewBox="0 0 24 24" fill="none" stroke="#b9bfc9" stroke-width="1.6">
        <path d="M9.2 18.2V6.6l9.2-2v11.6" stroke-linecap="round" />
        <circle cx="6.6" cy="18.6" r="2.6" />
        <circle cx="15.8" cy="16.4" r="2.6" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #f1f2f4, #e7e9ed);
  flex: 0 0 auto;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.25s ease;
}
.cover img.loaded {
  opacity: 1;
}
.fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.letter {
  color: #fff;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  line-height: 1;
}
</style>
