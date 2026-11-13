/**
 * 萌萌音乐 - Electron 主进程
 *
 * 职责：
 * 1. 创建无边框主窗口（自绘标题栏）
 * 2. 托管 KuGouMusicApi 的两个实例：标准版(酷狗音乐) / 概念版(lite)
 * 3. 提供静态资源服务与本地音乐流媒体服务（支持 Range 断点播放）
 * 4. 下载管理、本地文件扫描、系统能力桥接
 */
const { app, BrowserWindow, ipcMain, shell, dialog, protocol, net, Tray, Menu, powerSaveBlocker, globalShortcut, nativeImage, screen, session, desktopCapturer } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const tcp = require('node:net');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const updater = require('./updater.cjs');

const APP_NAME = '萌萌音乐';
const LEGACY_APP_NAME = 'kugou-music-desktop';

// 改名后保持旧数据目录，避免登录态、收藏、设置全部丢失
try {
  const legacyDir = path.join(app.getPath('appData'), LEGACY_APP_NAME);
  app.setName(APP_NAME);
  if (fs.existsSync(path.join(legacyDir, 'kg-config.json'))) {
    app.setPath('userData', legacyDir);
  }
} catch {}

/**
 * 给任意窗口挂上调试快捷键：F12 / Ctrl+Shift+I 开关 DevTools
 * 关闭窗口时把 DevTools 一起收掉，避免留下空白的调试窗口
 */
function attachDevTools(win) {
  if (!win) return;
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const isF12 = input.key === 'F12';
    const isInspector = (input.control || input.meta) && input.shift && String(input.key).toLowerCase() === 'i';
    const isReload = (input.control || input.meta) && String(input.key).toLowerCase() === 'r';
    if (isF12 || isInspector) {
      e.preventDefault();
      if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
      else win.webContents.openDevTools({ mode: 'detach', activate: true });
    } else if (isReload && input.shift) {
      e.preventDefault();
      win.webContents.reloadIgnoringCache();
    }
  });
  win.on('closed', () => {
    try {
      if (!win.webContents.isDestroyed() && win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
    } catch {}
  });
}

/**
 * 辅助窗口（桌面歌词 / 托盘面板 / 任务栏歌词）一律静音。
 * 这些窗口只做展示，播放由主窗口负责；万一渲染端异常地去初始化播放器，
 * 静音也能兜底，确保不会出现「看不见的窗口在后台唱歌」。
 */
function muteAuxWindow(win) {
  if (!win || win.isDestroyed()) return win;
  try {
    win.webContents.setAudioMuted(true);
  } catch {}
  win.webContents.on('did-finish-load', () => {
    try {
      win.webContents.setAudioMuted(true);
    } catch {}
  });
  return win;
}

/** 应用图标（打包后位于 resources/icon.png） */
function iconPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }
  return '';
}

const isDev = !app.isPackaged;
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || '';
/** 开机自启传入 --hidden，启动后直接进托盘不弹窗 */
const START_HIDDEN = process.argv.includes('--hidden');

/** 用户配置（设备指纹、端口、下载目录等）持久化文件 */
const configPath = () => path.join(app.getPath('userData'), 'kg-config.json');

const defaultConfig = () => ({
  // 标准版
  std: { port: 32100, guid: crypto.randomUUID(), dev: randomDev(), mac: '02:00:00:00:00:01', webgl: randomWebgl() },
  // 概念版
  lite: { port: 32101, guid: crypto.randomUUID(), dev: randomDev(), mac: '02:00:00:00:00:02', webgl: randomWebgl() },
  downloadDir: path.join(app.getPath('downloads'), '萌萌音乐'),
  localDirs: [],
  proxy: '',
  apiDir: '',
  uiPort: 32190,
  nativeFrame: false,
  startMinimized: false,
  closeToTray: true,
  autoStart: false,
  gpuDisabled: false,
  highDpi: false,
  preventSleep: false,
  disableThrottle: false,
  globalShortcut: false,
  background: { type: 'none', path: '' },
  // 在线更新
  updateOrigin: 'https://moin.shrtxs.cn',
  updateAutoCheck: true,
  skipUpdateVersion: '',
});

function randomDev() {
  return crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 10);
}
function randomWebgl() {
  return String(Math.floor(Math.random() * 9e18) + 1e18).slice(0, 19);
}

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    const base = defaultConfig();
    // 旧版本把更新源写成了 www.lhx520.icu，该域名已失效，读到就换成现在的官网
    if (/lhx520\.icu/i.test(String(raw.updateOrigin || ''))) raw.updateOrigin = base.updateOrigin;
    const cfg = {
      ...base,
      ...raw,
      std: { ...base.std, ...(raw.std || {}) },
      lite: { ...base.lite, ...(raw.lite || {}) },
    };
    // 「关闭窗口最小化到托盘」改为默认开启：老配置里存着 false 的，升级后强制打开一次
    if (!cfg.trayDefaultApplied) {
      cfg.closeToTray = true;
      cfg.trayDefaultApplied = true;
      writeConfig(cfg);
    }
    return cfg;
  } catch {
    const cfg = defaultConfig();
    try {
      fs.mkdirSync(path.dirname(configPath()), { recursive: true });
      fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
    } catch {}
    return cfg;
  }
}

function writeConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('[config] write failed', e);
  }
}

let config = readConfig();

/** 解析 KuGouMusicApi 目录 */
function resolveApiDir() {
  if (config.apiDir && fs.existsSync(path.join(config.apiDir, 'app.js'))) return config.apiDir;
  if (process.env.KUGOU_API_DIR && fs.existsSync(path.join(process.env.KUGOU_API_DIR, 'app.js'))) {
    return process.env.KUGOU_API_DIR;
  }
  const candidates = [
    path.join(process.resourcesPath || '', 'kugou-api'),
    path.join(app.getAppPath(), '..', 'KuGouMusicApi-1.6.3'),
    path.join(app.getAppPath(), 'kugou-api'),
    path.join(process.cwd(), '..', 'KuGouMusicApi-1.6.3'),
  ];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(path.join(c, 'app.js'))) return path.resolve(c);
    } catch {}
  }
  return '';
}

let apiDir = '';
const servers = { std: null, lite: null };
const serverStatus = { std: { ready: false, port: 0, error: '' }, lite: { ready: false, port: 0, error: '' } };

/** 探测端口是否被占用 */
function isPortBusy(port) {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.once('error', (e) => resolve(e.code === 'EADDRINUSE'));
    srv.once('listening', () => srv.close(() => resolve(false)));
    srv.listen(port, '127.0.0.1');
  });
}

/** 已被本进程占用的端口，避免两个平台实例抢同一端口 */
const reservedPorts = new Set();

async function pickPort(start) {
  let port = start;
  for (let i = 0; i < 60; i++) {
    if (reservedPorts.has(port)) {
      port += 1;
      continue;
    }
    // 先同步占位，再异步探测，避免并发启动时两个平台拿到同一端口
    reservedPorts.add(port);
    if (!(await isPortBusy(port))) return port;
    reservedPorts.delete(port);
    port += 1;
  }
  return start;
}

/** 轮询等待 API 服务就绪 */
function waitServer(port, timeout = 25000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      // 仅探测 TCP 端口是否可连，避免向酷狗发起无意义请求（/ip 缺少参数会返回 20010）
      const sock = tcp.connect({ host: '127.0.0.1', port });
      sock.setTimeout(2000);
      sock.once('connect', () => {
        sock.destroy();
        resolve(true);
      });
      const retry = () => {
        sock.destroy();
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(tick, 350);
      };
      sock.once('error', retry);
      sock.once('timeout', retry);
    };
    tick();
  });
}

/**
 * 启动一个 API 实例
 * @param {'std'|'lite'} platform 平台标识
 */
async function startApi(platform) {
  if (!apiDir) {
    serverStatus[platform].error = '未找到 KuGouMusicApi 目录，请在设置中指定';
    return serverStatus[platform];
  }
  if (servers[platform]) return serverStatus[platform];

  const cfg = config[platform];
  const port = await pickPort(cfg.port);
  // 先占位，避免并发启动的另一个平台抢到同一端口
  serverStatus[platform].port = port;
  serverStatus[platform].ready = false;
  const env = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    KUGOU_API_GUID: cfg.guid,
    KUGOU_API_DEV: cfg.dev,
    KUGOU_API_MAC: cfg.mac,
    KUGOU_API_WEBGL: cfg.webgl,
    platform: platform === 'lite' ? 'lite' : '',
    // 关键：以 Node 模式运行 Electron 自身作为 API 运行时，打包后无需额外安装 Node
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
  };
  if (config.proxy) env.KUGOU_API_PROXY = config.proxy;
  // 避免继承到外部调试代理，导致请求被劫持
  delete env.HTTP_PROXY;
  delete env.HTTPS_PROXY;
  delete env.http_proxy;
  delete env.https_proxy;

  const args = [path.join(apiDir, 'app.js')];
  if (platform === 'lite') args.push('--platform=lite');

  const child = spawn(process.execPath, args, { cwd: apiDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  servers[platform] = child;

  child.stdout.on('data', (d) => {
    if (isDev) process.stdout.write(`[api:${platform}] ${d}`);
  });
  child.stderr.on('data', (d) => process.stderr.write(`[api:${platform}:err] ${d}`));
  child.on('exit', (code) => {
    servers[platform] = null;
    reservedPorts.delete(port);
    serverStatus[platform].ready = false;
    if (code !== 0 && code !== null) {
      serverStatus[platform].error = `API 进程退出（code ${code}）`;
      mainWindow?.webContents.send('server:status', serverStatus);
    }
  });

  const alive = await waitServer(port);
  const ok = alive && child.exitCode === null;
  Object.assign(serverStatus[platform], { ready: ok, error: ok ? '' : child.exitCode !== null ? 'API 进程启动失败' : 'API 启动超时' });
  mainWindow?.webContents.send('server:status', serverStatus);
  console.log(`[api:${platform}] ready=${ok} http://127.0.0.1:${port}`);
  return serverStatus[platform];
}

async function stopApis() {
  for (const key of Object.keys(servers)) {
    const p = servers[key];
    if (!p) continue;
    try {
      p.kill();
    } catch {}
    servers[key] = null;
    serverStatus[key].ready = false;
  }
}

/* ------------------------------------------------------------------ */
/* 本地静态服务（打包后加载页面）+ 本地音乐流服务（支持 Range）           */
/* ------------------------------------------------------------------ */
let localServerPort = 0;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ape': 'audio/x-ape',
};

function startLocalServer() {
  const distDir = path.join(app.getAppPath(), 'dist');
  const srv = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      // 本地音乐流
      if (url.pathname === '/__media') {
        const file = Buffer.from(url.searchParams.get('p') || '', 'base64').toString('utf8');
        return serveFile(req, res, file);
      }
      // 静态资源
      let filePath = path.normalize(path.join(distDir, decodeURIComponent(url.pathname)));
      if (!filePath.startsWith(distDir)) return res.writeHead(403).end();
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }
      return serveFile(req, res, filePath);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });

  // 固定端口：localStorage（登录态、收藏、设置）按 origin 隔离，
  // 端口固定才能保证重启后数据不丢失
  const startPort = config.uiPort || 32190;
  return new Promise((resolve) => {
    let attempt = 0;
    const tryListen = (port) => {
      srv.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempt < 20) {
          attempt += 1;
          tryListen(port + 1);
        } else {
          resolve(0);
        }
      });
      srv.listen(port, '127.0.0.1', () => {
        localServerPort = srv.address().port;
        if (config.uiPort !== localServerPort) {
          config.uiPort = localServerPort;
          writeConfig(config);
        }
        resolve(localServerPort);
      });
    };
    tryListen(startPort);
  });
}

function serveFile(req, res, file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (Number.isNaN(start) || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
      return;
    }
    end = Math.min(end, stat.size - 1);
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------------ */
/* 下载管理                                                            */
/* ------------------------------------------------------------------ */
const downloads = new Map();

function uniqueFile(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let target = path.join(dir, name);
  let i = 1;
  while (fs.existsSync(target)) {
    target = path.join(dir, `${base} (${i})${ext}`);
    i += 1;
  }
  return target;
}

/**
 * 下载歌曲
 * 支持传入多个候选地址（url / urls / backupUrl），逐个尝试并自动回退到 Node http(s)，
 * 全部失败时把失败原因回传给渲染进程，避免「点了没反应」。
 */
function downloadSong(payload) {
  const { url, urls, filename, meta } = payload || {};
  const candidates = [...new Set([url, ...(Array.isArray(urls) ? urls : [])].filter(Boolean))];
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const dir = config.downloadDir;
    const safeName = String(filename || 'audio.mp3').replace(/[\\/:*?"<>|]/g, '_');
    const task = { id, name: safeName, path: '', size: 0, received: 0, status: 'downloading', meta };
    downloads.set(id, task);
    mainWindow?.webContents.send('download:update', task);

    let settled = false;
    let out = null;
    const finish = (ok, msg) => {
      if (settled) return;
      settled = true;
      try {
        out?.destroy();
      } catch {}
      if (ok) {
        task.status = 'done';
        try {
          fs.writeFileSync(`${task.path}.json`, JSON.stringify(meta || {}, null, 2));
        } catch {}
      } else {
        task.status = 'error';
        task.error = msg || '下载失败';
        // 失败时删掉半成品，避免本地库里出现损坏文件
        try {
          if (task.path) fs.unlinkSync(task.path);
        } catch {}
      }
      mainWindow?.webContents.send('download:update', task);
      resolve(task);
    };

    if (!candidates.length) return finish(false, '没有可用的下载地址');

    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      return finish(false, `无法创建下载目录：${e.message}`);
    }
    task.path = uniqueFile(dir, safeName);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      Referer: 'https://www.kugou.com/',
      Accept: '*/*',
    };

    const tryIndex = (i, lastError) => {
      if (i >= candidates.length) return finish(false, lastError || '所有下载地址都不可用');
      const link = candidates[i];
      let request;
      try {
        request = net.request({ url: link, redirect: 'follow' });
      } catch (e) {
        return tryIndex(i + 1, String(e));
      }
      let connected = false;
      request.setHeader('User-Agent', headers['User-Agent']);
      request.setHeader('Referer', headers.Referer);
      request.setHeader('Accept', headers.Accept);
      request.on('response', (response) => {
        if (response.statusCode >= 400) {
          response.resume();
          return tryIndex(i + 1, `HTTP ${response.statusCode}`);
        }
        connected = true;
        task.size = Number(response.headers['content-length'] || 0);
        out = fs.createWriteStream(task.path);
        response.on('data', (chunk) => {
          task.received += chunk.length;
          out.write(chunk);
          mainWindow?.webContents.send('download:progress', { id: task.id, received: task.received, size: task.size });
        });
        response.on('end', () => {
          out.end(() => finish(task.received > 0, '文件为空，可能已失效'));
        });
        response.on('error', (e) => tryIndex(i + 1, String(e)));
      });
      request.on('error', (e) => {
        if (!connected) tryIndex(i + 1, String(e));
        else finish(false, String(e));
      });
      request.end();
    };

    tryIndex(0, '');
  });
}

/* ------------------------------------------------------------------ */
/* 托盘图标（运行时生成 32x32 PNG，避免依赖外部资源文件）                 */
/* ------------------------------------------------------------------ */
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** 生成圆角方块 + 音符形状的简易图标 */
function makeTrayIcon(size = 32) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const d = Math.hypot(x - cx, y - cy);
      // 圆角方形：取到中心的最大轴距
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const inside = Math.max(dx, dy) < r * 0.94 || d < r;
      const noteDot = Math.hypot(x - size * 0.36, y - size * 0.68) < size * 0.1 || Math.hypot(x - size * 0.66, y - size * 0.6) < size * 0.1;
      const noteStem = (x > size * 0.44 && x < size * 0.56 && y > size * 0.24 && y < size * 0.62) ||
        (x > size * 0.62 && x < size * 0.74 && y > size * 0.2 && y < size * 0.56);
      const noteBar = x > size * 0.44 && x < size * 0.72 && y > size * 0.22 && y < size * 0.32;
      if (!inside) {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0;
      } else if (noteDot || noteStem || noteBar) {
        raw[i] = 255;
        raw[i + 1] = 255;
        raw[i + 2] = 255;
        raw[i + 3] = 255;
      } else {
        raw[i] = 0;
        raw[i + 1] = 210;
        raw[i + 2] = 106;
        raw[i + 3] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return nativeImage.createFromBuffer(png);
}

/* ------------------------------------------------------------------ */
/* 托盘（自定义弹窗：歌曲信息 + 歌词 + 播放控制 + 菜单）                 */
/* ------------------------------------------------------------------ */
let tray = null;
let trayWindow = null;
let trayData = {};

function setupTray() {
  if (tray) return tray;
  try {
    const file = iconPath();
    const img = file ? nativeImage.createFromPath(file).resize({ width: 32, height: 32 }) : makeTrayIcon(32);
    tray = new Tray(img);
    tray.setToolTip(`${APP_NAME} · 单击显示控制面板`);
    tray.on('click', () => toggleTrayPanel());
    tray.on('right-click', () => showTrayPanel());
    tray.on('double-click', () => showMainWindow());
  } catch (e) {
    console.error('[tray]', e);
  }
  return tray;
}

function createTrayWindow() {
  if (trayWindow && !trayWindow.isDestroyed()) return trayWindow;
  const base = (mainWindow?.webContents.getURL() || `http://127.0.0.1:${localServerPort}/`).split('#')[0];
  trayWindow = new BrowserWindow({
    width: 302,
    height: 392,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    title: `${APP_NAME} 控制面板`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  trayWindow.loadURL(`${base}#/tray`);
  attachDevTools(trayWindow);
  muteAuxWindow(trayWindow);
  trayWindow.on('blur', () => {
    if (trayWindow && !trayWindow.isDestroyed()) trayWindow.hide();
  });
  trayWindow.on('closed', () => {
    trayWindow = null;
  });
  return trayWindow;
}

function showTrayPanel() {
  const win = createTrayWindow();
  if (trayData && Object.keys(trayData).length) win.webContents.send('tray:data', trayData);
  const { width, height } = win.getBounds();
  const anchor = tray?.getBounds?.() || { x: 0, y: 0, width: 0, height: 0 };
  const cursor = screen.getCursorScreenPoint();
  const anchorX = anchor.width ? anchor.x + anchor.width / 2 : cursor.x;
  const anchorY = anchor.height ? anchor.y : cursor.y;
  const display = screen.getDisplayNearestPoint({ x: Math.round(anchorX), y: Math.round(anchorY) });
  const wa = display.workArea;
  let x = Math.round(anchorX - width / 2);
  let y = Math.round(anchorY - height - 10);
  if (y < wa.y + 8) y = Math.round(anchorY + anchor.height + 10);
  x = Math.min(Math.max(x, wa.x + 8), wa.x + wa.width - width - 8);
  y = Math.min(Math.max(y, wa.y + 8), wa.y + wa.height - height - 8);
  win.setPosition(x, y, false);
  win.show();
  win.focus();
}

function toggleTrayPanel() {
  if (trayWindow && !trayWindow.isDestroyed() && trayWindow.isVisible()) trayWindow.hide();
  else showTrayPanel();
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** 真正退出：先销毁所有辅助窗口，避免 window-all-closed 不触发 */
function quitApp() {
  app.isQuiting = true;
  try {
    closeLyricWindow();
  } catch {}
  if (trayWindow && !trayWindow.isDestroyed()) trayWindow.destroy();
  trayWindow = null;
  stopBarWatchdog();
  if (barWindow && !barWindow.isDestroyed()) barWindow.destroy();
  barWindow = null;
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
}

/* ------------------------------------------------------------------ */
/* 桌面歌词窗口                                                         */
/* ------------------------------------------------------------------ */
let lyricWindow = null;

function createLyricWindow() {
  if (lyricWindow) {
    lyricWindow.show();
    return lyricWindow;
  }
  const uiUrl = mainWindow?.webContents.getURL() || `http://127.0.0.1:${localServerPort}/`;
  lyricWindow = new BrowserWindow({
    width: 900,
    height: 190,
    minWidth: 460,
    minHeight: 130,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    title: '桌面歌词',
    ...(iconPath() ? { icon: iconPath() } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  const base = uiUrl.split('#')[0];
  lyricWindow.loadURL(`${base}#/desktop-lyric`);
  attachDevTools(lyricWindow);
  muteAuxWindow(lyricWindow);
  lyricWindow.once('ready-to-show', () => lyricWindow.show());
  lyricWindow.setAlwaysOnTop(true, 'screen-saver');
  lyricWindow.on('closed', () => {
    lyricWindow = null;
    mainWindow?.webContents.send('lyric:closed');
  });
  return lyricWindow;
}

function closeLyricWindow() {
  if (lyricWindow) {
    lyricWindow.close();
    lyricWindow = null;
  }
}

/* ------------------------------------------------------------------ */
/* 任务栏歌词条（贴在任务栏上方，显示封面 + 歌词 + 控制）                 */
/* ------------------------------------------------------------------ */
let barWindow = null;

/** 任务栏歌词位置模式：taskbar=与任务栏重叠；screen=贴屏幕最底部，浮在任务栏上方 */
let barPos = 'taskbar';

function setBarPos(pos) {
  barPos = pos === 'screen' ? 'screen' : 'taskbar';
}

/** 估算 Windows 任务栏所在的矩形（默认底部，其次顶部） */
function taskbarRect() {
  const d = screen.getPrimaryDisplay();
  const b = d.bounds;
  const wa = d.workArea;
  // 底部任务栏
  if (wa.y === b.y && b.height - wa.height >= 20) {
    return { x: b.x, y: wa.y + wa.height, width: b.width, height: b.height - wa.height };
  }
  // 顶部任务栏
  if (wa.y - b.y >= 20) {
    return { x: b.x, y: b.y, width: b.width, height: wa.y - b.y };
  }
  // 自动隐藏 / 无法判断：贴屏幕最底部
  const h = 48;
  return { x: b.x, y: b.y + b.height - h, width: b.width, height: h };
}

/** 歌词条直接压在任务栏上（与任务栏重叠），而不是浮在它上方 */
function positionBarWindow() {
  if (!barWindow || barWindow.isDestroyed()) return;

  // 模式二：贴在屏幕最底部，但整体浮在任务栏上方
  if (barPos === 'screen') {
    const d = screen.getPrimaryDisplay();
    const wa = d.workArea;
    const [w] = barWindow.getSize();
    const h = 44;
    barWindow.setSize(w, h, false);
    barWindow.setPosition(
      Math.round(wa.x + (wa.width - w) / 2),
      Math.round(wa.y + wa.height - h - 8),
      false
    );
    return;
  }

  const t = taskbarRect();
  const [w] = barWindow.getSize();
  const h = Math.max(34, Math.min(60, Math.round(t.height - 6)));
  barWindow.setSize(w, h, false);
  barWindow.setPosition(
    Math.round(t.x + (t.width - w) / 2),
    Math.round(t.y + Math.max(0, (t.height - h) / 2)),
    false
  );
}

function createBarWindow() {
  if (barWindow && !barWindow.isDestroyed()) return barWindow;
  const base = (mainWindow?.webContents.getURL() || `http://127.0.0.1:${localServerPort}/`).split('#')[0];
  barWindow = new BrowserWindow({
    width: 480,
    height: 44,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    title: `${APP_NAME} 任务栏歌词`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  barWindow.loadURL(`${base}#/taskbar`);
  attachDevTools(barWindow);
  muteAuxWindow(barWindow);
  barWindow.setAlwaysOnTop(true, 'screen-saver');
  // 默认鼠标穿透：点击直接落到下面的任务栏，只有悬停到按钮上才由渲染进程接管
  barWindow.setIgnoreMouseEvents(true, { forward: true });
  barWindow.once('ready-to-show', () => {
    positionBarWindow();
    barWindow.showInactive();
  });
  barWindow.on('closed', () => {
    barWindow = null;
    mainWindow?.webContents.send('bar:closed');
  });
  return barWindow;
}

/** 重新把歌词条抬到最上层（任务栏/开始菜单会把它压到下面） */
function raiseBar() {
  if (!barWindow || barWindow.isDestroyed() || !barWindow.isVisible()) return;
  try {
    barWindow.setAlwaysOnTop(false);
    barWindow.setAlwaysOnTop(true, 'screen-saver');
    barWindow.moveTop();
  } catch {}
}

let barWatchdog = null;
/** 常驻守卫：定时重新置顶，防止被任务栏或全屏窗口盖住后再也回不来 */
function startBarWatchdog() {
  if (barWatchdog) return;
  barWatchdog = setInterval(raiseBar, 8000);
}
function stopBarWatchdog() {
  if (barWatchdog) clearInterval(barWatchdog);
  barWatchdog = null;
}

function showBar() {
  const win = createBarWindow();
  positionBarWindow();
  win.showInactive();
  raiseBar();
  startBarWatchdog();
  if (trayData && Object.keys(trayData).length) win.webContents.send('tray:data', trayData);
}

function hideBar() {
  stopBarWatchdog();
  if (barWindow && !barWindow.isDestroyed()) barWindow.hide();
}

/* ------------------------------------------------------------------ */
/* 窗口                                                                */
/* ------------------------------------------------------------------ */
let mainWindow = null;

async function createWindow() {
  const frame = Boolean(config.nativeFrame);
  const winIcon = iconPath();
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: APP_NAME,
    frame,
    transparent: !frame,
    backgroundColor: frame ? '#f7f8fa' : '#00000000',
    hasShadow: true,
    thickFrame: true,
    ...(winIcon && !frame ? { icon: winIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: !config.disableThrottle,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (START_HIDDEN || config.startMinimized) {
      // 静默启动：不显示窗口，仅保留托盘
      mainWindow.minimize();
      return;
    }
    mainWindow.show();
  });

  // 页面标题始终使用应用名
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
    mainWindow.setTitle(APP_NAME);
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', { maximized: true }));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', { maximized: false }));
  attachDevTools(mainWindow);

  // 关闭窗口：默认真正退出；仅在开启了「关闭到托盘」时隐藏
  mainWindow.on('close', (e) => {
    if (app.isQuiting) return;
    if (config.closeToTray) {
      e.preventDefault();
      mainWindow.hide();
      if (!tray) setupTray();
    }
  });

  mainWindow.on('closed', () => {
    // 主窗口关了但还有歌词/托盘窗口时，window-all-closed 不会触发，这里兜底
    if (!config.closeToTray && !app.isQuiting) {
      setTimeout(() => {
        if (!app.isQuiting && !mainWindow) quitApp();
      }, 120);
    }
  });

  try {
    if (isDev && DEV_SERVER_URL) {
      await mainWindow.loadURL(DEV_SERVER_URL);
    } else {
      const port = await startLocalServer();
      await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
    }
  } catch (e) {
    // 页面被刷新/重定向打断时 loadURL 会抛 ERR_ABORTED，不应影响后续启动流程
    console.warn('[window] loadURL:', e.message);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeLyricWindow();
  });

  // 外链一律使用系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}

/**
 * 听歌识曲 / 系统内录所需的媒体权限
 *
 * - 渲染进程用 getUserMedia 取麦克风，需要放行 media 权限
 * - 「系统声音」走 getDisplayMedia：这里直接返回主屏 + 系统回环音频，
 *   省掉选屏弹窗；Windows 上 loopback 才能录到电脑正在播放的声音
 */
function setupMediaCapture() {
  const ses = session.defaultSession;
  try {
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      const allow = ['media', 'display-capture', 'speaker-selection', 'audioCapture', 'videoCapture', 'fullscreen', 'clipboard-sanitized-write'];
      callback(allow.includes(permission));
    });
    ses.setPermissionCheckHandler((_wc, permission) => {
      const allow = ['media', 'display-capture', 'speaker-selection', 'fullscreen', 'clipboard-sanitized-write'];
      return allow.includes(permission);
    });
    ses.setDisplayMediaRequestHandler(async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
        if (!sources.length) {
          callback({});
          return;
        }
        callback({ video: sources[0], audio: 'loopback' });
      } catch (e) {
        console.warn('[capture] display media:', e.message);
        callback({});
      }
    });
  } catch (e) {
    console.warn('[capture] setup:', e.message);
  }
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// 分辨率/任务栏变化时，任务栏歌词重新贴边
app.whenReady().then(() => {
  try {
    screen.on('display-metrics-changed', () => positionBarWindow());
    screen.on('display-added', () => positionBarWindow());
    screen.on('display-removed', () => positionBarWindow());
  } catch {}
});
if (config.highDpi) {
  app.commandLine.appendSwitch('high-dpi-support', '1');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
}
if (config.gpuDisabled) {
  app.disableHardwareAcceleration();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    apiDir = resolveApiDir();
    config = readConfig();
    setupMediaCapture();
    // 在线更新：注册 IPC（window 加载前完成），并在启动后静默检查一次
    updater.register({
      getConfig: () => config,
      saveConfig: (cfg) => {
        config = cfg;
        writeConfig(config);
      },
      getWindow: () => mainWindow,
    });
    updater.scheduleSilentCheck(15000);
    try {
      await createWindow();
    } catch (e) {
      console.error('[boot] createWindow failed:', e.message);
    }
    // 两个平台实例并行启动，切换模式时无需等待
    startApi('std');
    startApi('lite');
    setupTray();
    applySystemSettings();
  }).catch((e) => console.error('[boot]', e));
}

app.on('window-all-closed', async () => {
  if (config.closeToTray) return; // 托盘模式常驻
  await stopApis();
  app.quit();
});

app.on('before-quit', () => {
  app.isQuiting = true;
  globalShortcut.unregisterAll();
  for (const key of Object.keys(servers)) {
    try {
      servers[key]?.kill();
    } catch {}
  }
});

/* 全局快捷键：Ctrl+Shift+S 显示/隐藏主窗口，Ctrl+Q 退出 */
function registerAppShortcuts() {
  try {
    globalShortcut.unregister('CommandOrControl+Shift+S');
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && !mainWindow.isMinimized()) mainWindow.hide();
      else showMainWindow();
    });
    globalShortcut.unregister('CommandOrControl+Q');
    globalShortcut.register('CommandOrControl+Q', () => quitApp());
  } catch (e) {
    console.warn('[shortcut]', e.message);
  }
}

/* 开机自启 / 休眠阻止 / 全局快捷键 */
let sleepBlockerId = null;

/** 可执行文件路径：便携版必须写回便携 exe，而不是临时解压目录 */
function launcherPath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function applySystemSettings() {
  try {
    // 开发模式下不写入系统启动项，避免把 node_modules 里的 electron 注册进去
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: Boolean(config.autoStart),
        path: launcherPath(),
        args: ['--hidden'],
      });
    }
  } catch (e) {
    console.warn('[autoStart]', e.message);
  }
  try {
    if (config.preventSleep) {
      if (sleepBlockerId === null) sleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    } else if (sleepBlockerId !== null) {
      powerSaveBlocker.stop(sleepBlockerId);
      sleepBlockerId = null;
    }
  } catch (e) {
    console.warn('[sleep]', e.message);
  }
  try {
    globalShortcut.unregisterAll();
    if (config.globalShortcut) {
      globalShortcut.register('CommandOrControl+Alt+Space', () => mainWindow?.webContents.send('player:command', 'toggle'));
      globalShortcut.register('CommandOrControl+Alt+Right', () => mainWindow?.webContents.send('player:command', 'next'));
      globalShortcut.register('CommandOrControl+Alt+Left', () => mainWindow?.webContents.send('player:command', 'prev'));
    }
  } catch (e) {
    console.warn('[shortcut]', e.message);
  }
  // 应用级快捷键放在最后注册，避免被上面的 unregisterAll 清掉
  registerAppShortcuts();
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */
ipcMain.handle('app:info', async () => ({
  version: app.getVersion(),
  autoStart: (() => {
    try {
      return app.isPackaged
        ? app.getLoginItemSettings({ path: launcherPath(), args: ['--hidden'] }).openAtLogin
        : Boolean(config.autoStart);
    } catch {
      return Boolean(config.autoStart);
    }
  })(),
  isDev,
  apiDir,
  userData: app.getPath('userData'),
  downloadDir: config.downloadDir,
  localDirs: config.localDirs,
  proxy: config.proxy,
  servers: serverStatus,
  localServerPort,
  platform: process.platform,
  portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE),
  updateOrigin: config.updateOrigin || 'https://moin.shrtxs.cn',
  updateAutoCheck: config.updateAutoCheck !== false,
  /** 启动时窗口是否处于隐藏/最小化状态（静默启动不出声续播） */
  startedHidden: Boolean(START_HIDDEN || config.startMinimized),
}));

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => {
  if (config.closeToTray) {
    mainWindow?.hide();
    return true;
  }
  quitApp();
  return true;
});
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

ipcMain.handle('shell:openExternal', (_e, url) => {
  if (/^https?:/.test(url)) return shell.openExternal(url);
});
ipcMain.handle('shell:openPath', (_e, p) => shell.openPath(p));
ipcMain.handle('shell:showItem', (_e, p) => {
  shell.showItemInFolder(p);
});

ipcMain.handle('dialog:chooseFolder', async (_e, def) => {
  const ret = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: def || app.getPath('music'),
  });
  return ret.canceled ? '' : ret.filePaths[0];
});

/** 选择背景图片/视频 */
ipcMain.handle('dialog:chooseBackground', async () => {
  const ret = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: '选择背景图片或视频',
    filters: [
      { name: '图片/视频', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (ret.canceled || !ret.filePaths[0]) return null;
  const file = ret.filePaths[0];
  const ext = path.extname(file).toLowerCase();
  const type = ['.mp4', '.webm', '.mov'].includes(ext) ? 'video' : 'image';
  config.background = { type, path: file };
  writeConfig(config);
  return {
    type,
    path: file,
    url: `http://127.0.0.1:${localServerPort}/__media?p=${encodeURIComponent(Buffer.from(file, 'utf8').toString('base64'))}`,
  };
});

ipcMain.handle('app:setLoginItem', (_e, enabled) => {
  config.autoStart = Boolean(enabled);
  writeConfig(config);
  applySystemSettings();
  return config.autoStart;
});

ipcMain.handle('app:preventSleep', (_e, enabled) => {
  config.preventSleep = Boolean(enabled);
  writeConfig(config);
  applySystemSettings();
  return config.preventSleep;
});

ipcMain.handle('app:globalShortcut', (_e, enabled) => {
  config.globalShortcut = Boolean(enabled);
  writeConfig(config);
  applySystemSettings();
  return config.globalShortcut;
});

ipcMain.handle('app:relaunch', () => {
  app.isQuiting = true;
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('window:hide', () => mainWindow?.hide());

ipcMain.handle('lyric:toggle', (_e, show) => {
  if (show) createLyricWindow();
  else closeLyricWindow();
  return Boolean(lyricWindow);
});

ipcMain.handle('lyric:update', (_e, payload) => {
  if (lyricWindow && !lyricWindow.isDestroyed()) lyricWindow.webContents.send('lyric:data', payload);
  return true;
});

ipcMain.handle('lyric:ignoreMouse', (_e, ignore) => {
  if (lyricWindow && !lyricWindow.isDestroyed()) {
    lyricWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
    // 锁定后通过全局快捷键解除，避免点不到按钮
    try {
      globalShortcut.unregister('CommandOrControl+Alt+L');
      if (ignore) {
        globalShortcut.register('CommandOrControl+Alt+L', () => {
          lyricWindow?.setIgnoreMouseEvents(false);
          lyricWindow?.webContents.send('lyric:unlocked');
        });
      }
    } catch {}
  }
  return true;
});

ipcMain.handle('lyric:close', () => {
  closeLyricWindow();
  return true;
});

/** 主窗口改歌词配置（字号/颜色/方向/延迟）时实时下发给歌词窗口 */
ipcMain.handle('lyric:config', (_e, cfg) => {
  if (lyricWindow && !lyricWindow.isDestroyed()) lyricWindow.webContents.send('lyric:config', cfg);
  return true;
});

/** 桌面歌词窗口里的播放控制等按钮 → 转发给主窗口执行 */
ipcMain.handle('lyric:command', (_e, cmd) => {
  mainWindow?.webContents.send('player:command', cmd);
  return true;
});

ipcMain.handle('lyric:topmost', (_e, on) => {
  if (lyricWindow && !lyricWindow.isDestroyed()) lyricWindow.setAlwaysOnTop(Boolean(on), 'screen-saver');
  return true;
});

/**
 * 桌面歌词窗口尺寸：横屏（宽条）/ 竖屏（窄竖条）
 * 传入 { mode } 或 { width, height }
 */
ipcMain.handle('lyric:resize', (_e, opts = {}) => {
  if (!lyricWindow || lyricWindow.isDestroyed()) return false;
  const mode = opts.mode === 'vertical' ? 'vertical' : 'horizontal';
  const bounds = lyricWindow.getBounds();
  const width = Math.round(opts.width || (mode === 'vertical' ? 260 : 900));
  const height = Math.round(opts.height || (mode === 'vertical' ? 520 : 190));
  const display = screen.getDisplayNearestPoint({ x: bounds.x + 10, y: bounds.y + 10 });
  const wa = display.workArea;
  const x = Math.min(Math.max(bounds.x, wa.x + 8), wa.x + wa.width - width - 8);
  const y = Math.min(Math.max(bounds.y, wa.y + 8), wa.y + wa.height - height - 8);
  lyricWindow.setBounds({ x, y, width, height }, false);
  return true;
});

/* ---------------- 托盘控制面板 ---------------- */
ipcMain.handle('tray:update', (_e, payload) => {
  trayData = payload || {};
  if (trayWindow && !trayWindow.isDestroyed()) trayWindow.webContents.send('tray:data', trayData);
  if (barWindow && !barWindow.isDestroyed()) barWindow.webContents.send('tray:data', trayData);
  return true;
});

ipcMain.handle('bar:toggle', (_e, show) => {
  if (show) showBar();
  else hideBar();
  return Boolean(barWindow && !barWindow.isDestroyed() && barWindow.isVisible());
});

ipcMain.handle('bar:state', () => Boolean(barWindow && !barWindow.isDestroyed() && barWindow.isVisible()));

ipcMain.handle('bar:position', (_e, pos) => {
  setBarPos(pos);
  positionBarWindow();
  raiseBar();
  return barPos;
});

/** 悬停到按钮时才接管鼠标，其余区域保持穿透 */
ipcMain.handle('bar:interactive', (_e, on) => {
  if (!barWindow || barWindow.isDestroyed()) return false;
  barWindow.setIgnoreMouseEvents(!on, { forward: true });
  return true;
});

ipcMain.handle('tray:get', () => trayData);

ipcMain.handle('tray:show', () => {
  showTrayPanel();
  return true;
});

ipcMain.handle('tray:command', (_e, cmd) => {
  mainWindow?.webContents.send('player:command', cmd);
  return true;
});

ipcMain.handle('tray:action', async (_e, action) => {
  switch (action) {
    case 'show':
      showMainWindow();
      break;
    case 'hide':
      mainWindow?.hide();
      break;
    case 'toggle-window':
      if (mainWindow?.isVisible() && !mainWindow.isMinimized()) mainWindow.hide();
      else showMainWindow();
      break;
    case 'home':
      shell.openExternal('https://github.com/MakcRe/KuGouMusicApi');
      break;
    case 'bug':
      shell.openExternal('https://github.com/MakcRe/KuGouMusicApi/issues');
      break;
    case 'update':
      return { version: app.getVersion(), latest: app.getVersion() };
    case 'relaunch':
      app.isQuiting = true;
      app.relaunch();
      app.exit(0);
      break;
    case 'quit':
      quitApp();
      break;
    case 'close-panel':
      trayWindow?.hide();
      break;
    default:
      break;
  }
  return true;
});

ipcMain.handle('config:set', async (_e, patch) => {
  config = { ...config, ...patch };
  writeConfig(config);
  return config;
});

ipcMain.handle('server:restart', async (_e, platform) => {
  const p = servers[platform];
  if (p) {
    try {
      p.kill();
    } catch {}
    servers[platform] = null;
  }
  await new Promise((r) => setTimeout(r, 400));
  return startApi(platform);
});

ipcMain.handle('server:status', () => serverStatus);

/** 扫描本地音乐目录 */
ipcMain.handle('local:scan', async (_e, dirs) => {
  const exts = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.ape', '.aac'];
  const result = [];
  const walk = async (dir, depth = 0) => {
    if (depth > 4) return;
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(full, depth + 1);
      else if (exts.includes(path.extname(ent.name).toLowerCase())) {
        let size = 0;
        try {
          size = (await fsp.stat(full)).size;
        } catch {}
        result.push({ path: full, name: path.basename(ent.name, path.extname(ent.name)), size });
      }
    }
  };
  for (const d of dirs || []) {
    if (d && fs.existsSync(d)) await walk(d);
  }
  return result.slice(0, 5000);
});

ipcMain.handle('media:localUrl', (_e, file) => {
  if (!localServerPort) return '';
  return `http://127.0.0.1:${localServerPort}/__media?p=${encodeURIComponent(Buffer.from(file, 'utf8').toString('base64'))}`;
});

/**
 * 原始 HTTP 请求（可读取 Set-Cookie）
 * 登录类接口需要通过响应头拿到 token，渲染进程的 fetch 无法读取 Set-Cookie，
 * 因此由主进程代发请求并把 cookie 一并返回。
 */
ipcMain.handle('http:raw', (_e, { port, path: p, method = 'GET', data } = {}) => {
  return new Promise((resolve) => {
    let settled = false;
    const done = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };
    if (!port) return done({ status: 0, cookies: [], body: '' });
    let req;
    try {
      req = net.request({ url: `http://127.0.0.1:${port}${p}`, method, redirect: 'follow' });
    } catch (e) {
      return done({ status: 0, cookies: [], body: String(e) });
    }
    req.setHeader('Accept', 'application/json');
    if (data) req.setHeader('Content-Type', 'application/json');
    req.on('response', (res) => {
      const rawCookies = res.headers['set-cookie'] || [];
      const cookies = (Array.isArray(rawCookies) ? rawCookies : [rawCookies]).map((c) =>
        String(c).split(';')[0].trim()
      );
      let body = '';
      res.on('data', (chunk) => (body += chunk.toString()));
      res.on('end', () => done({ status: res.statusCode, cookies, body }));
      res.on('error', (e) => done({ status: 0, cookies, body: String(e) }));
    });
    req.on('error', (e) => done({ status: 0, cookies: [], body: String(e) }));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
});

ipcMain.handle('download:start', (_e, payload) => downloadSong(payload));
ipcMain.handle('download:list', async () => {
  const dir = config.downloadDir;
  try {
    const files = await fsp.readdir(dir);
    const list = [];
    for (const f of files) {
      if (/\.(mp3|flac|m4a|wav|ogg|ape|aac)$/i.test(f)) {
        const full = path.join(dir, f);
        let meta = null;
        try {
          meta = JSON.parse(await fsp.readFile(`${full}.json`, 'utf8'));
        } catch {}
        const st = await fsp.stat(full);
        list.push({ path: full, name: f, size: st.size, mtime: st.mtimeMs, meta });
      }
    }
    return list.sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
});
ipcMain.handle('download:remove', async (_e, file) => {
  try {
    await fsp.unlink(file);
    await fsp.unlink(`${file}.json`).catch(() => {});
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle('download:active', () => Array.from(downloads.values()));
