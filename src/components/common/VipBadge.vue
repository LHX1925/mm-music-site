<script setup>
import { computed } from 'vue';
import { useVipStore } from '@/stores/vip';

/**
 * 会员徽标（图片版）
 * - 普通会员：assets/vip.png
 * - 畅听/超听会员：assets/vip2.png
 * - 同时拥有两种会员时两个图标都会显示
 */
const props = defineProps({
  /** 图标高度（px） */
  size: { type: Number, default: 16 },
  /** row=横排（默认） col=竖排 */
  direction: { type: String, default: 'row' },
  /** 为空时不占位 */
  placeholder: { type: Boolean, default: false },
  /** 只显示指定徽标：vip=普通会员 / svip=畅听会员（用于领取记录等单条场景） */
  only: { type: String, default: '' },
});

const vip = useVipStore();
const ONE = {
  vip: { key: 'vip', src: '/assets/vip.png', label: 'VIP 会员' },
  svip: { key: 'svip', src: '/assets/vip2.png', label: '畅听会员' },
};
const list = computed(() => {
  if (props.only) return ONE[props.only] ? [ONE[props.only]] : [];
  if (props.placeholder) return [ONE.vip];
  return vip.badges;
});
</script>

<template>
  <span v-if="list.length" class="vip-badges" :class="direction" :style="{ '--badge-h': size + 'px' }">
    <img
      v-for="b in list"
      :key="b.key"
      class="vip-badge"
      :src="b.src"
      :alt="b.label"
      :title="b.label"
      draggable="false"
    />
  </span>
</template>

<style scoped>
.vip-badges {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
}
.vip-badges.col {
  flex-direction: column;
  gap: 2px;
}
.vip-badge {
  height: var(--badge-h, 16px);
  width: auto;
  object-fit: contain;
  user-select: none;
  /* 图片本身带描边感，加一层极淡的投影让它从底色里浮起来 */
  filter: drop-shadow(0 1px 1.5px rgba(20, 24, 32, 0.18));
}
</style>
