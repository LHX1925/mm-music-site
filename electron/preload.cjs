/**
 * 预加载脚本：向渲染进程暴露受控的桌面能力
 */
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Map();

function on(channel, cb) {
  const handler = (_e, payload) => cb(payload);
  listeners.set(cb, handler);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
    listeners.delete(cb);
  };
}

contextBridge.exposeInMainWorld('kg', {
  isDesktop: true,
  info: () => ipcRenderer.invoke('app:info'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  chooseFolder: (def) => ipcRenderer.invoke('dialog:chooseFolder', def),
  chooseBackground: () => ipcRenderer.invoke('dialog:chooseBackground'),
  setLoginItem: (v) => ipcRenderer.invoke('app:setLoginItem', v),
  preventSleep: (v) => ipcRenderer.invoke('app:preventSleep', v),
  setGlobalShortcut: (v) => ipcRenderer.invoke('app:globalShortcut', v),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  lyric: {
    toggle: (show) => ipcRenderer.invoke('lyric:toggle', show),
    update: (payload) => ipcRenderer.invoke('lyric:update', payload),
    ignoreMouse: (ignore) => ipcRenderer.invoke('lyric:ignoreMouse', ignore),
    close: () => ipcRenderer.invoke('lyric:close'),
    command: (cmd) => ipcRenderer.invoke('lyric:command', cmd),
    topmost: (on) => ipcRenderer.invoke('lyric:topmost', on),
    resize: (opts) => ipcRenderer.invoke('lyric:resize', opts),
    config: (cfg) => ipcRenderer.invoke('lyric:config', cfg),
  },
  tray: {
    update: (payload) => ipcRenderer.invoke('tray:update', payload),
    get: () => ipcRenderer.invoke('tray:get'),
    show: () => ipcRenderer.invoke('tray:show'),
    command: (cmd) => ipcRenderer.invoke('tray:command', cmd),
    action: (name) => ipcRenderer.invoke('tray:action', name),
  },
  bar: {
    toggle: (show) => ipcRenderer.invoke('bar:toggle', show),
    state: () => ipcRenderer.invoke('bar:state'),
    interactive: (on) => ipcRenderer.invoke('bar:interactive', on),
    position: (pos) => ipcRenderer.invoke('bar:position', pos),
  },
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  restartServer: (platform) => ipcRenderer.invoke('server:restart', platform),
  serverStatus: () => ipcRenderer.invoke('server:status'),
  updater: {
    info: () => ipcRenderer.invoke('update:info'),
    check: (opts) => ipcRenderer.invoke('update:check', opts || {}),
    download: (opts) => ipcRenderer.invoke('update:download', opts || {}),
    cancel: () => ipcRenderer.invoke('update:cancel'),
    install: (opts) => ipcRenderer.invoke('update:install', opts || {}),
    openPage: (url) => ipcRenderer.invoke('update:openPage', url),
    reveal: (file) => ipcRenderer.invoke('update:reveal', file),
    ignore: (version) => ipcRenderer.invoke('update:ignore', version),
  },
  scanLocal: (dirs) => ipcRenderer.invoke('local:scan', dirs),
  localUrl: (file) => ipcRenderer.invoke('media:localUrl', file),
  httpRaw: (payload) => ipcRenderer.invoke('http:raw', payload),
  download: (payload) => ipcRenderer.invoke('download:start', payload),
  downloadList: () => ipcRenderer.invoke('download:list'),
  downloadRemove: (file) => ipcRenderer.invoke('download:remove', file),
  downloadActive: () => ipcRenderer.invoke('download:active'),
  on,
});
