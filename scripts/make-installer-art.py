#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成安装包界面素材（NSIS 侧边栏 164x314、顶部条 150x57）

用法：python3 scripts/make-installer-art.py
说明：
- 输出 24 位、无压缩、自下而上（height 为正）的 BMP，NSIS/MUI 才能正常显示。
- 画面包含品牌 logo（圆角白底 + 应用图标）+ 中文「萌萌音乐」字标 + 版本号。
- 之前的 Jimp 脚本输出的是自上而下的 BMP，MUI 会渲染成空白；这里用 Pillow 保证自下而上。
"""
import json
import os
import struct

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_PATH = os.path.join(ROOT, "build", "icon.png")


def find_font(*candidates):
    for c in candidates:
        if c and os.path.exists(c):
            return c
    # 常见 Windows 字体目录兜底
    base = ["C:/Windows/Fonts", "C:/Windows/Fonts", "/usr/share/fonts"]
    for b in base:
        for name in ("simhei.ttf", "msyh.ttc", "msyhbd.ttc", "simsun.ttc"):
            p = os.path.join(b, name)
            if os.path.exists(p):
                return p
    raise FileNotFoundError("找不到可用的中文字体")


def lerp(a, b, t):
    return int(round(a + (b - a) * t))


def make_bg(w, h, top, bottom, glow_color, glow_strength=1.0):
    """深色渐变 + 左上角品牌色光斑"""
    img = Image.new("RGB", (w, h), (0, 0, 0))
    px = img.load()
    cx, cy = w * 0.16, h * 0.14
    maxd = (w * w + h * h) ** 0.5
    for y in range(h):
        t = y / max(1, h - 1)
        r = lerp(top[0], bottom[0], t)
        g = lerp(top[1], bottom[1], t)
        b = lerp(top[2], bottom[2], t)
        for x in range(w):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / maxd
            k = max(0.0, 1.0 - d) ** 2 * glow_strength
            nr = min(255, int(r + (glow_color[0] - r) * k))
            ng = min(255, int(g + (glow_color[1] - g) * k))
            nb = min(255, int(b + (glow_color[2] - b) * k))
            px[x, y] = (nr, ng, nb)
    return img


def rounded_plate(size, radius, fill, shadow=True):
    """画一块圆角白底板（带轻微阴影），返回 (plate_rgb, plate_mask)"""
    s = size
    plate = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(plate)
    if shadow:
        sh = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle([3, 5, s - 3, s - 1], radius=radius, fill=(0, 0, 0, 70))
        plate = Image.alpha_composite(sh, plate)
        d = ImageDraw.Draw(plate)
    d.rounded_rectangle([1, 1, s - 1, s - 1], radius=radius, fill=fill)
    return plate


def paste_centered(canvas, img, box_size, box_x, box_y):
    """把 img 缩放进 box 并居中贴到 canvas 的 (box_x,box_y) 区域"""
    iw, ih = img.size
    scale = min(box_size / iw, box_size / ih)
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    res = img.resize((nw, nh), Image.LANCZOS).convert("RGBA")
    ox = box_x + (box_size - nw) // 2
    oy = box_y + (box_size - nh) // 2
    canvas.alpha_composite(res, (ox, oy))


def text_w(draw, s, font):
    return draw.textlength(s, font=font)


def main():
    with open(os.path.join(ROOT, "package.json"), "r", encoding="utf-8") as f:
        ver = json.load(f).get("version", "1.2.5")
    ver_label = f"v{ver}"

    font_path = find_font(
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/msyh.ttc",
        "/c/Windows/Fonts/simhei.ttf",
    )
    f_word = ImageFont.truetype(font_path, 22)   # 中文「萌萌音乐」字标
    f_sub = ImageFont.truetype(font_path, 10)    # 副标题英文
    f_ver = ImageFont.truetype(font_path, 11)     # 版本号

    icon = Image.open(ICON_PATH).convert("RGBA")

    # 品牌色：青绿光斑
    glow = (0, 210, 150)

    # ---------------- 侧边栏 164x314 ----------------
    sb = make_bg(164, 314, (14, 20, 26), (22, 36, 44), glow, 1.0)
    sbc = Image.new("RGBA", (164, 314), (0, 0, 0, 0))
    sbc.paste(sb.convert("RGBA"))

    plate = rounded_plate(78, 20, (244, 248, 246))
    sbc.alpha_composite(plate, (43, 26))
    paste_centered(sbc, icon, 66, 49, 32)

    d = ImageDraw.Draw(sbc)
    word = "萌萌音乐"
    ww = text_w(d, word, f_word)
    d.text(((164 - ww) / 2, 122), word, font=f_word, fill=(255, 255, 255))
    sub = "MUSIC PLAYER"
    sw = text_w(d, sub, f_sub)
    d.text(((164 - sw) / 2, 152), sub, font=f_sub, fill=(170, 200, 192))

    # 底部版本条
    d.rounded_rectangle([0, 278, 164, 314], radius=0, fill=(10, 16, 22))
    d.rectangle([0, 278, 164, 280], fill=(0, 210, 150))
    vw = text_w(d, ver_label, f_ver)
    d.text(((164 - vw) / 2, 294), ver_label, font=f_ver, fill=(200, 220, 214))

    sb_out = sbc.convert("RGB")
    sb_out.save(os.path.join(ROOT, "build", "installerSidebar.bmp"), "BMP")

    # ---------------- 顶部条 150x57 ----------------
    hd = make_bg(150, 57, (16, 22, 30), (22, 34, 44), glow, 0.9)
    hdc = Image.new("RGBA", (150, 57), (0, 0, 0, 0))
    hdc.paste(hd.convert("RGBA"))

    plate_h = rounded_plate(42, 11, (244, 248, 246))
    hdc.alpha_composite(plate_h, (9, 7))
    paste_centered(hdc, icon, 36, 12, 10)

    d = ImageDraw.Draw(hdc)
    ww = text_w(d, word, f_word)
    f_word_h = ImageFont.truetype(font_path, 17)
    ww = text_w(d, word, f_word_h)
    d.text((56, 11), word, font=f_word_h, fill=(255, 255, 255))
    sub = "MUSIC"
    sw = text_w(d, sub, f_sub)
    d.text((57, 33), sub, font=f_sub, fill=(170, 200, 192))

    hd_out = hdc.convert("RGB")
    hd_out.save(os.path.join(ROOT, "build", "installerHeader.bmp"), "BMP")

    print("installer art generated (with logo):")
    for name in ("installerSidebar.bmp", "installerHeader.bmp"):
        p = os.path.join(ROOT, "build", name)
        print("  ", name, os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
