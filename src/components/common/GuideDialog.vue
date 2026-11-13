<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUiStore } from '@/stores/ui';
import { guideOf } from '@/utils/guide';

const ui = useUiStore();
const route = useRoute();

const content = computed(() => guideOf(ui.guideName || route.name));

function close() {
  ui.closeGuide();
}
</script>

<template>
  <teleport to="body">
    <transition name="guide">
      <div v-if="ui.showGuide" class="guide-layer" @click.self="close">
        <div class="guide-card">
          <div class="guide-text">
            <div class="guide-chip">
              <span class="dot" />
              功能引导 · {{ content.title }}
            </div>
            <h3>Hi，我是萌小萌！</h3>
            <p class="guide-intro">{{ content.intro }}</p>
            <ul class="guide-points">
              <li v-for="(p, i) in content.points" :key="i">{{ p }}</li>
            </ul>
            <div class="guide-foot">
              <button class="gbtn ghost" @click="close">跳过</button>
              <button class="gbtn primary" @click="close">我知道了</button>
            </div>
            <div class="guide-hint">可在「设置 → 关于 → 页面引导」里关闭或重新查看</div>
          </div>
          <div class="guide-figure">
            <img src="/assets/guide/mascot.jpg" alt="" draggable="false" />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.guide-layer {
  position: fixed;
  inset: 0;
  z-index: 100060;
  background: rgba(10, 14, 22, 0.42);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  padding: 24px;
}
.guide-card {
  position: relative;
  width: 620px;
  max-width: calc(100vw - 48px);
  border-radius: 20px;
  background: #ffffff;
  color: #1f232a;
  box-shadow: 0 28px 80px rgba(8, 14, 26, 0.42);
  display: flex;
  overflow: hidden;
  animation: guide-in 0.24s ease;
}
@keyframes guide-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
.guide-text {
  flex: 1 1 auto;
  min-width: 0;
  padding: 22px 8px 18px 24px;
}
.guide-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 9px;
  border-radius: 11px;
  background: #eef5ff;
  color: #2f6fd0;
  font-size: 11px;
  font-weight: 600;
}
.guide-chip .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #2f9cf4;
}
.guide-card h3 {
  margin: 12px 0 6px;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #1b1f27;
}
.guide-intro {
  margin: 0 0 10px;
  font-size: 12.5px;
  line-height: 1.7;
  color: #59616e;
}
.guide-points {
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.guide-points li {
  position: relative;
  padding-left: 16px;
  font-size: 12.5px;
  line-height: 1.6;
  color: #3d434d;
}
.guide-points li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 7px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4aa8f0;
}
.guide-foot {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gbtn {
  height: 34px;
  padding: 0 18px;
  border-radius: 17px;
  font-size: 12.5px;
  font-weight: 600;
  transition: filter 0.15s ease, background 0.15s ease;
}
.gbtn.ghost {
  color: #6b7280;
  background: #f2f4f8;
}
.gbtn.ghost:hover {
  background: #e9edf4;
}
.gbtn.primary {
  color: #fff;
  background: linear-gradient(135deg, #4aa8f0, #2f7ff0);
  box-shadow: 0 8px 18px rgba(47, 127, 240, 0.26);
}
.gbtn.primary:hover {
  filter: brightness(1.05);
}
.guide-hint {
  margin-top: 10px;
  font-size: 11px;
  color: #9aa2b0;
}
.guide-figure {
  flex: 0 0 186px;
  position: relative;
  align-self: stretch;
  overflow: hidden;
  background: linear-gradient(180deg, #eef7ff, #ffffff 72%);
}
.guide-figure img {
  position: absolute;
  left: 50%;
  bottom: 0;
  height: 100%;
  width: auto;
  max-width: none;
  transform: translateX(-50%);
  object-fit: contain;
  object-position: bottom center;
  /* 立绘是白底 JPG：正片叠底把白底吃掉，边缘不会留下一个白色方块 */
  mix-blend-mode: multiply;
  -webkit-mask-image: linear-gradient(to bottom, #000 84%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 84%, transparent 100%);
  pointer-events: none;
  user-select: none;
}
.guide-enter-active,
.guide-leave-active {
  transition: opacity 0.18s ease;
}
.guide-enter-from,
.guide-leave-to {
  opacity: 0;
}
</style>
