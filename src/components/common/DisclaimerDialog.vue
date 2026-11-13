<script setup>
import { ref } from 'vue';
import Icon from '@/components/common/Icon.vue';

const emit = defineEmits(['accept']);

const checked = ref(false);
const accepted = ref(false);

function accept() {
  if (!checked.value) return;
  accepted.value = true;
  emit('accept');
}

function quit() {
  if (window.kg?.close) window.kg.close();
}
</script>

<template>
  <teleport to="body">
    <div class="dl-layer">
      <div class="dl-card">
        <div class="dl-head">
          <img class="dl-icon" src="/icon.png" alt="" />
          <div class="dl-head-text">
            <h3>使用前请阅读免责声明</h3>
            <p>萌萌音乐 · MengMeng Music</p>
          </div>
          <span class="dl-tag">首次启动</span>
        </div>

        <ol class="dl-list">
          <li>本项目仅供学习使用，请尊重版权，请勿利用此项目从事商业行为及非法用途！</li>
          <li>使用本项目的过程中可能会产生版权数据。对于这些版权数据，本项目不拥有它们的所有权。为了避免侵权，使用者务必在 24 小时内清除使用本项目的过程中所产生的版权数据。</li>
          <li>由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。</li>
          <li>禁止在违反当地法律法规的情况下使用本项目。对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。</li>
          <li>音乐平台不易，请尊重版权，支持正版。</li>
          <li>本项目仅用于对技术可行性的探索及研究，不接受任何商业（包括但不限于广告等）合作及捐赠。</li>
          <li>如果官方音乐平台觉得本项目不妥，可联系本项目更改或移除。</li>
        </ol>

        <label class="dl-check">
          <input v-model="checked" type="checkbox" />
          <span>我已阅读并同意上述全部条款，仅在个人学习研究范围内使用本软件</span>
        </label>

        <div class="dl-foot">
          <button class="dl-btn ghost" @click="quit">不同意并退出</button>
          <button class="dl-btn primary" :disabled="!checked || accepted" @click="accept">
            <Icon name="check" :size="15" color="#fff" />
            同意并继续使用
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.dl-layer {
  position: fixed;
  inset: 0;
  z-index: 100090;
  background: rgba(8, 11, 18, 0.62);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 28px;
}
.dl-card {
  width: 640px;
  max-width: calc(100vw - 56px);
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: var(--kg-surface);
  color: var(--kg-text);
  border: 1px solid var(--kg-line);
  box-shadow: 0 30px 90px rgba(4, 8, 16, 0.5);
  padding: 22px 24px 18px;
}
.dl-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.dl-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}
.dl-head-text {
  flex: 1;
  min-width: 0;
}
.dl-head-text h3 {
  margin: 0 0 3px;
  font-size: 16.5px;
  font-weight: 700;
}
.dl-head-text p {
  margin: 0;
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.dl-tag {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--kg-accent-dark);
  background: var(--kg-accent-soft);
  border-radius: 10px;
  padding: 3px 9px;
}
.dl-list {
  margin: 0;
  padding: 0 4px 0 20px;
  overflow-y: auto;
  max-height: 46vh;
  font-size: 12.5px;
  line-height: 1.85;
  color: var(--kg-text-2);
}
.dl-list li + li {
  margin-top: 6px;
}
.dl-check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 14px 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--kg-panel-2);
  font-size: 12px;
  color: var(--kg-text-2);
  cursor: pointer;
}
.dl-check input {
  margin-top: 2px;
  accent-color: var(--kg-accent);
}
.dl-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.dl-btn {
  height: 36px;
  padding: 0 18px;
  border-radius: 18px;
  font-size: 12.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dl-btn.ghost {
  color: var(--kg-text-2);
  background: var(--kg-panel);
  border: 1px solid var(--kg-line);
}
.dl-btn.ghost:hover {
  background: var(--kg-hover);
}
.dl-btn.primary {
  color: #fff;
  background: var(--kg-accent);
  box-shadow: 0 8px 20px rgba(var(--kg-accent-rgb), 0.3);
}
.dl-btn.primary:disabled {
  opacity: 0.45;
  box-shadow: none;
  cursor: not-allowed;
}
</style>
