<script setup>
import Icon from './Icon.vue';

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  moreText: { type: String, default: '' },
  showPlay: { type: Boolean, default: false },
});
const emit = defineEmits(['more', 'play']);
</script>

<template>
  <div class="section-header">
    <h2 class="title">{{ title }}</h2>
    <button v-if="showPlay" class="play-all" @click="emit('play')">
      <Icon name="play" :size="14" color="#14161a" filled />
    </button>
    <span v-if="subtitle" class="subtitle">{{ subtitle }}</span>
    <div class="spacer" />
    <slot name="right" />
    <button v-if="moreText" class="more" @click="emit('more')">
      {{ moreText }}
      <Icon name="arrow-right" :size="12" />
    </button>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
}
.play-all {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--kg-panel);
  display: grid;
  place-items: center;
  transition: background 0.15s ease, transform 0.15s ease;
}
.play-all:hover {
  background: var(--kg-line-2);
  transform: scale(1.05);
}
.subtitle {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.spacer {
  flex: 1;
}
.more {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--kg-text-2);
}
.more:hover {
  color: var(--kg-text);
}
</style>
