/**
 * 生成安装包界面素材（NSIS 侧边栏 / 顶部条）。
 *
 * 真正的绘制逻辑在 scripts/make-installer-art.py（用 Pillow，能渲染中文且
 * 输出「自下而上」的 BMP，MUI/NSIS 才能正常显示）。本文件只是一个薄包装：
 * 在 Node 里调用 python 来跑它，保持 `npm run art` 的用法不变。
 *
 * 依赖：python3 + Pillow（pip install pillow）。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pyScript = path.join(root, 'scripts', 'make-installer-art.py');

// 依次尝试可用的 python 解释器
const candidates = ['python3', 'python', 'py'];
let result = null;
for (const exe of candidates) {
  result = spawnSync(exe, [pyScript], { stdio: 'inherit', windowsHide: true });
  if (result.error === undefined && result.status === 0) {
    process.exit(0);
  }
}

console.error('[make-installer-art] 未能运行 Python 脚本。');
console.error('[make-installer-art] 请先安装依赖： python3 -m pip install pillow');
process.exit(1);
