"""Generate PWA icons and labeled sample product images (packaging-style) for the offline app."""
import math
import os
from PIL import Image, ImageDraw, ImageFont

PUB = "/app/frontend/public"
os.makedirs(f"{PUB}/icons", exist_ok=True)
os.makedirs(f"{PUB}/samples", exist_ok=True)

FB = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FM = "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"

BG = (15, 23, 42)
CARD = (30, 41, 59)
CYAN = (6, 182, 212)
AMBER = (245, 158, 11)


def gear(draw, cx, cy, r_out, r_in, teeth, fill):
    pts = []
    n = teeth * 4
    for i in range(n):
        a = 2 * math.pi * i / n
        r = r_out if (i % 4) in (0, 1) else r_in
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    draw.polygon(pts, fill=fill)


def icon(size, maskable=False):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    pad = int(size * (0.18 if maskable else 0.08))
    if not maskable:
        d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=int(size * 0.2), fill=CARD)
    c = size / 2
    s = (size - 2 * pad) / 2
    gear(d, c, c, s * 0.78, s * 0.62, 10, AMBER)
    d.ellipse([c - s * 0.42, c - s * 0.42, c + s * 0.42, c + s * 0.42], fill=BG)
    # cyan scan bracket
    w = max(2, int(size * 0.035))
    b = s * 0.26
    for sx, sy in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        x0, y0 = c + sx * b, c + sy * b
        d.line([(x0, y0), (x0 - sx * b * 0.55, y0)], fill=CYAN, width=w)
        d.line([(x0, y0), (x0, y0 - sy * b * 0.55)], fill=CYAN, width=w)
    d.ellipse([c - s * 0.06, c - s * 0.06, c + s * 0.06, c + s * 0.06], fill=CYAN)
    return img


for sz in (192, 512):
    icon(sz).save(f"{PUB}/icons/icon-{sz}.png")
icon(512, maskable=True).save(f"{PUB}/icons/icon-maskable-512.png")
icon(180).save(f"{PUB}/icons/apple-touch-icon.png")
icon(64).save(f"{PUB}/favicon.png")

SAMPLES = [
    ("kampas-rem", "HONDA", "GENUINE PARTS", "KAMPAS REM DEPAN", "06455-KVB-305", (200, 16, 46), (255, 255, 255)),
    ("oli-mpx2", "AHM OIL", "MPX2 10W-30", "OLI MESIN MATIC 0.8L", "MPX2-08", (20, 20, 20), (230, 30, 40)),
    ("busi-ngk", "NGK", "SPARK PLUG", "BUSI CPR7EA-9", "CPR7EA-9", (250, 250, 250), (200, 20, 30)),
    ("seal-shock", "YAMAHA YGP", "GENUINE PARTS", "SEAL SHOCK DEPAN", "5TL-F3145-00", (10, 50, 140), (255, 255, 255)),
    ("vbelt-vario", "HONDA", "GENUINE PARTS", "V-BELT VARIO 125/150", "23100-K35-V01", (230, 230, 230), (200, 16, 46)),
    ("rantai-federal", "FEDERAL", "CHAIN KIT", "RANTAI 428H-104L", "FCC-428H", (255, 200, 0), (20, 20, 20)),
]

for key, brand, sub, name, code, bg, fg in SAMPLES:
    W, H = 800, 600
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    # packaging stripes
    d.rectangle([0, 0, W, 120], fill=fg)
    d.text((40, 22), brand, font=ImageFont.truetype(FB, 72), fill=bg)
    d.text((44, 140), sub, font=ImageFont.truetype(FR, 34), fill=fg)
    d.text((44, 230), name, font=ImageFont.truetype(FB, 50), fill=fg)
    d.rounded_rectangle([40, 360, 760, 470], radius=14, fill=(255, 255, 255))
    d.text((64, 378), code, font=ImageFont.truetype(FM, 66), fill=(10, 10, 10))
    d.text((44, 520), "CONTOH - GAMBAR SAMPEL", font=ImageFont.truetype(FR, 26), fill=fg)
    # diagonal accent
    d.polygon([(W - 160, H), (W, H - 160), (W, H)], fill=fg)
    img.save(f"{PUB}/samples/{key}.jpg", quality=82)

print("ok")
