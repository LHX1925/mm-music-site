/**
 * 复制文本
 *
 * Electron 里 navigator.clipboard 有时不可用（非安全上下文 / 权限未放行），
 * 所以统一走「Clipboard API → execCommand 兜底」，任何一处复制都调这里。
 */
export async function copyText(text) {
  const value = String(text ?? '');
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* 权限被拒，继续走兜底 */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.left = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 歌曲分享页地址（酷狗 mixsong 页，浏览器可打开） */
export function songShareUrl(song) {
  const id = song?.albumAudioId || song?.mixsongid;
  if (id) return `https://www.kugou.com/mixsong/${id}.html`;
  if (song?.hash) return `https://www.kugou.com/song/#hash=${song.hash}`;
  return 'https://www.kugou.com/';
}
