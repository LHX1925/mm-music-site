<script setup>
import { useRouter } from 'vue-router';
import LoginPanel from '@/components/login/LoginPanel.vue';
import Icon from '@/components/common/Icon.vue';

const router = useRouter();
</script>

<template>
  <div class="login-page">
    <div class="card">
      <button class="back" @click="router.back()"><Icon name="back" :size="15" /> 返回</button>
      <LoginPanel />
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: grid;
  place-items: center;
  background: radial-gradient(120% 120% at 20% 0%, #f0fdf6 0%, #f7f8fb 45%, #ffffff 100%);
  overflow-y: auto;
  padding: 24px;
}
.card {
  width: 400px;
  background: var(--kg-surface);
  border-radius: 16px;
  border: 1px solid var(--kg-line);
  box-shadow: 0 20px 50px rgba(20, 24, 32, 0.08);
  padding: 26px 26px 20px;
  position: relative;
}
.back {
  position: absolute;
  right: 20px;
  top: 24px;
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.back:hover {
  color: var(--kg-text);
}
</style>
