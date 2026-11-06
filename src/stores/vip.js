import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { monthVipRecord, receiveDayVip, unionVip, upgradeDayVip } from '@/api';
import { useAppStore } from './app';
import { useUserStore } from './user';

const pad = (n) => String(n).padStart(2, '0');
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseTime(v) {
  if (!v) return 0;
  const t = new Date(String(v).replace(/-/g, '/')).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * 概念版会员：VIP 状态、每日领取、自动领取
 *
 * 酷狗标准版 `/user/detail` 的 vip_type 恒为 0（概念版会员走 busi_vip 体系），
 * 真正的会员状态在 `/youth/union/vip` 的 busi_vip 里。
 */
export const useVipStore = defineStore('vip', () => {
  const app = useAppStore();
  const user = useUserStore();

  const info = ref({});
  const records = ref([]);
  const loading = ref(false);
  const claiming = ref(false);
  const upgrading = ref(false);
  const lastClaim = ref(null);

  const busiList = computed(() => (Array.isArray(info.value.busi_vip) ? info.value.busi_vip : []));

  const activeProduct = computed(() => {
    const now = Date.now();
    const valid = busiList.value.filter((x) => Number(x.is_vip) === 1 && parseTime(x.vip_end_time) > now);
    return valid.sort((a, b) => parseTime(b.vip_end_time) - parseTime(a.vip_end_time))[0] || null;
  });

  const isVip = computed(() => {
    if (!user.isLogin) return false;
    if (activeProduct.value) return true;
    const now = Date.now();
    if (Number(info.value.is_vip) === 1) return true;
    if (Number(info.value.vip_type) > 0 && parseTime(info.value.vip_end_time) > now) return true;
    return false;
  });

  const endTime = computed(() => activeProduct.value?.vip_end_time || info.value.vip_end_time || '');
  const remainSeconds = computed(() => {
    const t = parseTime(endTime.value);
    return t ? Math.max(0, Math.round((t - Date.now()) / 1000)) : 0;
  });
  const remainText = computed(() => {
    const s = remainSeconds.value;
    if (!s) return '';
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d} 天 ${h} 小时`;
    if (h > 0) return `${h} 小时 ${m} 分`;
    return `${m} 分钟`;
  });

  const productLabel = computed(() => {
    const p = activeProduct.value;
    // 等级一律用图片徽标表达，这里只保留中性的兜底文案
    if (!p) return isVip.value ? '会员生效中' : '每日会员';
    if (p.product_type === 'svip') return '会员生效中';
    if (p.product_type === 'qvip') return '畅听会员';
    if (String(p.latest_product_id || '').includes('CONCEPT')) return '概念版会员';
    return '会员生效中';
  });

  /**
   * 畅听 / 超听这类「升级型」会员。busi_vip 里的 product_type 或 product_id
   * 带 svip / qvip / super 的，都算升级版会员（蓝色钻石图标 vip2.png）；
   * 其余有效的会员（每日领取的那一类）算普通会员（金色钻石图标 vip.png）。
   */
  const PREMIUM_RE = /(s|q)vip|super/i;
  const isPremiumProduct = (x) => PREMIUM_RE.test(`${x?.product_type || ''} ${x?.latest_product_id || ''} ${x?.product_id || ''}`);
  const validBusis = computed(() => {
    const now = Date.now();
    return busiList.value.filter((x) => Number(x.is_vip) === 1 && parseTime(x.vip_end_time) > now);
  });

  /** 升级版（畅听/超听）会员 */
  const hasPremium = computed(() => validBusis.value.some(isPremiumProduct));
  /** 普通会员（每日领取的那一类） */
  const hasNormalVip = computed(() => {
    if (!user.isLogin) return false;
    if (validBusis.value.some((x) => !isPremiumProduct(x))) return true;
    // 标准版没有 busi_vip 体系，用 vip_type / is_vip 兜底；有升级版时不再重复算普通
    if (hasPremium.value) return false;
    if (Number(info.value.is_vip) === 1) return true;
    if (Number(info.value.vip_type) > 0) return true;
    return Number(user.vipType) > 0;
  });

  /**
   * 头像下方展示的会员徽标（图片）
   * 两种都有就按「普通 → 畅听」的顺序都显示
   */
  const badges = computed(() => {
    const out = [];
    if (hasNormalVip.value) out.push({ key: 'vip', src: '/assets/vip.png', label: 'VIP 会员' });
    if (hasPremium.value) out.push({ key: 'vip2', src: '/assets/vip2.png', label: '畅听 VIP' });
    return out;
  });

  const todayRecord = computed(() => records.value.find((r) => r.day === todayStr()));
  const claimedToday = computed(() => Number(todayRecord.value?.receive_vip) === 1);
  const monthCount = computed(() => records.value.filter((r) => Number(r.receive_vip) === 1).length);

  async function load() {
    if (!user.isLogin) {
      info.value = {};
      records.value = [];
      return;
    }
    loading.value = true;
    try {
      const [v, r] = await Promise.allSettled([unionVip(app.platform), monthVipRecord(app.platform)]);
      if (v.status === 'fulfilled') info.value = v.value || {};
      if (r.status === 'fulfilled') records.value = r.value || [];
    } finally {
      loading.value = false;
    }
  }

  /** 领取指定日期（默认今天）的会员 */
  async function claim(day = todayStr(), silent = false) {
    if (!user.isLogin) {
      if (!silent) ElMessage.warning('请先登录酷狗账号');
      return false;
    }
    if (claiming.value) return false;
    claiming.value = true;
    try {
      const res = await receiveDayVip(day, app.platform);
      const ok = Number(res?.status) === 1 || Number(res?.data?.status) === 1 || Number(res?.error_code) === 0;
      const msg = res?.data?.msg || res?.msg || res?.error || (ok ? '领取成功' : '领取失败');
      lastClaim.value = { day, ok, msg, at: Date.now() };
      if (!silent) ElMessage({ message: ok ? `已领取 ${day} 会员：${msg}` : `领取失败：${msg}`, type: ok ? 'success' : 'warning', duration: 3200 });
      await load();
      if (ok) await user.refreshProfile(app.platform).catch(() => {});
      return ok;
    } catch (e) {
      lastClaim.value = { day, ok: false, msg: e.message, at: Date.now() };
      if (!silent) ElMessage.error(e.message || '领取失败');
      return false;
    } finally {
      claiming.value = false;
    }
  }

  /**
   * 升级为畅听 VIP
   * 官方要求先领取当天的听歌奖励，所以未领取时自动补领一次再升级；
   * 297002 表示今日升级奖励已领过，属于正常状态，不按失败处理。
   */
  async function upgrade() {
    if (!user.isLogin) return ElMessage.warning('请先登录');
    if (app.platform !== 'lite') {
      ElMessage.warning('畅听升级仅在概念版可用');
      app.switchPlatform('lite');
      return false;
    }
    if (upgrading.value) return false;
    upgrading.value = true;
    try {
      if (!claimedToday.value) {
        await claim(todayStr(), true);
        await new Promise((r) => setTimeout(r, 350));
      }

      let res = null;
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await upgradeDayVip(app.platform);
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          const msg = e?.message || '';
          // 今日升级奖励已领取
          if (Number(e?.code) === 297002 || /已经领取|已领取过/.test(msg)) {
            ElMessage({ message: '今日升级奖励已领取，明天再来', type: 'info', duration: 2800 });
            await load().catch(() => {});
            return true;
          }
          // 还没领取当天奖励：补领后再试一次
          if (attempt === 0 && /未领取|先领取|领取后/.test(msg)) {
            await claim(todayStr(), true);
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          break;
        }
      }

      if (lastError) {
        ElMessage.error(lastError.message || '升级失败');
        return false;
      }

      const ok = Number(res?.status) === 1 || Number(res?.error_code) === 0;
      ElMessage({
        message: ok ? '已升级为畅听 VIP' : res?.error_msg || res?.error || res?.msg || '升级失败',
        type: ok ? 'success' : 'warning',
      });
      await load();
      if (ok) await user.refreshProfile(app.platform).catch(() => {});
      return ok;
    } finally {
      upgrading.value = false;
    }
  }

  /**
   * 自动领取：由全局定时器每分钟调用
   * 条件：已开启、已登录、当前时间 >= 设定时间、今天还没领过
   */
  async function tick() {
    const cfg = app.settings.autoVip || {};
    if (!cfg.enabled || !user.isLogin) return;
    const now = new Date();
    const [h, m] = String(cfg.time || '09:00').split(':').map(Number);
    const due = now.getHours() * 60 + now.getMinutes() >= (h || 0) * 60 + (m || 0);
    if (!due) return;
    const key = `kg-auto-vip-${app.platform}`;
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    if (state.date === todayStr(now)) return;
    if (claimedToday.value) {
      localStorage.setItem(key, JSON.stringify({ date: todayStr(now), ok: true, skipped: true }));
      return;
    }
    localStorage.setItem(key, JSON.stringify({ date: todayStr(now), ok: false, trying: true }));
    const ok = await claim(todayStr(now), true);
    localStorage.setItem(key, JSON.stringify({ date: todayStr(now), ok }));
    if (ok) {
      ElMessage({ message: '每日会员已自动领取', type: 'success', duration: 2600 });
      if (cfg.upgrade && app.platform === 'lite') await upgrade();
    }
  }

  return {
    info,
    records,
    loading,
    claiming,
    upgrading,
    lastClaim,
    busiList,
    activeProduct,
    isVip,
    hasPremium,
    hasNormalVip,
    badges,
    endTime,
    remainSeconds,
    remainText,
    productLabel,
    todayRecord,
    claimedToday,
    monthCount,
    load,
    claim,
    upgrade,
    tick,
  };
});
