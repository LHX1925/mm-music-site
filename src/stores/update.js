import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { ElMessage } from 'element-plus';

const FALLBACK_ORIGIN = 'https://moin.shrtxs.cn';
/** 被「跳过此版本」忽略的版本号，红点不再为它亮起 */
const IGNORE_KEY = 'kg-update-ignored-v1';

/**
 * 在线更新状态
 * - check()   请求官网后台 /api.php?action=check
 * - download() 下载安装包（进度通过 IPC 推回来）
 * - install()  启动安装 / 自替换重启
 */
export const useUpdateStore = defineStore('update', () => {
  const version = ref('');
  const origin = ref(FALLBACK_ORIGIN);
  const portable = ref(false);
  /** 弹窗开关 */
  const visible = ref(false);
  const checking = ref(false);
  const checked = ref(false);
  const hasUpdate = ref(false);
  const force = ref(false);
  const latest = ref(null);
  const error = ref('');
  const site = ref(null);
  /** 有新版本且用户还没处理：标题栏 / 设置页的红点靠它驱动 */
  const badge = ref(false);
  const ignoredVersion = ref('');
  try {
    ignoredVersion.value = localStorage.getItem(IGNORE_KEY) || '';
  } catch {}

  const newVersion = computed(() => latest.value?.version || '');

  /** 只在「确实有新版 + 没被跳过」时亮红点；关掉弹窗不会清掉它 */
  function refreshBadge() {
    const v = newVersion.value;
    badge.value = Boolean(hasUpdate.value && v && v !== ignoredVersion.value);
  }

  const downloading = ref(false);
  const percent = ref(0);
  const speed = ref(0);
  const downloaded = ref(0);
  const total = ref(0);
  const filePath = ref('');
  const installing = ref(false);
  const done = ref(false);

  const notes = computed(() => {
    const n = latest.value?.notes;
    if (Array.isArray(n)) return n.filter(Boolean);
    return String(n || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  });
  const sizeText = computed(() => latest.value?.size || '');
  const siteUrl = computed(() => latest.value?.pageUrl || `${origin.value}/download.php`);
  const speedText = computed(() => {
    if (!speed.value) return '';
    const mb = speed.value / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(2)} MB/s` : `${Math.max(1, Math.round(speed.value / 1024))} KB/s`;
  });

  function api() {
    return typeof window !== 'undefined' ? window.kg?.updater : null;
  }

  async function init() {
    const u = api();
    if (!u) return;
    try {
      const info = await u.info();
      version.value = info?.version || '';
      origin.value = info?.origin || FALLBACK_ORIGIN;
      portable.value = Boolean(info?.portable);
    } catch {}
  }

  function reset() {
    error.value = '';
    percent.value = 0;
    speed.value = 0;
    downloaded.value = 0;
    total.value = 0;
    filePath.value = '';
    installing.value = false;
    done.value = false;
  }

  /** 直接消费主进程推来的检查结果（启动静默检查用，避免重复请求） */
  function applyResult(res) {
    if (!res?.ok || !res.hasUpdate) return false;
    checked.value = true;
    version.value = res.current || version.value;
    site.value = res.site || null;
    hasUpdate.value = true;
    force.value = Boolean(res.force);
    latest.value = res.latest || null;
    refreshBadge();
    reset();
    visible.value = true;
    return true;
  }

  /** 点红点随时把更新弹窗叫回来 */
  function openPanel() {
    if (!hasUpdate.value && !latest.value) {
      check({ silent: false });
      return;
    }
    visible.value = true;
  }

  /** 检查更新；silent=true 时无更新不打扰 */
  async function check({ silent = false, open = true } = {}) {
    if (checking.value) return null;
    const u = api();
    if (!u) {
      if (!silent) ElMessage.warning('当前环境不支持在线更新，请到官网下载最新版。');
      return null;
    }
    checking.value = true;
    error.value = '';
    try {
      const res = await u.check({ channel: 'stable' });
      checked.value = true;
      if (!res?.ok) {
        error.value = res?.error || '连接更新服务器失败';
        if (!silent) {
          ElMessage.error(`检查更新失败：${error.value}`);
        }
        return null;
      }
      version.value = res.current || version.value;
      site.value = res.site || null;
      hasUpdate.value = Boolean(res.hasUpdate);
      force.value = Boolean(res.force);
      latest.value = res.latest || null;
      refreshBadge();
      if (!res.hasUpdate) {
        if (!silent) ElMessage.success(`已是最新版本 v${res.current}`);
        return res;
      }
      reset();
      if (open) visible.value = true;
      return res;
    } catch (e) {
      error.value = String(e?.message || e);
      if (!silent) ElMessage.error(`检查更新失败：${error.value}`);
      return null;
    } finally {
      checking.value = false;
    }
  }

  async function download() {
    const u = api();
    if (!u || !latest.value) return;
    if (downloading.value) return;
    downloading.value = true;
    error.value = '';
    percent.value = 0;
    try {
      const url = portable.value
        ? latest.value.portableUrl || latest.value.installerUrl
        : latest.value.installerUrl || latest.value.portableUrl;
      const res = await u.download({
        url,
        version: latest.value.version,
        mode: portable.value ? 'portable' : 'installer',
      });
      if (!res?.ok) {
        if (res?.error === 'cancelled') {
          ElMessage.info('已取消下载');
        } else {
          error.value = res?.error || '下载失败';
          ElMessage.error(`下载失败：${error.value}`);
        }
        return;
      }
      filePath.value = res.path;
      percent.value = 100;
      done.value = true;
      ElMessage.success('安装包已下载完成');
    } catch (e) {
      error.value = String(e?.message || e);
      ElMessage.error(`下载失败：${error.value}`);
    } finally {
      downloading.value = false;
    }
  }

  async function install() {
    const u = api();
    if (!u || !filePath.value) return;
    installing.value = true;
    try {
      const res = await u.install({
        path: filePath.value,
        mode: portable.value ? 'portable' : 'installer',
        autoQuit: true,
      });
      if (!res?.ok) {
        installing.value = false;
        ElMessage.warning(res?.error || '无法自动安装，请在打开的文件夹中手动运行安装包。');
        return;
      }
      ElMessage.success(
        portable.value ? '正在替换为新版本，程序即将重启…' : '安装程序已启动，请按提示完成安装'
      );
      badge.value = false;
    } catch (e) {
      installing.value = false;
      ElMessage.error(String(e?.message || e));
    }
  }

  async function cancelDownload() {
    const u = api();
    if (!u) return;
    await u.cancel();
    downloading.value = false;
  }

  async function openSite() {
    const u = api();
    const url = siteUrl.value;
    if (u) await u.openPage(url);
    else window.open(url, '_blank');
  }

  async function reveal() {
    const u = api();
    if (u && filePath.value) await u.reveal(filePath.value);
    else if (filePath.value) ElMessage.info(filePath.value);
  }

  async function skip() {
    const u = api();
    const v = newVersion.value;
    if (u && v) await u.ignore(v);
    if (v) {
      ignoredVersion.value = v;
      try { localStorage.setItem(IGNORE_KEY, v); } catch {}
    }
    badge.value = false;
    visible.value = false;
  }

  function onProgress(p) {
    if (!p) return;
    downloading.value = true;
    percent.value = Math.max(0, Math.min(100, Number(p.percent) || 0));
    downloaded.value = Number(p.received) || 0;
    total.value = Number(p.total) || 0;
    speed.value = Number(p.speed) || 0;
  }

  function dismiss() {
    if (force.value) return;
    // 只关弹窗，红点保留：用户关掉弹窗后仍能看到「有新版本」的常驻提醒
    visible.value = false;
  }

  return {
    version,
    origin,
    portable,
    visible,
    checking,
    checked,
    hasUpdate,
    force,
    latest,
    error,
    site,
    badge,
    newVersion,
    downloading,
    percent,
    speed,
    downloaded,
    total,
    filePath,
    installing,
    done,
    notes,
    sizeText,
    siteUrl,
    speedText,
    init,
    reset,
    applyResult,
    openPanel,
    check,
    download,
    install,
    cancelDownload,
    openSite,
    reveal,
    skip,
    onProgress,
    dismiss,
  };
});
