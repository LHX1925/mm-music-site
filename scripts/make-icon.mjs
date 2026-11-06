/**
 * 生成应用图标
 *
 * 用法：node scripts/make-icon.mjs <源图路径>
 * 产物：
 *   build/icon.ico         Windows 安装包/可执行文件图标（含 16~256 多尺寸）
 *   build/icon.png         512x512，窗口与托盘图标
 *   public/icon.png        512x512，界面内 logo
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = process.argv[2];
if (!srcPath) {
  console.error('缺少源图路径');
  process.exit(1);
}

/** 圆角矩形遮罩（3x3 超采样抗锯齿），并描一圈极淡内边框，避免浅色图标在浅色背景上糊掉 */
function roundMask(img, radius) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const r = Math.max(1, Math.round(radius));
  const inset = Math.max(0.6, w * 0.004);
  const inside = (x, y) => {
    const cx = Math.min(Math.max(x, r), w - r);
    const cy = Math.min(Math.max(y, r), h - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= (r - inset) ** 2;
  };
  img.scan(0, 0, w, h, function (x, y, idx) {
    let hit = 0;
    for (let sy = 0; sy < 3; sy++) {
      for (let sx = 0; sx < 3; sx++) {
        if (inside(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) hit += 1;
      }
    }
    const ratio = hit / 9;
    const data = this.bitmap.data;
    data[idx + 3] = Math.round(data[idx + 3] * ratio);
    // 边缘一圈：叠一点浅灰，形成 1px 描边
    if (ratio > 0 && ratio < 0.92) {
      const k = (1 - ratio) * 0.16;
      data[idx] = Math.round(data[idx] * (1 - k) + 90 * k);
      data[idx + 1] = Math.round(data[idx + 1] * (1 - k) + 96 * k);
      data[idx + 2] = Math.round(data[idx + 2] * (1 - k) + 104 * k);
    }
  });
  return img;
}

async function makeSize(src, size) {
  const img = src.clone();
  img.cover(size, size, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
  roundMask(img, size * 0.22);
  return img.getBufferAsync(Jimp.MIME_PNG);
}

/** 组装 ICO（Windows Vista+ 支持 PNG 压缩的单条目录） */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dirs = [];
  const blobs = [];
  for (const { size, data } of entries) {
    const d = Buffer.alloc(16);
    d[0] = size >= 256 ? 0 : size;
    d[1] = size >= 256 ? 0 : size;
    d[2] = 0;
    d[3] = 0;
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(data.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += data.length;
    dirs.push(d);
    blobs.push(data);
  }
  return Buffer.concat([header, ...dirs, ...blobs]);
}

const src = await Jimp.read(srcPath);
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const buffers = new Map();
for (const s of sizes) buffers.set(s, await makeSize(src, s));

await fs.mkdir(path.join(root, 'build'), { recursive: true });
await fs.mkdir(path.join(root, 'public'), { recursive: true });

await fs.writeFile(path.join(root, 'build', 'icon.png'), buffers.get(512));
await fs.writeFile(path.join(root, 'public', 'icon.png'), buffers.get(512));
await fs.writeFile(
  path.join(root, 'build', 'icon.ico'),
  buildIco([16, 24, 32, 48, 64, 128, 256].map((s) => ({ size: s, data: buffers.get(s) })))
);
console.log('icon generated:', sizes.join(', '), '-> build/icon.ico, build/icon.png, public/icon.png');
