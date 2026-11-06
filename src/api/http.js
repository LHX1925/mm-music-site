/**
 * HTTP 请求层
 *
 * - 双平台：标准版(酷狗音乐) / 概念版(lite)，各自独立端口与会话
 * - 统一注入 Cookie（token/userid/dfid/vip_token...）—— 由 KuGouMusicApi 转换为
 *   官方请求头，实现账号态透传
 * - 统一错误包装，识别风控错误码 20028
 */

export const runtime = {
  platform: 'std',
  ports: { std: 32100, lite: 32101 },
  ready: { std: false, lite: false },
  cookieProvider: () => '',
  dev: false,
};

export function setRuntime(patch) {
  Object.assign(runtime, patch);
}

export function baseUrl(platform = runtime.platform) {
  const port = runtime.ports[platform] || runtime.ports.std || 32100;
  return `http://127.0.0.1:${port}`;
}

export class ApiError extends Error {
  constructor(message, payload) {
    super(message);
    this.name = 'ApiError';
    this.payload = payload;
    this.code = payload?.errcode || payload?.error_code || payload?.code;
    this.needVerify = this.code === 20028 || /需要验证/.test(message || '');
  }
}

function serialize(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) search.append(k, v.join(','));
    else if (typeof v === 'object') search.append(k, JSON.stringify(v));
    else search.append(k, String(v));
  });
  return search.toString();
}

function messageOf(body) {
  if (!body || typeof body !== 'object') return '';
  return (
    body.error_msg ||
    body.error ||
    body.msg ||
    body.message ||
    body.errmsg ||
    body.data?.msg ||
    body.data?.error_msg ||
    (typeof body.data === 'string' ? body.data : '') ||
    ''
  );
}

/**
 * 发起接口请求
 * @param {string} path 接口路径，如 /search
 * @param {object} [options]
 * @param {string} [options.method] GET/POST
 * @param {object} [options.params] query 参数
 * @param {object} [options.data] body
 * @param {string} [options.platform] 平台
 * @param {boolean} [options.cookie] 是否携带登录态（默认 true）
 * @param {boolean} [options.nocache] 是否绕过 2 分钟缓存
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    params = {},
    data,
    platform = runtime.platform,
    cookie = true,
    nocache = false,
    timeout = 20000,
  } = options;

  const q = { ...params };
  if (nocache) q.timestamp = Date.now() + Math.floor(Math.random() * 1000);
  if (cookie) {
    const c = runtime.cookieProvider(platform);
    if (c) q.cookie = c;
  }
  // tick: 部分接口对重复请求有缓存/风控，带上随机参数避免命中
  const query = serialize(q);
  const url = `${baseUrl(platform)}${path}${query ? `?${query}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new ApiError('请求超时，请检查网络或 API 服务状态', null);
    throw new ApiError(`无法连接本地 API 服务（${baseUrl(platform)}）`, null);
  }
  clearTimeout(timer);

  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (res.status >= 500) {
    throw new ApiError(messageOf(body) || `接口异常（${res.status}）`, body);
  }

  // 部分接口以 status=0 表示业务失败
  if (body && typeof body === 'object') {
    const failed = body.status === 0 || (body.error_code && body.error_code !== 0 && !body.data);
    if (failed) {
      throw new ApiError(messageOf(body) || '接口返回失败', body);
    }
  }

  return body;
}

/** 常用：GET */
export const get = (path, params, opts = {}) => request(path, { params, ...opts });
/** 常用：POST */
export const post = (path, data, params, opts = {}) => request(path, { method: 'POST', data, params, ...opts });
