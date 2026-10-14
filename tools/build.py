#!/usr/bin/env python3
"""Сборка архива для Яндекс Игр.

Запуск из корня проекта:
    python tools/build.py

Что делает:
  1. Собирает index.html, css/ и js/ в dist/obshaga-tycoon-v<версия>.zip
     (index.html лежит в корне архива — так требует Яндекс).
  2. Проверяет, что игра не грузит ничего с чужих доменов (кроме /sdk.js).
  3. Проверяет, что все подключённые в index.html скрипты существуют.
  4. Печатает размер архива и чек-лист перед загрузкой в консоль Яндекса.
"""

import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
INCLUDE_DIRS = ["css", "js"]
INCLUDE_FILES = ["index.html"]
MAX_ARCHIVE_MB = 100  # лимит Яндекса на архив


def read_version() -> str:
    cfg = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
    m = re.search(r"VERSION:\s*'([^']+)'", cfg)
    return m.group(1) if m else "dev"


def collect_files() -> list[Path]:
    files = [ROOT / f for f in INCLUDE_FILES]
    for d in INCLUDE_DIRS:
        files += sorted(p for p in (ROOT / d).rglob("*") if p.is_file())
    return files


def check_external_urls(files: list[Path]) -> list[str]:
    """Яндекс не любит загрузку ресурсов с внешних доменов — проверяем."""
    problems = []
    url_re = re.compile(r"""(?:src|href)\s*=\s*["'](https?:)?//""", re.I)
    fetch_re = re.compile(r"""(fetch|XMLHttpRequest|import)\s*\(\s*["']https?://""", re.I)
    for f in files:
        if f.suffix not in (".html", ".js", ".css"):
            continue
        text = f.read_text(encoding="utf-8")
        for i, line in enumerate(text.splitlines(), 1):
            if url_re.search(line) or fetch_re.search(line):
                problems.append(f"{f.relative_to(ROOT)}:{i}: {line.strip()[:100]}")
    return problems


def check_scripts_exist() -> list[str]:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    missing = []
    for src in re.findall(r'<script src="([^"]+)"', html):
        if src.startswith("/"):
            continue  # /sdk.js отдаёт сама платформа
        if not (ROOT / src).exists():
            missing.append(src)
    for href in re.findall(r'<link rel="stylesheet" href="([^"]+)"', html):
        if not (ROOT / href).exists():
            missing.append(href)
    return missing


def main() -> int:
    version = read_version()
    files = collect_files()

    missing = check_scripts_exist()
    if missing:
        print("ОШИБКА: в index.html подключены несуществующие файлы:", *missing, sep="\n  ")
        return 1

    external = check_external_urls(files)
    if external:
        print("ВНИМАНИЕ: найдены внешние ссылки (Яндекс может отклонить игру):", *external, sep="\n  ")

    DIST.mkdir(exist_ok=True)
    out = DIST / f"obshaga-tycoon-v{version}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            z.write(f, f.relative_to(ROOT).as_posix())

    size_kb = out.stat().st_size / 1024
    print(f"Готово: {out.relative_to(ROOT)}  ({len(files)} файлов, {size_kb:.0f} КБ)")
    if size_kb / 1024 > MAX_ARCHIVE_MB:
        print(f"ОШИБКА: архив больше {MAX_ARCHIVE_MB} МБ")
        return 1

    print("""
Чек-лист перед загрузкой в консоль Яндекс Игр (yandex.ru/games/console):
  [ ] Черновик: загрузить архив, открыть игру по ссылке черновика и проверить рекламу
  [ ] Языки: русский + английский; название и описание на обоих языках
  [ ] Ориентация: на телефоне портрет и альбом (игра адаптируется к обеим)
  [ ] Облачные сохранения работают (сыграть, обновить страницу, прогресс на месте)
  [ ] Лидерборд (необязательно): технич. имя 'stars', тип — число
  [ ] Sticky-баннер включить в настройках рекламы (внизу/сверху, код не нужен)
  [ ] Иконка 512x512, обложка 800x470, 3–5 скриншотов, видео-превью (желательно)
  [ ] Возрастной рейтинг: 0+ или 6+
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
