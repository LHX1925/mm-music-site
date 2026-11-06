/**
 * 设备标识（dfid）
 *
 * 酷狗取流接口 /song/url 会做风控校验：请求里没有合法的 dfid 时
 * 直接返回 errcode 20028「本次请求需要验证」，表现就是「这首歌无法播放」。
 * 这里用后端 /register/dev 申请一个设备号并缓存下来，之后每个请求都带上，
 * 大部分「播不了」的歌就能正常取到音源了。
 */
import { registerDev } from '@/api';

const KEY = (p) => `kg-device-dfid-${p}`;
const cache = {};
let pending = {};

export function getDfid(platform = 'std') {
  if (cache[platform]) return cache[platform];
  try {
    const v = localStorage.getItem(KEY(platform)) || '';
    if (v) cache[platform] = v;
    return v;
  } catch {
    return '';
  }
}

export function setDfid(platform, dfid) {
  if (!dfid) return '';
  cache[platform] = dfid;
  try {
    localStorage.setItem(KEY(platform), dfid);
  } catch {}
  return dfid;
}

/**
 * 确保有设备号
 * @param {string} platform std / lite
 * @param {boolean} force 强制重新申请（旧 dfid 被风控时用）
 */
export async function ensureDfid(platform = 'std', force = false) {
  const cur = getDfid(platform);
  if (cur && !force) return cur;
  if (pending[platform]) return pending[platform];
  pending[platform] = (async () => {
    try {
      const data = await registerDev(platform);
      let dfid = data?.dfid || data?.DFID || '';
      // 概念版接口有时不返回 dfid，用标准版的设备号顶上（两边通用）
      if (!dfid && platform !== 'std') {
        dfid = getDfid('std') || (await ensureDfid('std', force));
      }
      if (dfid) return setDfid(platform, dfid);
    } catch {}
    return cur;
  })();
  try {
    return await pending[platform];
  } finally {
    delete pending[platform];
  }
}
