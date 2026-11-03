#!/usr/bin/env python3
"""Сборка архива Rail Rush для Яндекс Игр.

    python runner/tools/build.py

Кладёт index.html, css/ и js/ в dist/rail-rush-v<версия>.zip (index.html в корне архива),
проверяет, что игра не тянет ничего с чужих доменов, и печатает размер.
"""
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT.parent / "dist"


def main() -> int:
    ver = re.search(r"VERSION:\s*'([^']+)'", (ROOT / "js" / "config.js").read_text(encoding="utf-8"))
    ver = ver.group(1) if ver else "dev"
    files = [ROOT / "index.html"] + sorted(p for d in ("css", "js") for p in (ROOT / d).rglob("*") if p.is_file())

    bad = []
    url_re = re.compile(r"""(?:src|href)\s*=\s*["'](?:https?:)?//""", re.I)
    for f in files:
        if f.suffix in (".html", ".css") or (f.suffix == ".js" and "vendor" not in f.parts):
            for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                if url_re.search(line):
                    bad.append(f"{f.relative_to(ROOT)}:{i}: {line.strip()[:90]}")
    if bad:
        print("Внешние ссылки (Яндекс такое не пропустит):\n  " + "\n  ".join(bad))
        return 1

    DIST.mkdir(exist_ok=True)
    out = DIST / f"rail-rush-v{ver}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            z.write(f, f.relative_to(ROOT).as_posix())
    print(f"Готово: {out}  ({out.stat().st_size / 1024:.0f} КБ, файлов: {len(files)})")
    print("Чек-лист: иконка 512x512, обложка 800x470, скриншоты, описание RU/EN, лидерборд 'railrushScore' в консоли.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
