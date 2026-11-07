/**
 * 萌萌音乐 · 在线更新模块
 *
 * 流程：
 *   1. GET  {origin}/api.php?action=check  拿最新版本信息（官网后台发布）
 *   2. GET  {installerUrl|portableUrl}     下载到系统临时目录，回传进度
 *   3. 启动安装程序（安装版）或自替换并重启（便携版）
 *
 * 只依赖 Electron 内置 net（自动走系统代理），不引入第三方依赖。
 */
const { app, net, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

/** 主站 + 备用站（任意一个能通即可完成检查） */
const DEFAULT_ORIGINS = ['https://www.lhx520.icu', 'https://moin.shrtxs.cn'];
const DEFAULT_ORIGIN = DEFAULT_ORIGINS[0];
const REQ_TIMEOUT = 15000;

let cfgRef = null;
let liveCfg = () => cfgRef || {};
let saveCfg = () => {};
let getWin = () => null;
/** 本次运行中真正连通的站点，后续请求优先用它，避免每次都等失效域名超时 */
let preferredOrigin = '';

/* ------------------------------ 工具 ------------------------------ */

/** 候选站点地址，用户自定义的优先，其次是本次已连通的站点 */
function origins() {
  const list = [];
  const custom = String(liveCfg()?.updateOrigin || '').trim();
  if (/^https?:\/\/[^\s]+$/i.test(custom)) list.push(custom.replace(/\/+$/, ''));
  if (preferredOrigin && !list.includes(preferredOrigin)) list.push(preferredOrigin);
  for (const o of DEFAULT_ORIGINS) if (!list.includes(o)) list.push(o);
  return list;
}

function origin() {
  return origins()[0];
}

function ua() {
  let v = '0.0.0';
  try {
    v = app.getVersion();
  } catch {}
  return `MengMengMusic/${v} (Windows NT 10.0; Win64; x64)`;
}

function send(channel, payload) {
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

/** 版本比较：a > b 返回 1 */
function cmpVersion(a, b) {
  const norm = (v) =>
    String(v || '0')
      .replace(/^v/i, '')
      .split(/[.\-+_]/)
      .map((x) => parseInt(x, 10) || 0);
  const A = norm(a);
  const B = norm(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i += 1) {
    const x = A[i] || 0;
    const y = B[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

function isPortable() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
}

/** 便携版对应的可执行文件（重启后要覆盖的目标） */
function portableExe() {
  return (
    process.env.PORTABLE_EXECUTABLE_FILE ||
    (app.isPackaged ? process.execPath : '')
  );
}

/* ------------------------------ HTTP ------------------------------ */

function request(url, { timeout = REQ_TIMEOUT, maxBytes = 2 * 1024 * 1024 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (payload) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(payload);
    };
    let req;
    try {
      req = net.request({ url, method: 'GET', redirect: 'follow', cache: 'no-store' });
    } catch (e) {
      return finish({ ok: false, error: String(e.message || e) });
    }
    const timer = setTimeout(() => {
      try {
        req.abort();
      } catch {}
      finish({ ok: false, error: 'timeout' });
    }, timeout);

    req.setHeader('User-Agent', ua());
    req.setHeader('Accept', 'application/json');
    req.on('error', (e) => finish({ ok: false, error: String(e.message || e) }));
    req.on('response', (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) {
          try {
            req.abort();
          } catch {}
          return finish({ ok: false, error: 'response too large' });
        }
        chunks.push(c);
      });
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        finish({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body });
      });
      res.on('error', (e) => finish({ ok: false, error: String(e.message || e) }));
    });
    req.end();
  });
}

/**
 * 检查更新
 * @returns {Promise<{ok:boolean,error?:string,data?:object}>}
 */
async function checkUpdate({ channel = 'stable', timeout } = {}) {
  const current = app.getVersion();
  const qs = new URLSearchParams({
    action: 'check',
    version: current,
    platform: 'win',
    channel,
    t: String(Date.now()),
  });
  let lastError = 'network error';
  for (const o of origins()) {
    const res = await request(`${o}/api.php?${qs.toString()}`, { timeout: timeout || REQ_TIMEOUT });
    if (!res.ok) {
      lastError = res.error || `HTTP ${res.status || 0}`;
      continue;
    }
    let json = null;
    try {
      json = JSON.parse(res.body);
    } catch {
      lastError = 'invalid json';
      continue;
    }
    const data = json?.data || {};
    const latest = data.latest || null;
    preferredOrigin = o;
    const hasUpdate = Boolean(data.hasUpdate) || (latest && cmpVersion(latest.version, current) > 0);
    return {
      ok: true,
      current,
      origin: o,
      ported: isPortable(),
      site: data.site || json?.data?.site || null,
      hasUpdate,
      force: Boolean(data.force || latest?.force),
      latest,
      checkedAt: new Date().toISOString(),
    };
  }
  return { ok: false, error: lastError, current, origin: origin() };
}

/* ------------------------------ 下载 ------------------------------ */

let activeDownload = null;

function safeName(url, fallback) {
  try {
    const clean = decodeURIComponent(String(url).split('?')[0].split('#')[0]);
    const base = clean.split('/').filter(Boolean).pop() || '';
    if (base && /\.(exe|zip|7z)$/i.test(base)) return base.replace(/[\\/:*?"<>|]/g, '_');
  } catch {}
  return fallback;
}

function updateDir() {
  return path.join(app.getPath('temp'), 'mm-music-update');
}

/** 小于 1MB 的 exe 一定是错误页或空文件，直接判定失败 */
const MIN_EXE_BYTES = 1024 * 1024;

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/** 把下载地址换到另一个站点，用于域名失效时兜底 */
function swapOrigin(url, next) {
  try {
    const u = new URL(url);
    const n = new URL(next);
    u.protocol = n.protocol;
    u.host = n.host;
    return u.toString();
  } catch {
    return url;
  }
}

/** exe 头必须是 MZ，能挡住把 HTML 错误页存成 exe 的情况 */
function looksLikeExe(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    return buf[0] === 0x4d && buf[1] === 0x5a;
  } catch {
    return false;
  }
}

function cleanupFile(file) {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}

/**
 * 单次下载尝试（内部使用）
 * 只有校验通过才会把 .part 改名为正式文件，失败时不会留下 0 字节 exe
 */
function downloadOnce(url, file, part, opts) {
  return new Promise((resolve) => {
    let done = false;
    let lastEmit = 0;
    let received = 0;
    let total = 0;
    const startedAt = Date.now();
    let timer = null;

    const finish = (payload) => {
      if (done) return;
      done = true;
      activeDownload = null;
      clearTimeout(timer);
      resolve(payload);
    };

    let req;
    try {
      req = net.request({ url, method: 'GET', redirect: 'follow', cache: 'no-store' });
    } catch (e) {
      return finish({ ok: false, error: String(e.message || e) });
    }
    activeDownload = req;

    timer = setTimeout(
      () => {
        try {
          req.abort();
        } catch {}
        finish({ ok: false, error: '下载超时，请检查网络后重试。', retryable: true });
      },
      1000 * 60 * 30
    );

    req.setHeader('User-Agent', ua());
    req.setHeader('Accept', 'application/octet-stream,*/*');
    req.on('error', (e) => finish({ ok: false, error: String(e.message || e), retryable: true }));
    req.on('abort', () => finish({ ok: false, error: 'cancelled' }));

    req.on('response', (res) => {
      const code = res.statusCode;
      if (code !== 200 && code !== 206) {
        try {
          res.resume();
        } catch {}
        const error =
          code === 404
            ? '安装包不存在（HTTP 404），服务器上可能还没有这个版本'
            : `下载失败（HTTP ${code}）`;
        return finish({ ok: false, error, retryable: code === 404 || code === 403 || code >= 500 });
      }

      total = parseInt(res.headers['content-length'] || '0', 10) || 0;
      if (total && total < MIN_EXE_BYTES) {
        try {
          res.resume();
        } catch {}
        return finish({ ok: false, error: `安装包体积异常（${total} 字节），服务器文件不完整`, retryable: true });
      }

      const ws = fs.createWriteStream(part);
      ws.on('error', (e) => finish({ ok: false, error: String(e.message || e) }));

      res.on('data', (chunk) => {
        received += chunk.length;
        ws.write(chunk);
        const now = Date.now();
        if (now - lastEmit > 180) {
          lastEmit = now;
          const secs = Math.max(0.4, (now - startedAt) / 1000);
          send('update:progress', {
            received,
            total,
            percent: total ? Math.min(99, Math.round((received / total) * 100)) : 0,
            speed: Math.round(received / secs),
          });
        }
      });

      res.on('end', () => {
        ws.end(() => {
          if (received < MIN_EXE_BYTES) {
            cleanupFile(part);
            return finish({ ok: false, error: `只下载到 ${received} 字节，服务器没有返回安装包`, retryable: true });
          }
          if (total && received !== total) {
            cleanupFile(part);
            return finish({ ok: false, error: '下载不完整，请重试', retryable: true });
          }
          if (!looksLikeExe(part)) {
            cleanupFile(part);
            return finish({ ok: false, error: '下载到的文件不是有效的 Windows 安装包', retryable: true });
          }
          try {
            fs.renameSync(part, file);
          } catch (e) {
            return finish({ ok: false, error: String(e.message || e) });
          }
          send('update:progress', { received, total: total || received, percent: 100, speed: 0 });
          finish({ ok: true, path: file, mode: opts.mode === 'portable' ? 'portable' : 'installer', version: opts.version || '' });
        });
      });

      res.on('error', (e) => {
        try {
          ws.destroy();
        } catch {}
        cleanupFile(part);
        finish({ ok: false, error: String(e.message || e), retryable: true });
      });
    });

    req.end();
  });
}

/**
 * 下载安装包
 *
 * 校验：HTTP 状态、content-length、实际字节数、exe 头（MZ）
 * 兜底：当前域名 404 / 文件不完整时，自动换下一个站点重试同一路径
 * @param {{url:string, version?:string, mode?:'installer'|'portable'}} opts
 */
async function downloadUpdate(opts = {}) {
  const rawUrl = String(opts.url || '');
  if (!/^https?:\/\//i.test(rawUrl)) {
    return { ok: false, error: '安装包地址无效，请到官网手动下载。' };
  }
  const mode = opts.mode === 'portable' ? 'portable' : 'installer';
  const dir = updateDir();
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch {}

  const fallback = `mengmeng-music-${opts.version || app.getVersion()}-${mode}.exe`;
  const file = path.join(dir, safeName(rawUrl, fallback));
  const part = `${file}.part`;

  if (activeDownload) {
    try {
      activeDownload.abort();
    } catch {}
    activeDownload = null;
  }

  // 之前失败留下的 0 字节文件会让用户双击到一个坏 exe，先清掉
  try {
    if (fs.existsSync(file) && fs.statSync(file).size < MIN_EXE_BYTES) cleanupFile(file);
  } catch {}
  cleanupFile(part);

  const candidates = [];
  const push = (u) => {
    if (!u) return;
    const o = originOf(u);
    if (candidates.some((x) => originOf(x) === o)) return;
    candidates.push(u);
  };
  push(rawUrl);
  for (const o of origins()) push(swapOrigin(rawUrl, o));

  let lastError = '下载失败，请稍后重试';
  for (const url of candidates) {
    const r = await downloadOnce(url, file, part, opts);
    if (r.ok) return r;
    lastError = r.error || lastError;
    if (r.error === 'cancelled') return r;
    cleanupFile(part);
    try {
      if (fs.existsSync(file) && fs.statSync(file).size < MIN_EXE_BYTES) cleanupFile(file);
    } catch {}
    send('update:progress', { received: 0, total: 0, percent: 0, speed: 0 });
  }
  return { ok: false, error: lastError };
}

/* ------------------------------ 安装 ------------------------------ */

function psQuote(p) {
  return `'${String(p).replace(/'/g, "''")}'`;
}

/** 便携版：等本进程退出后覆盖旧的 exe，再启动 */
async function replacePortable(newFile) {
  const target = portableExe();
  if (!target || !fs.existsSync(target)) {
    return { ok: false, error: '找不到当前便携版程序，请手动替换。' };
  }
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$oldPid = ${process.pid}`,
    `$src = ${psQuote(newFile)}`,
    `$dst = ${psQuote(target)}`,
    'for ($i = 0; $i -lt 150; $i++) {',
    '  if (-not (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) { break }',
    '  Start-Sleep -Milliseconds 400',
    '}',
    'Start-Sleep -Milliseconds 600',
    `Copy-Item -LiteralPath $src -Destination $dst -Force`,
    `Start-Process -FilePath $dst`,
    'Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force',
  ].join('\r\n');

  const ps1 = path.join(updateDir(), `apply-${Date.now()}.ps1`);
  await fsp.writeFile(ps1, `\ufeff${script}`, 'utf8');
  spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1],
    { detached: true, stdio: 'ignore', windowsHide: true }
  ).unref();
  return { ok: true };
}

/**
 * 启动安装
 * @param {{path:string, mode?:string, autoQuit?:boolean}} opts
 */
async function installUpdate(opts = {}) {
  const file = String(opts.path || '');
  if (!file || !fs.existsSync(file)) {
    return { ok: false, error: '安装包不存在，请重新下载。' };
  }
  const mode = opts.mode === 'portable' ? 'portable' : 'installer';
  try {
    if (mode === 'portable') {
      const r = await replacePortable(file);
      if (!r.ok) {
        shell.showItemInFolder(file);
        return r;
      }
      if (opts.autoQuit !== false) setTimeout(() => quitNow(), 700);
      return { ok: true, mode };
    }
    // 安装版：直接拉起 NSIS 安装程序，用户按提示完成即可覆盖安装
    const child = spawn(file, [], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    if (opts.autoQuit !== false) setTimeout(() => quitNow(), 1200);
    return { ok: true, mode };
  } catch (e) {
    shell.showItemInFolder(file);
    return { ok: false, error: String(e.message || e) };
  }
}

function quitNow() {
  try {
    app.isQuiting = true;
  } catch {}
  try {
    app.quit();
  } catch {
    process.exit(0);
  }
}

/* ------------------------------ 注册 ------------------------------ */

function register({ getConfig, saveConfig, getWindow }) {
  const readCfg = typeof getConfig === 'function' ? getConfig : () => ({});
  liveCfg = readCfg;
  cfgRef = readCfg() || {};
  saveCfg = saveConfig || (() => {});
  getWin = getWindow || (() => null);

  ipcMain.handle('update:info', () => ({
    version: app.getVersion(),
    origin: origin(),
    portable: isPortable(),
    updateDir: updateDir(),
  }));

  ipcMain.handle('update:check', async (_e, opts) => checkUpdate(opts || {}));

  ipcMain.handle('update:download', async (_e, opts) => {
    const r = await downloadUpdate(opts || {});
    return r;
  });

  ipcMain.handle('update:cancel', () => {
    if (activeDownload) {
      try {
        activeDownload.abort();
      } catch {}
      activeDownload = null;
      return true;
    }
    return false;
  });

  ipcMain.handle('update:install', async (_e, opts) => installUpdate(opts || {}));

  ipcMain.handle('update:openPage', async (_e, url) => {
    const target = /^https?:\/\//i.test(String(url || '')) ? String(url) : `${origin()}/download.php`;
    shell.openExternal(target);
    return true;
  });

  ipcMain.handle('update:reveal', (_e, file) => {
    if (file && fs.existsSync(file)) shell.showItemInFolder(file);
    return true;
  });

  /** 记录「跳过此版本」 */
  ipcMain.handle('update:ignore', (_e, version) => {
    const next = { ...(liveCfg() || {}), skipUpdateVersion: String(version || '') };
    cfgRef = next;
    saveCfg(next);
    return next.skipUpdateVersion;
  });
}

/** 启动后静默检查一次（15 秒后，避开启动高峰） */
function scheduleSilentCheck(delay = 15000) {
  setTimeout(async () => {
    try {
      const cfg = liveCfg() || {};
      if (cfg.updateAutoCheck === false) return;
      const r = await checkUpdate({ channel: 'stable', timeout: 10000 });
      if (!r.ok || !r.hasUpdate) return;
      if (cfg.skipUpdateVersion && r.latest?.version === cfg.skipUpdateVersion) return;
      send('update:available', r);
    } catch {}
  }, delay);
}

module.exports = {
  DEFAULT_ORIGIN,
  cmpVersion,
  isPortable,
  checkUpdate,
  downloadUpdate,
  installUpdate,
  register,
  scheduleSilentCheck,
};
