<script setup>
import { useRouter } from 'vue-router';
import Icon from './Icon.vue';
import CoverImage from './CoverImage.vue';
import { formatCount } from '@/utils/format';

const props = defineProps({
  playlist: { type: Object, required: true },
  size: { type: Number, default: 0 },
});
const router = useRouter();

function open() {
  if (props.playlist.id) router.push(`/playlist/${props.playlist.id}`);
}
</script>

<template>
  <div class="pl-card" @click="open">
    <div class="cover-box" :style="size ? { width: size + 'px', height: size + 'px' } : {}">
      <CoverImage :src="playlist.cover" :size="size || '100%'" :radius="10" class="cover" />
      <div class="hover-mask">
        <button class="play"><Icon name="play" :size="15" color="#fff" filled /></button>
      </div>
      <span v-if="playlist.playCount" class="count">
        <Icon name="headphones" :size="11" color="#fff" />
        {{ formatCount(playlist.playCount) }}
      </span>
    </div>
    <div class="name clamp-2" :title="playlist.name">{{ playlist.name }}</div>
    <div v-if="playlist.creator" class="creator ellipsis">{{ playlist.creator }}</div>
  </div>
</template>

<style scoped>
.pl-card {
  cursor: pointer;
  min-width: 0;
}
.cover-box {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
}
.cover {
  width: 100% !important;
  height: 100% !important;
}
.hover-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.22);
  opacity: 0;
  display: grid;
  place-items: center;
  transition: opacity 0.16s ease;
}
.pl-card:hover .hover-mask {
  opacity: 1;
}
.play {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.55);
  display: grid;
  place-items: center;
  transform: scale(0.9);
  transition: transform 0.16s ease;
}
.pl-card:hover .play {
  transform: scale(1);
}
.count {
  position: absolute;
  top: 7px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10.5px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}
.name {
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--kg-text);
  min-height: 36px;
}
.pl-card:hover .name {
  color: var(--kg-accent-dark);
}
.creator {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 2px;
}
</style>
