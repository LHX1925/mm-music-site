<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import Icon from '@/components/common/Icon.vue';
import VipBadge from '@/components/common/VipBadge.vue';
import SettingCard from '@/components/common/SettingCard.vue';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';
import { useVipStore } from '@/stores/vip';
import { todayStr } from '@/stores/vip';

const app = useAppStore();
const user = useUserStore();
const vip = useVipStore();

const claiming = computed(() => vip.claiming);
const auto = computed(() => app.settings.autoVip || { enabled: false, time: '09:00', upgrade: false });

const monthDays = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // 周一为第一列
  const claimed = new Set(vip.records.filter((r) => Number(r.receive_vip) === 1).map((r) => r.day));
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push({ empty: true, key: `e${i}` });
  for (let d = 1; d <= days; d++) {
    const day = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ key: day, day: d, date: day, claimed: claimed.has(day), today: day === todayStr() });
  }
  return cells;
});

async function claimToday() {
  if (!user.isLogin) return ElMessage.warning('请先登录账号');
  if (app.platform !== 'lite') {
    ElMessage.warning('每日领取仅支持酷狗音乐概念版，请先在右上角切换');
    return;
  }
  const ok = await vip.claim(todayStr());
  if (ok) await vip.load();
}

async function toggleAuto(key) {
  const next = { ...auto.value, [key]: !auto.value[key] };
  await app.updateSettings({ autoVip: next });
  if (next.enabled) {
    ElMessage.success(`已开启每日自动领取：${next.time}`);
    vip.tick();
  }
}

async function setAutoTime(v) {
  await app.updateSettings({ autoVip: { ...auto.value, time: v } });
}

/** 领取记录：除了图标还要写清楚领的是哪种会员 */
function recordKind(r) {
  const t = String(r?.vip_type || r?.type || '').toLowerCase();
  return /svip|qvip|super|upgrade|2/.test(t) ? 'svip' : 'vip';
}
function recordLabel(r) {
  const t = String(r?.vip_type || r?.type || '').toLowerCase();
  if (/svip|qvip|super|upgrade|2/.test(t)) return '畅听会员升级';
  if (Number(r?.recharge_num) > 1) return '多日会员';
  return '概念版每日会员';
}

onMounted(() => {
  if (user.isLogin) vip.load();
});
</script>

<template>
  <div class="vip-page page-scroll">
    <div class="hero">
      <div class="hero-bg" />
      <div class="hero-content">
        <div class="tag">
          <img class="tag-icon" src="/assets/vip.png" alt="VIP" />
          萌萌音乐 · 会员中心（概念版）
        </div>
        <h1>{{ vip.isVip ? '会员已开通' : '开通概念版会员' }}</h1>
        <p class="desc">
          <template v-if="vip.isVip">
            有效期至 {{ vip.endTime }} · 剩余 {{ vip.remainText }}
          </template>
          <template v-else-if="user.isLogin">当前账号暂无有效会员，每天可免费领取 1 天</template>
          <template v-else>登录酷狗账号后，每天可免费领取 1 天会员</template>
        </p>
        <div class="hero-actions">
          <button class="btn primary" :disabled="claiming || vip.claimedToday" @click="claimToday">
            <Icon name="vip" :size="15" color="#fff" />
            {{ vip.claimedToday ? '今日已领取' : claiming ? '领取中…' : '立即领取今日会员' }}
          </button>
          <button class="btn" :disabled="vip.upgrading || !user.isLogin" @click="vip.upgrade()">
            <Icon name="star" :size="15" /> {{ vip.upgrading ? '升级中…' : '升级畅听 VIP' }}
          </button>
          <button class="btn ghost" @click="vip.load()">
            <Icon name="refresh" :size="15" /> 刷新状态
          </button>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="label">本月已领</span>
        <b>{{ vip.monthCount }} 天</b>
      </div>
      <div class="stat">
        <span class="label">今日状态</span>
        <b :class="{ ok: vip.claimedToday }">{{ vip.claimedToday ? '已领取' : '待领取' }}</b>
      </div>
      <div class="stat">
        <span class="label">剩余时长</span>
        <b>{{ vip.remainText || '—' }}</b>
      </div>
      <div class="stat">
        <span class="label">领取记录</span>
        <b>{{ vip.records.length }} 条</b>
      </div>
    </div>

    <div class="grid">
      <SettingCard icon="calendar" title="本月领取日历" help="绿色表示当天已领取会员" class="calendar-card">
        <div class="week-head">
          <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w">{{ w }}</span>
        </div>
        <div class="calendar">
          <div
            v-for="c in monthDays"
            :key="c.key"
            class="day"
            :class="{ empty: c.empty, claimed: c.claimed, today: c.today }"
          >
            {{ c.empty ? '' : c.day }}
          </div>
        </div>
      </SettingCard>

      <SettingCard icon="clock" title="每日自动领取" help="应用运行时每天到点自动领取；启动时会补领当天未领的会员">
        <button class="set-switch" :class="{ on: auto.enabled }" @click="toggleAuto('enabled')">
          <span>{{ auto.enabled ? '已开启' : '关闭' }}</span>
          <i class="track" />
        </button>
        <div class="time-row">
          <span class="time-label">领取时间</span>
          <el-time-select
            :model-value="auto.time"
            start="00:00"
            step="00:30"
            end="23:30"
            size="small"
            style="width: 120px"
            @update:model-value="setAutoTime"
          />
        </div>
        <button class="set-switch" :class="{ on: auto.upgrade }" @click="toggleAuto('upgrade')">
          <span>领取后自动升级畅听 VIP</span>
          <i class="track" />
        </button>
        <div class="set-hint">
          上次结果：
          <template v-if="vip.lastClaim">{{ vip.lastClaim.day }} · {{ vip.lastClaim.ok ? '成功' : vip.lastClaim.msg }}</template>
          <template v-else>暂无</template>
        </div>
      </SettingCard>

      <SettingCard icon="list" title="领取记录" class="records-card">
        <div v-if="vip.records.length" class="records">
          <div v-for="r in [...vip.records].reverse().slice(0, 12)" :key="r.day" class="record">
            <span class="rday">{{ r.day }}</span>
            <VipBadge :only="recordKind(r)" :size="14" class="rtype" />
            <span class="rtype-label">{{ recordLabel(r) }}</span>
            <span class="rnum">+{{ r.recharge_num || 1 }} 天</span>
          </div>
        </div>
        <div v-else class="empty">还没有领取记录</div>
      </SettingCard>

      <SettingCard icon="shield" title="领取说明">
        <ul class="tips">
          <li>每日领取接口来自酷狗概念版客户端，仅概念版账号可用（右上角切换「概念版」）。</li>
          <li>领取后可获得 1 天概念版会员，可在会员有效期内播放 VIP 音质与专属曲库。</li>
          <li>请勿频繁调用领取接口，避免触发风控；本客户端默认每天仅领取一次。</li>
          <li>自动领取依赖客户端运行，若当天未启动，下次启动会自动补领。</li>
        </ul>
      </SettingCard>
    </div>
  </div>
</template>

<style scoped>
.vip-page {
  height: 100%;
  overflow-y: auto;
  padding: 10px 26px 40px;
}
.hero {
  position: relative;
  border-radius: 18px;
  padding: 26px 28px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  /* 米金渐变稍微压深一点，文字才能压得住，不会一片「过曝」的白 */
  background: linear-gradient(120deg, #fbeed8, #f8dfb2 46%, #f4e3ea);
  border: 1px solid #ead6b2;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 10px 26px rgba(180, 140, 70, 0.1);
  margin-bottom: 16px;
  color: #5a3d10;
}
:root[data-theme='dark'] .hero {
  background: linear-gradient(120deg, #241d12, #2a2116 46%, #241a20);
  border-color: #3a2f1e;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 12px 30px rgba(0, 0, 0, 0.35);
  color: #f1dcae;
}
.hero-bg {
  position: absolute;
  right: -60px;
  top: -80px;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 196, 84, 0.32), transparent 66%);
}
:root[data-theme='dark'] .hero-bg {
  background: radial-gradient(circle, rgba(255, 186, 84, 0.18), transparent 68%);
}
.hero-content {
  position: relative;
  z-index: 1;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: #7a4d00;
  font-size: 11px;
  font-weight: 600;
}
:root[data-theme='dark'] .tag {
  background: rgba(255, 255, 255, 0.08);
  color: #f0c674;
}
.hero h1 {
  margin: 12px 0 6px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #4a3109;
}
:root[data-theme='dark'] .hero h1 {
  color: #f6e2b8;
}
.desc {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: #8a6a33;
}
:root[data-theme='dark'] .desc {
  color: rgba(242, 218, 173, 0.82);
}
.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 18px;
  border: 1px solid rgba(196, 158, 90, 0.45);
  background: rgba(255, 255, 255, 0.86);
  color: #6b4c18;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.btn:hover {
  background: #ffffff;
}
:root[data-theme='dark'] .btn {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(240, 214, 165, 0.26);
  color: #efd8ab;
}
:root[data-theme='dark'] .btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.btn.primary {
  background: linear-gradient(135deg, #f6b83c, #e08f18);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(224, 143, 24, 0.28);
}
.btn.primary:hover {
  filter: brightness(1.04);
}
/* 已领取 / 领取中：不再用半透明「糊白」，换成低饱和的实色，字看得清 */
.btn.primary:disabled {
  background: #ecdfc6;
  color: #9a855c;
  box-shadow: none;
  opacity: 1;
  cursor: default;
}
:root[data-theme='dark'] .btn.primary:disabled {
  background: rgba(255, 255, 255, 0.09);
  color: rgba(242, 218, 173, 0.5);
}
.btn.ghost {
  background: transparent;
}
.btn.ghost:hover {
  background: rgba(255, 255, 255, 0.6);
}
:root[data-theme='dark'] .btn.ghost:hover {
  background: rgba(255, 255, 255, 0.1);
}
.tag-icon {
  height: 14px;
  width: auto;
}
.hero-badges {
  margin: 6px 0;
  line-height: 0;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat {
  background: var(--kg-card);
  border: 1px solid var(--kg-line);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat .label {
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.stat b {
  font-size: 18px;
  font-weight: 700;
}
.stat b.ok {
  color: var(--kg-accent-dark);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.calendar-card {
  grid-row: span 1;
}
.week-head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  font-size: 10.5px;
  color: var(--kg-text-3);
  text-align: center;
  margin-bottom: 6px;
}
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.day {
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 11.5px;
  color: var(--kg-text-2);
  background: var(--kg-panel-2);
}
.day.empty {
  background: transparent;
}
.day.claimed {
  background: #d8f7e6;
  color: var(--kg-accent-dark);
  font-weight: 700;
}
:root[data-theme='dark'] .day.claimed {
  background: rgba(0, 210, 106, 0.22);
  color: #6ff0b0;
}
.day.today {
  box-shadow: inset 0 0 0 1.5px var(--kg-accent);
}
.time-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0;
  font-size: 12.5px;
}
.time-label {
  color: var(--kg-text-2);
}
.records {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 210px;
  overflow-y: auto;
}
.record {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  font-size: 12px;
  border-bottom: 1px dashed var(--kg-line);
}
.rday {
  width: 92px;
  color: var(--kg-text-2);
}
.rtype {
  color: var(--kg-text);
}
.rtype-label {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--kg-text-3);
}
.rnum {
  color: var(--kg-accent-dark);
  font-weight: 600;
}
.tips {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.9;
  color: var(--kg-text-2);
}
.empty {
  padding: 30px 0;
  text-align: center;
  font-size: 12px;
  color: var(--kg-text-3);
}
.page-scroll {
  height: 100%;
  overflow-y: auto;
}
</style>
