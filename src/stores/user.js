import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { setRuntime } from '@/api/http';
import { registerDev, userDetail, userVip } from '@/api';
import { ensureDfid, getDfid } from '@/utils/device';
import { useAppStore } from './app';

const KEY = (p) => `kg-session-${p}`;

function loadSession(p) {
  try {
    return JSON.parse(localStorage.getItem(KEY(p)) || '{}');
  } catch {
    return {};
  }
}

/**
 * 账号状态：两个平台各自独立的登录态（酷狗标准版 / 概念版 token 不通用）
 */
export const useUserStore = defineStore('user', () => {
  const sessions = ref({ std: loadSession('std'), lite: loadSession('lite') });
  const loading = ref(false);
  const platformRef = ref('std');

  const session = computed(() => sessions.value[platformRef.value] || {});
  const isLogin = computed(() => Boolean(session.value.token && session.value.userid));
  const nickname = computed(() => session.value.nickname || '未登录');
  const avatar = computed(() => session.value.avatar || '');
  const vipType = computed(() => Number(session.value.vipType || session.value.vip_type || 0));
  const isVip = computed(() => vipType.value > 0);
  const vipLabel = computed(() => {
    if (!isLogin.value) return '登录';
    if (!vipType.value) return '每日会员';
    return '会员生效中';
  });

  /** 拼接给 API 服务的 Cookie 串（服务端会转成官方请求头） */
  function cookieOf(p) {
    const s = sessions.value[p] || {};
    const parts = [];
    if (s.token) parts.push(`token=${s.token}`);
    if (s.userid) parts.push(`userid=${s.userid}`);
    // dfid 是取流接口的风控凭据：优先用启动时注册的设备号（风控时可换新），
    // 没有再用登录时服务端下发的那个
    const dfid = getDfid(p) || s.dfid;
    if (dfid) parts.push(`dfid=${dfid}`);
    if (s.vip_type) parts.push(`vip_type=${s.vip_type}`);
    if (s.vip_token) parts.push(`vip_token=${s.vip_token}`);
    if (s.t1) parts.push(`t1=${s.t1}`);
    return parts.join(';');
  }

  /** 启动时给两个平台各准备一个设备号（取流必需） */
  async function initDevice() {
    await ensureDfid('std').catch(() => '');
    await ensureDfid('lite').catch(() => '');
  }

  function syncRuntime(p) {
    platformRef.value = p;
    setRuntime({ platform: p, cookieProvider: (plat) => cookieOf(plat || platformRef.value) });
  }

  function persist(p) {
    localStorage.setItem(KEY(p), JSON.stringify(sessions.value[p] || {}));
  }

  watch(sessions, () => persist(platformRef.value), { deep: true });

  /** 合并登录返回信息 */
  function applyAuth(p, data = {}, cookies = []) {
    const cookieMap = {};
    cookies.forEach((c) => {
      const i = c.indexOf('=');
      if (i > 0) cookieMap[c.slice(0, i)] = c.slice(i + 1);
    });
    const next = {
      ...sessions.value[p],
      token: data.token || cookieMap.token || sessions.value[p]?.token || '',
      userid: data.userid || cookieMap.userid || sessions.value[p]?.userid || '',
      vip_type: data.vip_type || cookieMap.vip_type || sessions.value[p]?.vip_type || 0,
      vip_token: data.vip_token || cookieMap.vip_token || sessions.value[p]?.vip_token || '',
      t1: data.t1 || cookieMap.t1 || sessions.value[p]?.t1 || '',
      dfid: cookieMap.dfid || sessions.value[p]?.dfid || '',
    };
    sessions.value = { ...sessions.value, [p]: next };
    persist(p);
    return next;
  }

  /** 通过主进程发起请求，读取 Set-Cookie */
  async function rawCall(p, path, { method = 'GET', data } = {}) {
    if (!window.kg?.httpRaw) return null;
    const port = usePort(p);
    const res = await window.kg.httpRaw({ port, path, method, data });
    if (!res) return null;
    let body = null;
    try {
      body = JSON.parse(res.body);
    } catch {
      body = res.body;
    }
    return { body, cookies: res.cookies || [], status: res.status };
  }

  function usePort(p) {
    const app = useAppStore();
    return app.ports[p] || (p === 'lite' ? 32101 : 32100);
  }

  async function setPorts(ports) {
    localStorage.setItem('kg-ports', JSON.stringify(ports));
  }

  /** 刷新用户资料 */
  async function refreshProfile(p = platformRef.value) {
    if (!sessions.value[p]?.token) return;
    loading.value = true;
    try {
      const info = await userDetail(p);
      const vip = await userVip(p).catch(() => ({}));
      const next = {
        ...sessions.value[p],
        nickname: info.nickname,
        avatar: info.avatar,
        userid: info.userid || sessions.value[p].userid,
        vipType: info.vipType || sessions.value[p].vipType || 0,
        vipEndTime: info.vipEndTime,
        listenCount: info.listenCount,
        fans: info.fans,
        follows: info.follows,
        vipInfo: vip,
      };
      sessions.value = { ...sessions.value, [p]: next };
      persist(p);
    } catch (e) {
      console.warn('[user] 获取资料失败', e.message);
    } finally {
      loading.value = false;
    }
  }

  /** 设备指纹注册（dfid），提升取流成功率 */
  async function ensureDevice(p = platformRef.value) {
    if (!sessions.value[p]?.token) return;
    try {
      const res = await rawCall(p, '/register/dev?timestamp=' + Date.now(), { method: 'POST' });
      const dfid = res?.body?.data?.dfid || res?.cookies?.find((c) => c.startsWith('dfid='))?.slice(5);
      if (dfid) {
        sessions.value = { ...sessions.value, [p]: { ...sessions.value[p], dfid } };
        persist(p);
      }
    } catch {}
  }

  async function loginByPhone(p, mobile, code) {
    const res = await rawCall(p, '/login/cellphone?timestamp=' + Date.now(), {
      method: 'POST',
      data: { mobile, code },
    });
    const data = res?.body?.data || {};
    if (!data.token) {
      throw new Error(res?.body?.error || res?.body?.msg || '登录失败，请检查验证码');
    }
    applyAuth(p, data, res.cookies);
    await afterLogin(p);
  }

  /** 账号密码登录 */
  async function loginByPassword(p, username, password) {
    const res = await rawCall(p, '/login?timestamp=' + Date.now(), {
      method: 'POST',
      data: { username, password },
    });
    const data = res?.body?.data || res?.body || {};
    if (!data.token) {
      throw new Error(res?.body?.error || res?.body?.msg || data?.error || '账号或密码错误');
    }
    applyAuth(p, data, res.cookies);
    await afterLogin(p);
  }

  async function loginByQr(p, key) {
    const res = await rawCall(p, `/login/qr/check?key=${encodeURIComponent(key)}&timestamp=${Date.now()}`);
    const data = res?.body?.data || {};
    if (data.status === 4 && data.token) {
      applyAuth(p, data, res.cookies);
      await afterLogin(p);
      return 4;
    }
    return Number(data.status || 0);
  }

  async function afterLogin(p) {
    await refreshProfile(p).catch(() => {});
    await ensureDevice(p);
    await refreshProfile(p).catch(() => {});
  }

  /** 手动填入 token（用于已有账号快速迁移） */
  async function loginByToken(p, token, userid) {
    applyAuth(p, { token, userid });
    await afterLogin(p);
  }

  function logout(p = platformRef.value) {
    sessions.value = { ...sessions.value, [p]: {} };
    localStorage.removeItem(KEY(p));
  }

  function switchPlatform(p) {
    platformRef.value = p;
    setRuntime({ platform: p, cookieProvider: (plat) => cookieOf(plat || p) });
  }

  return {
    sessions,
    session,
    platformRef,
    loading,
    isLogin,
    nickname,
    avatar,
    vipType,
    isVip,
    vipLabel,
    cookieOf,
    syncRuntime,
    refreshProfile,
    ensureDevice,
    initDevice,
    loginByPhone,
    loginByPassword,
    loginByQr,
    loginByToken,
    logout,
    switchPlatform,
    setPorts,
  };
});
