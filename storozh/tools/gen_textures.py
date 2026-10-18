"""Генератор пиксельных текстур-заглушек для блокаута.

Все текстуры 64x64 (трава 32x64), рисуются кодом, поэтому никаких проблем с лицензиями.
Когда появятся нормальные текстуры, просто положи PNG с тем же именем поверх.

Запуск (из папки storozh):  python tools/gen_textures.py
Нужен Pillow: pip install pillow
"""
import math
import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "assets" / "textures"
SIZE = 64


def clamp(v):
    return max(0, min(255, int(v)))


def rgb(c, k=1.0, add=0):
    return tuple(clamp(x * k + add) for x in c)


def noise_grid(rng, cells, size=SIZE):
    """Плавный периодический шум (билинейная интерполяция по сетке), значения 0..1."""
    g = [[rng.random() for _ in range(cells)] for _ in range(cells)]
    out = [[0.0] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            fx, fy = x / size * cells, y / size * cells
            x0, y0 = int(fx), int(fy)
            tx, ty = fx - x0, fy - y0
            x1, y1 = (x0 + 1) % cells, (y0 + 1) % cells
            a = g[y0][x0] * (1 - tx) + g[y0][x1] * tx
            b = g[y1][x0] * (1 - tx) + g[y1][x1] * tx
            out[y][x] = a * (1 - ty) + b * ty
    return out


def logs():
    """Чёрные от времени брёвна: 4 бревна на текстуру, тёмные стыки, волокна."""
    rng = random.Random(1)
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    base = (70, 60, 50)
    n = noise_grid(rng, 8)
    log_h = 16
    tones = [rng.uniform(0.8, 1.15) for _ in range(SIZE // log_h)]
    for y in range(SIZE):
        i = y // log_h
        t = (y % log_h) / (log_h - 1)
        # круглое бревно: светлее в середине, темнее к стыкам
        shade = 0.55 + 0.6 * math.sin(t * math.pi)
        for x in range(SIZE):
            grain = 0.85 + 0.3 * n[y][x] + 0.08 * math.sin((x + i * 13) * 0.9 + y * 0.3)
            c = rgb(base, shade * grain * tones[i])
            if y % log_h in (0, log_h - 1):
                c = rgb(base, 0.25)
            px[x, y] = c
    # трещины
    for _ in range(10):
        y = rng.randrange(SIZE)
        x0 = rng.randrange(SIZE)
        for k in range(rng.randrange(4, 12)):
            px[(x0 + k) % SIZE, y] = rgb(base, 0.35)
    return img


def planks(base=(100, 80, 60), seed=2):
    """Половицы вдоль Y: 8 досок по 8 px, у каждой свой тон, шляпки гвоздей."""
    rng = random.Random(seed)
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    n = noise_grid(rng, 4)
    w = 8
    tones = [rng.uniform(0.75, 1.2) for _ in range(SIZE // w)]
    offsets = [rng.randrange(SIZE) for _ in range(SIZE // w)]
    for x in range(SIZE):
        i = x // w
        for y in range(SIZE):
            grain = 0.85 + 0.25 * n[y][x] + 0.06 * math.sin(y * 0.7 + x * 2.1)
            c = rgb(base, tones[i] * grain)
            if x % w == 0:
                c = rgb(base, 0.3)
            # торцевой стык доски
            if (y + offsets[i]) % SIZE == 0:
                c = rgb(base, 0.35)
            px[x, y] = c
        # гвозди у стыка
        yy = offsets[i] % SIZE
        for dy in (2, SIZE - 3):
            px[i * w + 2, (yy + dy) % SIZE] = (30, 28, 26)
            px[i * w + 5, (yy + dy) % SIZE] = (30, 28, 26)
    return img


def ground():
    """Земля с пожухлой травой: зелёно-бурые пятна и отдельные травинки."""
    rng = random.Random(3)
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    big = noise_grid(rng, 4)
    small = noise_grid(rng, 16)
    dirt = (54, 46, 34)
    grass = (46, 58, 34)
    for y in range(SIZE):
        for x in range(SIZE):
            t = max(0.0, min(1.0, (big[y][x] - 0.35) * 2.2))
            c = tuple(dirt[k] * (1 - t) + grass[k] * t for k in range(3))
            c = rgb(c, 0.75 + 0.5 * small[y][x])
            px[x, y] = c
    for _ in range(140):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        px[x, y] = rgb(grass, rng.uniform(1.1, 1.5))
    for _ in range(25):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        px[x, y] = (24, 22, 18)
    return img


def bark():
    """Кора: вертикальные тёмные борозды."""
    rng = random.Random(4)
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    base = (58, 52, 44)
    n = noise_grid(rng, 8)
    for x in range(SIZE):
        groove = 0.6 + 0.4 * abs(math.sin(x * 0.45 + rng.random() * 0.2))
        for y in range(SIZE):
            px[x, y] = rgb(base, groove * (0.8 + 0.4 * n[y][x]))
    return img


def crate():
    """Ящик: рамка из досок и диагональ."""
    rng = random.Random(5)
    img = planks(base=(86, 70, 48), seed=5)
    px = img.load()
    frame = (60, 48, 34)
    for i in range(SIZE):
        for k in range(6):
            px[i, k] = rgb(frame, 0.9)
            px[i, SIZE - 1 - k] = rgb(frame, 0.9)
            px[k, i] = rgb(frame, 0.8)
            px[SIZE - 1 - k, i] = rgb(frame, 0.8)
        for k in range(-3, 4):
            if 0 <= i + k < SIZE:
                px[i, i + k] = rgb(frame, 0.95 + rng.random() * 0.1)
    return img


def icon():
    """Потемневшая икона: полукруглый верх, золотая рамка, силуэт с нимбом."""
    img = Image.new("RGB", (SIZE, SIZE), (26, 20, 14))
    px = img.load()
    gold = (122, 96, 48)
    for y in range(SIZE):
        for x in range(SIZE):
            inside_arch = y > 16 or (x - 32) ** 2 + (y - 16) ** 2 < 28 ** 2
            border = 2 < x < 61 and 2 < y < 61 and inside_arch
            inner = 6 < x < 57 and 6 < y < 57 and (y > 16 or (x - 32) ** 2 + (y - 16) ** 2 < 24 ** 2)
            if border and not inner:
                px[x, y] = gold
            elif inner:
                px[x, y] = (44, 34, 22)
                # нимб
                if 9 ** 2 < (x - 32) ** 2 + (y - 22) ** 2 < 12 ** 2:
                    px[x, y] = rgb(gold, 0.85)
                # лицо — тёмное пятно (лик потемнел, и это жутко)
                if (x - 32) ** 2 / 36 + (y - 22) ** 2 / 64 < 1:
                    px[x, y] = (18, 14, 10)
                # плечи и одежды
                if y > 32 and abs(x - 32) < 8 + (y - 32) * 0.6:
                    px[x, y] = (58, 24, 20)
    return img


def grass_blades():
    """Высокая трава с прозрачностью (32x64): тёмные травинки, сужаются кверху."""
    rng = random.Random(6)
    w, h = 32, 64
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for _ in range(22):
        x0 = rng.uniform(1, w - 2)
        height = rng.uniform(0.45, 1.0) * h
        lean = rng.uniform(-6, 6)
        c = rgb((48, 62, 36), rng.uniform(0.7, 1.3))
        for y in range(int(height)):
            t = y / height
            x = x0 + lean * t * t
            width = max(1, int(2.2 * (1 - t) + 0.5))
            for k in range(width):
                xi = int(x) + k
                if 0 <= xi < w:
                    px[xi, h - 1 - y] = c + (255,)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    textures = {
        "logs.png": logs(),
        "planks.png": planks(),
        "ground.png": ground(),
        "bark.png": bark(),
        "crate.png": crate(),
        "icon.png": icon(),
        "grass.png": grass_blades(),
    }
    for name, img in textures.items():
        img.save(OUT / name)
        print("saved", OUT / name)


if __name__ == "__main__":
    main()
