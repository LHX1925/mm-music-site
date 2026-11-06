<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import Icon from '@/components/common/Icon.vue';
import { playGreeting, stopGreeting } from '@/utils/greeting';

/**
 * 启动问候气泡
 * 轻量、自动消失，不会再弹 Element Plus 的全局消息挡视线
 */
const props = defineProps({
  item: { type: Object, default: null },
  /** 自动关闭时间（ms），0 表示不自动关 */
  duration: { type: Number, default: 5200 },
});
const emit = defineEmits(['close']);

const visible = ref(false);
let timer = null;

function clear() {
  if (timer) clearTimeout(timer);
  timer = null;
}

watch(
  () => props.item,
  (v) => {
    clear();
    visible.value = Boolean(v);
    if (!v) return;
    if (props.duration > 0) timer = setTimeout(() => emit('close'), props.duration);
  },
  { immediate: true }
);

function replay() {
  if (!props.item) return;
  playGreeting(props.item, 0.55);
}

function close() {
  stopGreeting();
  emit('close');
}

onBeforeUnmount(() => {
  clear();
  stopGreeting();
});
</script>

<template>
  <transition name="greet">
    <div v-if="visible && item" class="greet-toast" @click="replay">
      <img class="g-ava" src="/assets/profile.jpg" alt="" draggable="false" />
      <div class="g-body">
        <div class="g-name">
          {{ item.name }}
          <span class="g-lang">{{ item.lang }}</span>
          <span class="g-wave" title="点击气泡可重播">
            <i /><i /><i />
          </span>
        </div>
        <div class="g-text">{{ item.text }}</div>
      </div>
      <button class="g-close" title="关闭" @click.stop="close">
        <Icon name="close-small" :size="12" />
      </button>
    </div>
  </transition>
</template>

<style scoped>
.greet-toast {
  position: fixed;
  left: 276px;
  bottom: 100px;
  z-index: 46;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 274px;
  padding: 10px 12px 10px 10px;
  border-radius: 14px;
  background: var(--kg-surface);
  border: 1px solid var(--kg-line);
  box-shadow: 0 14px 34px rgba(15, 20, 30, 0.16);
  cursor: pointer;
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
}
.g-ava {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  flex: 0 0 34px;
  box-shadow: 0 0 0 2px var(--kg-accent-soft);
}
.g-body {
  flex: 1;
  min-width: 0;
}
.g-name {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: var(--kg-text);
}
.g-lang {
  font-size: 9.5px;
  font-weight: 500;
  color: var(--kg-text-3);
  border: 1px solid var(--kg-line-2);
  border-radius: 6px;
  padding: 0 4px;
  line-height: 14px;
}
.g-wave {
  display: inline-flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 10px;
  margin-left: 2px;
}
.g-wave i {
  width: 2px;
  border-radius: 2px;
  background: var(--kg-accent);
  animation: wave 0.9s ease-in-out infinite;
}
.g-wave i:nth-child(1) {
  height: 5px;
  animation-delay: 0s;
}
.g-wave i:nth-child(2) {
  height: 9px;
  animation-delay: 0.18s;
}
.g-wave i:nth-child(3) {
  height: 6px;
  animation-delay: 0.36s;
}
@keyframes wave {
  0%,
  100% {
    transform: scaleY(0.55);
  }
  50% {
    transform: scaleY(1);
  }
}
.g-text {
  margin-top: 3px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--kg-text-2);
  word-break: break-word;
}
.g-close {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--kg-text-3);
  flex: 0 0 18px;
}
.g-close:hover {
  background: var(--kg-hover);
  color: var(--kg-text);
}
.greet-enter-active,
.greet-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.greet-enter-from,
.greet-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
}
</style>
