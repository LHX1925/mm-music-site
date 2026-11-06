/**
 * 生成安装包界面素材（NSIS 侧边栏 164x314、顶部条 150x57）
 *
 * 用法：node scripts/make-installer-art.mjs
 * 说明：BMP 必须是 24 位、无压缩；这里用 Jimp 直接输出。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = path.join(root, 'build', 'icon.png');

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/** 深色渐变 + 品牌色光斑背景 */
function gradientCanvas(w, h, from, to, glow) {
  const img = new Jimp(w, h, 0x000000ff);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = y / Math.max(1, h - 1);
      let r = lerp(from[0], to[0], t);
      let g = lerp(from[1], to[1], t);
      let b = lerp(from[2], to[2], t);
      // 左上角品牌光斑
      const d = Math.hypot(x - w * 0.15, y - h * 0.12) / (w * 0.95);
      const k = Math.max(0, 1 - d) ** 2 * glow;
      r = Math.min(255, Math.round(r + (0 - r) * k * 0.15 + 0 * k));
      g = Math.min(255, Math.round(g + (210 - g) * k * 0.55));
      b = Math.min(255, Math.round(b + (106 - b) * k * 0.4));
      img.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
    }
  }
  return img;
}

async function main() {
  const iconRaw = await Jimp.read(iconPath);

  /* ---------- 侧边栏 164x314 ---------- */
  const sb = gradientCanvas(164, 314, [14, 20, 26], [24, 38, 46], 1);
  // 右上装饰圆
  const deco = new Jimp(150, 150, 0x00000000);
  deco.scan(0, 0, 150, 150, function (x, y, idx) {
    const d = Math.hypot(x - 75, y - 75);
    const a = Math.max(0, 1 - d / 75) ** 2 * 46;
    const data = this.bitmap.data;
    data[idx] = 0;
    data[idx + 1] = 210;
    data[idx + 2] = 106;
    data[idx + 3] = a;
  });
  sb.composite(deco, 90, -46);

  // 图标底板，避免白色插画直接压在深色上糊成一团
  const plate = new Jimp(74, 74, 0x00000000);
  const pr = 20;
  plate.scan(0, 0, 74, 74, function (x, y, idx) {
    const cx = Math.min(Math.max(x, pr), 74 - pr);
    const cy = Math.min(Math.max(y, pr), 74 - pr);
    const inside = (x - cx) ** 2 + (y - cy) ** 2 <= pr * pr;
    const data = this.bitmap.data;
    if (inside) {
      data[idx] = 238;
      data[idx + 1] = 247;
      data[idx + 2] = 243;
      data[idx + 3] = 255;
    }
  });
  sb.composite(plate, 45, 34);
  const logo = iconRaw.clone().resize(60, 60);
  sb.composite(logo, 52, 41);

  const font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const font8 = await Jimp.loadFont(Jimp.FONT_SANS_8_WHITE);

  sb.print(font16, 0, 122, { text: 'MengMeng', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 164);
  sb.print(font8, 0, 146, { text: 'MUSIC PLAYER', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 164);
  sb.print(font8, 0, 158, { text: 'Vue 3 + Electron', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 164);

  // 底部提示条
  for (let y = 272; y < 314; y++) {
    for (let x = 0; x < 164; x++) {
      const t = (y - 272) / 42;
      const c = Jimp.intToRGBA(sb.getPixelColor(x, y));
      sb.setPixelColor(
        Jimp.rgbaToInt(lerp(c.r, 30, t), lerp(c.g, 48, t), lerp(c.b, 58, t), 255),
        x,
        y
      );
    }
  }
  sb.print(font8, 20, 292, 'v1.1.0', 132);

  await sb.writeAsync(path.join(root, 'build', 'installerSidebar.bmp'));

  /* ---------- 顶部条 150x57 ---------- */
  const hd = gradientCanvas(150, 57, [16, 22, 30], [22, 32, 42], 0.9);
  const hdIcon = iconRaw.clone().resize(34, 34);
  hd.composite(hdIcon, 9, 11);
  const hd16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const hd8 = await Jimp.loadFont(Jimp.FONT_SANS_8_WHITE);
  hd.print(hd16, 50, 12, 'MengMeng');
  hd.print(hd8, 51, 32, 'MUSIC');
  await hd.writeAsync(path.join(root, 'build', 'installerHeader.bmp'));

  const stat = await fs.stat(path.join(root, 'build', 'installerSidebar.bmp'));
  console.log('installer art generated:', stat.size, 'bytes');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
