"""Синтезатор звуков-заглушек для вертикального среза.

Все звуки собраны из синусов, пилы и шума, поэтому их можно спокойно использовать
в игре (лицензия наша). Это черновик: когда найдёшь нормальные звуки на freesound.org
(только CC0 или CC-BY с указанием автора в credits.txt), положи WAV/OGG с тем же именем.

Запуск (из папки storozh):  python tools/gen_audio.py
Нужен numpy: pip install numpy
"""
import wave
from pathlib import Path

import numpy as np

SR = 22050  # лоу-фай частота, как раз под PS1-стиль и меньше весит
OUT = Path(__file__).resolve().parent.parent / "assets" / "audio"
rng = np.random.default_rng(7)


# --- Базовые кирпичики ------------------------------------------------------

def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def silence(dur):
    return np.zeros(int(dur * SR))


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def env_exp(dur, decay, attack=0.002):
    """Огибающая: быстрая атака и экспоненциальный спад (decay — секунды до -60 дБ)."""
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-6.9 * t / decay)


def env_ar(dur, attack, release):
    t = t_axis(dur)
    up = np.clip(t / max(attack, 1e-4), 0, 1)
    down = np.clip((dur - t) / max(release, 1e-4), 0, 1)
    return np.minimum(up, down)


def fft_filter(x, response, circular=False):
    """Фильтр через БПФ. response(f) -> усиление. Без circular добиваем нулями, чтобы хвост не завернулся."""
    n = len(x)
    pad = 0 if circular else min(n, SR)
    X = np.fft.rfft(np.concatenate([x, np.zeros(pad)]))
    f = np.fft.rfftfreq(n + pad, 1 / SR)
    y = np.fft.irfft(X * response(f), n + pad)
    return y[:n]


def lowpass(x, fc, order=2, circular=False):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)), circular)


def highpass(x, fc, order=2, circular=False):
    return fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)), circular)


def bandpass(x, f0, q, circular=False):
    def resp(f):
        f = np.maximum(f, 1e-3)
        return 1 / np.sqrt(1 + q * q * (f / f0 - f0 / f) ** 2)
    return fft_filter(x, resp, circular)


def sine_sweep(dur, f_start, f_end, curve=1.0):
    t = t_axis(dur)
    k = (t / dur) ** curve
    freq = f_start + (f_end - f_start) * k
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def saw(freq_array):
    phase = np.cumsum(freq_array) / SR
    return 2 * (phase % 1.0) - 1


def place(dst, src, at):
    i = int(at * SR)
    end = min(len(dst), i + len(src))
    dst[i:end] += src[: end - i]
    return dst


def norm(x, peak=0.9):
    m = np.max(np.abs(x))
    return x if m < 1e-9 else x / m * peak


def soft_clip(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


def save(name, x, peak=0.9):
    OUT.mkdir(parents=True, exist_ok=True)
    data = (norm(x, peak) * 32767).astype(np.int16)
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"saved {name:24s} {len(x) / SR:5.2f}s")


# --- Игрок -------------------------------------------------------------------

def step_wood(i):
    dur = 0.22
    thump = np.sin(2 * np.pi * (110 + 15 * i) * t_axis(dur)) * env_exp(dur, 0.09)
    click = bandpass(noise(dur), 1800 + 300 * i, 2.0) * env_exp(dur, 0.03)
    board = bandpass(noise(dur), 420 + 40 * i, 6.0) * env_exp(dur, 0.12) * 0.6
    return thump * 0.9 + click * 0.8 + board


def step_ground(i):
    dur = 0.25
    thump = lowpass(noise(dur), 220) * env_exp(dur, 0.08) * 2.5
    crunch = highpass(noise(dur), 2500) * env_exp(dur, 0.12, attack=0.01)
    grains = np.zeros(int(dur * SR))
    for _ in range(14):
        place(grains, bandpass(noise(0.01), 3000 + rng.uniform(0, 2500), 3) * 2, rng.uniform(0, 0.12))
    return thump + crunch * 0.25 + grains * 0.5 + 0 * i


def creak(dur, f0, f1, roughness=0.5):
    """Скрип: рывки трения (stick-slip) с плавающей частотой через резонанс дерева."""
    t = t_axis(dur)
    k = t / dur
    freq = f0 + (f1 - f0) * (k ** 0.7) + 20 * np.sin(2 * np.pi * 3.3 * t)
    pulses = saw(freq)
    pulses = np.where(pulses > 0.85, 1.0, 0.0)  # короткие импульсы на каждом «рывке»
    pulses *= 1 + roughness * rng.uniform(-1, 1, len(t))
    body = bandpass(pulses, 700, 3.0) + bandpass(pulses, 1500, 5.0) * 0.6
    return body * env_ar(dur, 0.06, 0.15)


def flashlight_click():
    x = silence(0.12)
    place(x, highpass(noise(0.006), 1500) * env_exp(0.006, 0.004), 0.0)
    place(x, highpass(noise(0.008), 1200) * env_exp(0.008, 0.006) * 0.8, 0.045)
    return x


def camera_flash():
    whine_dur = 0.35
    whine = sine_sweep(whine_dur, 1800, 6500, curve=0.6) * env_ar(whine_dur, 0.05, 0.02) * 0.25
    pop = highpass(noise(0.08), 800) * env_exp(0.08, 0.05)
    clack = np.sin(2 * np.pi * 140 * t_axis(0.1)) * env_exp(0.1, 0.05)
    # сначала щелчок и хлопок вспышки, потом писк заряжающегося конденсатора
    x = silence(0.6)
    place(x, pop, 0.0)
    place(x, clack * 0.6, 0.0)
    place(x, whine, 0.12)
    return x


def pickup():
    x = silence(0.35)
    place(x, bandpass(noise(0.18), 2500, 1.0) * env_ar(0.18, 0.05, 0.1) * 0.5, 0.0)
    place(x, highpass(noise(0.01), 1500) * env_exp(0.01, 0.008), 0.17)
    return x


def breath():
    """Вдох-выдох, ~2.4 с, можно зациклить."""
    x = silence(2.4)
    inhale = bandpass(noise(0.9), 1200, 0.7) * env_ar(0.9, 0.4, 0.25)
    exhale = bandpass(noise(1.0), 700, 0.8) * env_ar(1.0, 0.1, 0.6)
    place(x, inhale * 0.7, 0.05)
    place(x, exhale, 1.05)
    return x


def gasp():
    dur = 0.7
    n = noise(dur)
    sweep = bandpass(n, 900, 0.6) * 0.6 + bandpass(n, 2200, 1.5)
    voice = np.sin(2 * np.pi * np.cumsum(np.linspace(260, 340, int(dur * SR))) / SR) * 0.15
    return (sweep + voice) * env_ar(dur, 0.04, 0.35)


def heartbeat():
    x = silence(0.55)
    lub = np.sin(2 * np.pi * 55 * t_axis(0.12)) * env_exp(0.12, 0.1, attack=0.008)
    dub = np.sin(2 * np.pi * 46 * t_axis(0.12)) * env_exp(0.12, 0.09, attack=0.008)
    place(x, lub, 0.0)
    place(x, dub * 0.75, 0.2)
    return lowpass(x, 180)


# --- Сторож ------------------------------------------------------------------

def storozh_step(i):
    dur = 0.45
    thud = np.sin(2 * np.pi * (62 + 8 * i) * t_axis(dur)) * env_exp(dur, 0.25, attack=0.01)
    scrape = bandpass(noise(dur), 900, 1.5) * env_ar(dur, 0.02, 0.3) * 0.25
    wet = bandpass(noise(0.03), 2200, 4) * env_exp(0.03, 0.02)
    x = thud + scrape
    place(x, wet * 0.5, 0.05)
    return x


def throat_clicks(count, seed):
    """Щелчки из глотки: импульсы через узкие резонансы с рваным ритмом."""
    local = np.random.default_rng(seed)
    dur = 0.25 + count * 0.11
    x = silence(dur)
    at = 0.02
    for _ in range(count):
        imp = np.zeros(int(0.08 * SR))
        imp[0] = 1.0
        imp[1] = -0.6
        f = local.uniform(700, 1300)
        c = bandpass(imp, f, 18) * 30 + bandpass(imp, f * 2.3, 25) * 12
        place(x, c * local.uniform(0.6, 1.0), at)
        at += local.uniform(0.05, 0.14)
    return x


def laugh():
    """«Неправильный» смех: слоги «ха» с плывущей высотой, неровным ритмом и формантами."""
    x = silence(3.2)
    at = 0.05
    f0 = 150.0
    for k in range(9):
        syl = local_syllable(f0, 0.16 + 0.04 * rng.random())
        place(x, syl * (1.0 - k * 0.06), at)
        at += 0.17 + rng.uniform(-0.04, 0.12) + (0.25 if k == 5 else 0)  # сбивка ритма
        f0 *= 0.93 if k < 6 else 1.09  # сначала вниз, потом неестественно вверх
    # кольцевая модуляция делает голос «не человеческим»
    t = t_axis(3.2)
    x = x * (0.65 + 0.35 * np.sin(2 * np.pi * 37 * t))
    return soft_clip(x * 1.5, 1.5)


def local_syllable(f0, dur):
    t = t_axis(dur)
    wobble = 1 + 0.04 * np.sin(2 * np.pi * 9 * t)
    glottal = saw(f0 * wobble * np.ones(len(t)))
    breath_n = noise(dur) * 0.6
    src = glottal + breath_n
    voiced = bandpass(src, 750, 5) + bandpass(src, 1150, 6) * 0.7 + bandpass(src, 2600, 8) * 0.35
    h = highpass(noise(dur), 1000) * env_ar(dur, 0.005, dur * 0.8) * 0.3  # придыхание «х»
    return (voiced * env_ar(dur, 0.03, dur * 0.6) + h)


def glass_tap():
    """Ноготь по стеклу: три коротких щелчка со звонким стеклянным хвостом."""
    x = silence(1.3)
    for i, at in enumerate([0.05, 0.31, 0.52]):
        imp = np.zeros(int(0.2 * SR))
        imp[0] = 1.0
        ring = (bandpass(imp, 2900, 40) * 50 + bandpass(imp, 4300, 50) * 35 + bandpass(imp, 6100, 60) * 20)
        ring *= env_exp(0.2, 0.12)
        place(x, ring * (1 - 0.1 * i), at)
    return x


def screech():
    dur = 1.4
    t = t_axis(dur)
    freq = 750 + 350 * np.sin(2 * np.pi * 5.5 * t) + 400 * t / dur
    s = saw(freq) * 0.6 + saw(freq * 1.51) * 0.4
    s = bandpass(s + noise(dur) * 0.8, 1600, 1.2)
    return soft_clip(s * env_ar(dur, 0.05, 0.6) * 2.5, 3.0)


def catch_scream():
    dur = 1.8
    t = t_axis(dur)
    freq = 500 + 900 * np.exp(-t * 2) + 200 * np.sin(2 * np.pi * 13 * t)
    scream = saw(freq) * 0.5 + saw(freq * 1.33) * 0.4 + noise(dur) * 0.7
    scream = bandpass(scream, 1400, 0.9)
    boom = np.sin(2 * np.pi * 38 * t) * env_exp(dur, 1.2, attack=0.005) * 1.4
    return soft_clip((scream * env_ar(dur, 0.01, 1.0) + boom) * 2.0, 3.0)


def chase_sting():
    dur = 2.6
    t = t_axis(dur)
    x = np.zeros(len(t))
    for f in (65.4, 69.3, 92.5, 138.6, 196.0):  # до, до-диез, фа-диез: кластер-диссонанс
        x += saw(np.full(len(t), f * (1 + rng.uniform(-0.004, 0.004))))
    x = lowpass(x, 1200) * env_exp(dur, 2.2, attack=0.01)
    hit = lowpass(noise(dur), 400) * env_exp(dur, 0.4) * 3
    return soft_clip((x * 0.4 + hit) * 1.5, 2.0)


def knock_basement():
    x = silence(1.6)
    for at in (0.05, 0.42, 0.8):
        k = lowpass(noise(0.15), 160) * env_exp(0.15, 0.12) * 6
        k += np.sin(2 * np.pi * 75 * t_axis(0.15)) * env_exp(0.15, 0.1)
        place(x, k, at)
    return x


def door_slam():
    dur = 1.0
    t = t_axis(dur)
    thud = np.sin(2 * np.pi * 58 * t) * env_exp(dur, 0.35, attack=0.003) * 1.2
    crack = highpass(noise(dur), 900) * env_exp(dur, 0.08)
    rattle = bandpass(noise(dur), 1300, 3) * env_exp(dur, 0.6) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 23 * t)))
    return soft_clip(thud + crack * 0.7 + rattle * 0.4, 1.5)


# --- Атмосфера (зацикленные) -------------------------------------------------

def drone_loop():
    """Низкий гул ночи. Частоты кратны 0.1 Гц, а шум фильтруется по кругу — стык петли не слышен."""
    dur = 10.0
    t = t_axis(dur)
    x = (np.sin(2 * np.pi * 41.0 * t) * 0.5 + np.sin(2 * np.pi * 41.3 * t) * 0.5
         + np.sin(2 * np.pi * 61.5 * t) * 0.25 + np.sin(2 * np.pi * 82.2 * t) * 0.12)
    air = bandpass(noise(dur), 300, 0.8, circular=True) * 0.25
    swell = 0.75 + 0.25 * np.sin(2 * np.pi * 0.1 * t)
    return (x + air) * swell


def chase_loop():
    """Пульсация погони: 4 с, 8 ударов по пиле в басу и дрожащий кластер сверху."""
    dur = 4.0
    t = t_axis(dur)
    beat = (t * 2.0) % 1.0  # 120 уд/мин, 8 восьмых за петлю
    pulse = np.exp(-beat * 6)
    bass = lowpass(saw(np.full(len(t), 55.0)), 300, circular=True) * pulse
    trem = 0.5 + 0.5 * np.sin(2 * np.pi * 12 * t)
    high = sum(np.sin(2 * np.pi * f * t) for f in (440.0, 466.25, 622.25)) * trem * 0.12
    return bass + high


def birds():
    x = silence(9.0)
    for _ in range(38):
        at = rng.uniform(0, 8.5)
        n = rng.integers(2, 6)
        base = rng.uniform(2200, 4500)
        for j in range(n):
            d = rng.uniform(0.04, 0.12)
            chirp = sine_sweep(d, base * rng.uniform(0.9, 1.1), base * rng.uniform(1.1, 1.5), 0.5)
            place(x, chirp * env_ar(d, 0.01, d * 0.6) * rng.uniform(0.2, 0.6), at + j * 0.13)
    return x


def main():
    for i in range(4):
        save(f"step_wood_{i + 1}.wav", step_wood(i), 0.7)
    for i in range(3):
        save(f"step_ground_{i + 1}.wav", step_ground(i), 0.6)
    save("creak_1.wav", creak(0.55, 220, 300), 0.8)
    save("creak_2.wav", creak(0.7, 310, 190, 0.8), 0.8)
    save("door_creak.wav", creak(1.3, 180, 420, 0.6), 0.8)
    save("door_slam.wav", door_slam(), 0.95)
    save("flashlight_click.wav", flashlight_click(), 0.6)
    save("camera_flash.wav", camera_flash(), 0.8)
    save("pickup.wav", pickup(), 0.6)
    save("breath.wav", breath(), 0.5)
    save("gasp.wav", gasp(), 0.85)
    save("heartbeat.wav", heartbeat(), 0.9)
    for i in range(2):
        save(f"storozh_step_{i + 1}.wav", storozh_step(i), 0.85)
    for i, n in enumerate((3, 5, 7)):
        save(f"storozh_click_{i + 1}.wav", throat_clicks(n, 100 + i), 0.85)
    save("storozh_laugh.wav", laugh(), 0.9)
    save("storozh_tap.wav", glass_tap(), 0.8)
    save("storozh_screech.wav", screech(), 0.9)
    save("catch_scream.wav", catch_scream(), 0.98)
    save("chase_sting.wav", chase_sting(), 0.9)
    save("knock_basement.wav", knock_basement(), 0.9)
    save("drone_loop.wav", drone_loop(), 0.7)
    save("chase_loop.wav", chase_loop(), 0.7)
    save("birds.wav", birds(), 0.6)


if __name__ == "__main__":
    main()
