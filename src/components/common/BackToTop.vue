<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const show = ref(false);
let target = null;

function onScroll(e) {
  const el = e.target;
  if (!el || el.nodeType !== 1) return;
  target = el;
  show.value = el.scrollTop > 240;
}

function toTop() {
  const el = target || document.querySelector('.page-scroll');
  if (!el) return;
  el.scrollTo({ top: 0, behavior: 'smooth' });
  show.value = false;
}

onMounted(() => {
  // 用捕获阶段监听，元素内部的滚动事件也能收到
  window.addEventListener('scroll', onScroll, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll, true);
});
</script>

<template>
  <transition name="fade">
    <button v-if="show" class="back-top" title="返回顶部" @click="toTop">
      <img src="/assets/lemon.gif" alt="返回顶部" draggable="false" />
    </button>
  </transition>
</template>
