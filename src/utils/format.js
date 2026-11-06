/** 数字/时间格式化 */
export function formatCount(n) {
  const num = Number(n) || 0;
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`;
  if (num >= 10000) return `${(num / 10000).toFixed(num >= 100000 ? 0 : 1)}万`;
  return String(num);
}

export function formatDuration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDate(v) {
  if (!v) return '';
  const str = String(v);
  if (/^\d{8}$/.test(str)) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const n = Number(v);
  if (n > 1e12) return new Date(n).toISOString().slice(0, 10);
  if (n > 1e9) return new Date(n * 1000).toISOString().slice(0, 10);
  return str;
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n > 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n > 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function greet() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return 'Hi';
  if (h < 18) return 'Hi';
  return 'Hi';
}
