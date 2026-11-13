<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { captchaSent, qrCreate, qrKey, qrCheck } from '@/api';
import Icon from '@/components/common/Icon.vue';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { useUiStore } from '@/stores/ui';
import { platformIcon } from '@/utils/brand';

const app = useAppStore();
const user = useUserStore();
const ui = useUiStore();

const tab = ref(ui.loginTab || 'qr');
const qrImg = ref('');
const qrKeyValue = ref('');
const qrStatus = ref(1);
const qrLoading = ref(false);
const mobile = ref('');
const code = ref('');
const username = ref('');
const password = ref('');
const sending = ref(0);
const submitting = ref(false);

let pollTimer = null;
let countdown = null;

const statusText = computed(() => {
  if (qrStatus.value === 0) return '二维码已过期，点击刷新';
  if (qrStatus.value === 2) return '扫码成功，请在手机上确认';
  if (qrStatus.value === 4) return '登录成功';
  return '请使用酷狗音乐 App 扫码登录';
});

async function loadQr() {
  clearInterval(pollTimer);
  qrLoading.value = true;
  qrImg.value = '';
  try {
    qrKeyValue.value = await qrKey();
    if (!qrKeyValue.value) throw new Error('获取二维码失败');
    const res = await qrCreate(qrKeyValue.value);
    qrImg.value = res.base64 || '';
    qrStatus.value = 1;
    startPoll();
  } catch (e) {
    ElMessage.error(e.message || '二维码加载失败');
  } finally {
    qrLoading.value = false;
  }
}

function startPoll() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!qrKeyValue.value) return;
    try {
      const status = await user.loginByQr(app.platform, qrKeyValue.value);
      qrStatus.value = status;
      if (status === 4) {
        clearInterval(pollTimer);
        ElMessage.success('登录成功');
        ui.showLogin = false;
      } else if (status === 0) {
        clearInterval(pollTimer);
      }
    } catch {
      /* 忽略轮询错误 */
    }
  }, 2200);
}

async function sendCode() {
  if (!/^1\d{10}$/.test(mobile.value)) return ElMessage.warning('请输入正确的手机号');
  try {
    await captchaSent(mobile.value, app.platform);
    ElMessage.success('验证码已发送');
    sending.value = 60;
    clearInterval(countdown);
    countdown = setInterval(() => {
      sending.value -= 1;
      if (sending.value <= 0) clearInterval(countdown);
    }, 1000);
  } catch (e) {
    ElMessage.error(e.message || '验证码发送失败');
  }
}

async function phoneLogin() {
  if (!/^1\d{10}$/.test(mobile.value)) return ElMessage.warning('请输入正确的手机号');
  if (!code.value) return ElMessage.warning('请输入验证码');
  submitting.value = true;
  try {
    await user.loginByPhone(app.platform, mobile.value, code.value);
    ElMessage.success('登录成功');
    ui.showLogin = false;
  } catch (e) {
    ElMessage.error(e.message || '登录失败');
  } finally {
    submitting.value = false;
  }
}

async function passwordLogin() {
  if (!username.value.trim()) return ElMessage.warning('请输入账号');
  if (!password.value) return ElMessage.warning('请输入密码');
  submitting.value = true;
  try {
    await user.loginByPassword(app.platform, username.value.trim(), password.value);
    ElMessage.success('登录成功');
    ui.showLogin = false;
  } catch (e) {
    ElMessage.error(e.message || '账号或密码错误');
  } finally {
    submitting.value = false;
  }
}

watch(
  () => ui.showLogin,
  (v) => {
    if (v && tab.value === 'qr') loadQr();
    if (!v) {
      clearInterval(pollTimer);
      clearInterval(countdown);
    }
  }
);

watch(tab, (v) => {
  if (v === 'qr') loadQr();
});

onBeforeUnmount(() => {
  clearInterval(pollTimer);
  clearInterval(countdown);
});

if (ui.showLogin) loadQr();
</script>

<template>
  <div class="login-panel">
    <!-- 左上角软件图标 -->
    <div class="brand">
      <img class="app-icon" src="/icon.png" alt="萌萌音乐" />
      <div class="brand-text">
        <div class="brand-name">萌萌音乐</div>
        <div class="brand-en">MengMeng Music</div>
      </div>
    </div>

    <div class="head">
      <div class="title">
        <img class="title-logo" :src="platformIcon(app.platform)" alt="" draggable="false" />
        登录{{ app.platformName }}
      </div>
      <div class="sub">两个平台账号体系独立，登录后可同步歌单、收藏与播放记录</div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'qr' }" @click="tab = 'qr'">扫码登录</button>
      <button class="tab" :class="{ active: tab === 'phone' }" @click="tab = 'phone'">手机号登录</button>
      <button class="tab" :class="{ active: tab === 'pwd' }" @click="tab = 'pwd'">账号密码</button>
    </div>

    <div v-if="tab === 'qr'" class="qr-box">
      <div class="qr-frame" v-loading="qrLoading">
        <img v-if="qrImg" :src="qrImg" alt="二维码" />
        <div v-else class="qr-empty">
          <Icon name="qr" :size="40" color="#c6cbd4" />
        </div>
        <button v-if="qrStatus === 0" class="qr-refresh" @click="loadQr">刷新二维码</button>
      </div>
      <div class="qr-status" :class="{ ok: qrStatus === 4, warn: qrStatus === 0 }">{{ statusText }}</div>
      <div class="qr-tip">
        打开手机酷狗音乐 → 我的 → 右上角扫码
      </div>
    </div>

    <div v-else-if="tab === 'phone'" class="phone-box">
      <label class="field">
        <Icon name="phone" :size="16" color="#9aa0ab" />
        <input v-model="mobile" maxlength="11" placeholder="请输入手机号" />
      </label>
      <label class="field">
        <Icon name="shield" :size="16" color="#9aa0ab" />
        <input v-model="code" maxlength="6" placeholder="请输入短信验证码" />
        <button class="send" :disabled="sending > 0" @click="sendCode">
          {{ sending > 0 ? `${sending}s` : '获取验证码' }}
        </button>
      </label>
      <button class="submit" :disabled="submitting" @click="phoneLogin">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
      <div class="agreement">登录即代表同意《用户协议》与《隐私政策》</div>
    </div>

    <div v-else class="phone-box">
      <label class="field">
        <Icon name="singer" :size="16" color="#9aa0ab" />
        <input v-model="username" placeholder="酷狗账号 / 手机号" autocomplete="username" />
      </label>
      <label class="field">
        <Icon name="shield" :size="16" color="#9aa0ab" />
        <input
          v-model="password"
          type="password"
          placeholder="登录密码"
          autocomplete="current-password"
          @keyup.enter="passwordLogin"
        />
      </label>
      <button class="submit" :disabled="submitting" @click="passwordLogin">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
      <div class="agreement">账号密码通过酷狗登录服务直连校验，不会上传到第三方</div>
    </div>

    <div class="platform-tip">
      <img class="tip-logo" :src="platformIcon(app.platform)" alt="" draggable="false" />
      当前为 {{ app.platformName }}，可在右上角切换
    </div>

    <div class="privacy-note">
      <Icon name="shield" :size="13" color="#9aa0ab" />
      <span>隐私声明：本应用仅使用你的账号连接酷狗服务获取音乐内容；登录凭证仅保存在本机，绝不会上传任何个人数据至第三方服务器。</span>
    </div>
  </div>
</template>

<style scoped>
.login-panel {
  padding: 4px 2px 2px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 14px;
}
.app-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(15, 20, 30, 0.12);
  background: var(--kg-panel);
}
.brand-text {
  min-width: 0;
}
.brand-name {
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.brand-en {
  font-size: 10px;
  color: var(--kg-text-3);
  letter-spacing: 1px;
  margin-top: 1px;
}
.title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 18px;
  font-weight: 700;
}
.title-logo {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  object-fit: cover;
}
.sub {
  font-size: 11.5px;
  color: var(--kg-text-3);
  margin-top: 6px;
  line-height: 1.6;
}
.tabs {
  display: flex;
  gap: 18px;
  margin: 16px 0 14px;
  border-bottom: 1px solid var(--kg-line);
}
.tab {
  padding-bottom: 9px;
  font-size: 13px;
  color: var(--kg-text-2);
  position: relative;
}
.tab.active {
  color: var(--kg-text);
  font-weight: 600;
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -1px;
  width: 18px;
  height: 2px;
  background: var(--kg-accent);
  border-radius: 2px;
}
.qr-box {
  text-align: center;
  padding: 8px 0 4px;
}
.qr-frame {
  width: 188px;
  height: 188px;
  margin: 0 auto;
  border-radius: 12px;
  border: 1px solid var(--kg-line);
  background: var(--kg-surface);
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.qr-frame img {
  width: 170px;
  height: 170px;
}
.qr-empty {
  display: grid;
  place-items: center;
}
.qr-refresh {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  color: var(--kg-accent-dark);
}
.qr-status {
  margin-top: 12px;
  font-size: 12.5px;
  color: var(--kg-text-2);
}
.qr-status.ok {
  color: var(--kg-accent-dark);
}
.qr-status.warn {
  color: #d9534f;
}
.qr-tip {
  font-size: 11px;
  color: var(--kg-text-3);
  margin-top: 6px;
}
.phone-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field {
  height: 42px;
  border-radius: 10px;
  border: 1px solid var(--kg-line);
  background: var(--kg-panel-2);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.field input {
  flex: 1;
  font-size: 13px;
}
.send {
  font-size: 11.5px;
  color: var(--kg-accent-dark);
  font-weight: 600;
}
.send:disabled {
  color: var(--kg-text-3);
}
.submit {
  height: 42px;
  border-radius: 10px;
  background: var(--kg-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  margin-top: 4px;
}
.submit:disabled {
  opacity: 0.7;
}
.agreement {
  font-size: 10.5px;
  color: var(--kg-text-3);
  text-align: center;
}
.platform-tip {
  margin-top: 14px;
  font-size: 11px;
  color: var(--kg-text-3);
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: center;
}
.tip-logo {
  width: 13px;
  height: 13px;
  border-radius: 4px;
  object-fit: cover;
}
.privacy-note {
  margin-top: 16px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--kg-panel-2);
  border: 1px solid var(--kg-line);
  font-size: 11px;
  line-height: 1.65;
  color: var(--kg-text-3);
}
.privacy-note :deep(svg) {
  flex: 0 0 auto;
  margin-top: 2px;
}
</style>
