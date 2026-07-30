#!/usr/bin/env python3
"""Автообновление catalog-data.js из свежего CSV-прайса в Google Drive.
Запуск:  python3 update-catalog.py
Для установки планировщика:  python3 update-catalog.py --setup
"""

import csv, json, os, sys, glob
from datetime import datetime

SITE_DIR = os.path.dirname(os.path.abspath(__file__))
PRICE_DIR = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-alexweng86@gmail.com/"
    "Мой диск/Упаком Работа/Прайс лист"
)
OUTPUT = os.path.join(SITE_DIR, "catalog-data.js")


def find_latest_csv():
    pattern = os.path.join(PRICE_DIR, "*.csv")
    files = glob.glob(pattern)
    if not files:
        print("CSV не найдены в:", PRICE_DIR)
        sys.exit(1)
    latest = max(files, key=os.path.getmtime)
    print(f"CSV: {os.path.basename(latest)}")
    return latest


def parse_csv(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter=";")
        rows = list(reader)

    groups = []
    current_group = None
    prev_was_cat = False

    for row in rows:
        c1 = row[1].strip() if len(row) > 1 else ""
        c2 = row[2].strip() if len(row) > 2 else ""
        c4 = row[4].strip() if len(row) > 4 else ""
        c6 = row[6].strip() if len(row) > 6 else ""

        is_cat = bool(c1 and not c2)
        is_prod = bool(c2 and c4 and c6)

        if is_cat:
            if prev_was_cat:
                if current_group is not None:
                    current_group["subs"].append({"n": c1, "p": []})
                prev_was_cat = True
            else:
                current_group = {"g": c1, "subs": []}
                groups.append(current_group)
                prev_was_cat = True

        elif is_prod:
            if current_group is not None:
                if not current_group["subs"]:
                    current_group["subs"].append({"n": "Основной", "p": []})
                current_group["subs"][-1]["p"].append({"n": c2, "pr": c6, "u": c4})
            prev_was_cat = False

        else:
            prev_was_cat = False

    return groups


def write_js(data):
    total = sum(len(p["p"]) for g in data for sub in g["subs"] for p in [sub])
    js = "const CATALOG_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"Записан: {OUTPUT} ({len(js)/1024:.1f} КБ)")
    print(f"Групп: {len(data)}, подгрупп: {sum(len(g['subs']) for g in data)}, товаров: {total}")
    print(f"Обновлено: {datetime.now().strftime('%d.%m.%Y %H:%M')}")


def setup_launchd():
    label = "com.upakom.update-catalog"
    plist_path = os.path.expanduser(f"~/Library/LaunchAgents/{label}.plist")
    plist = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{sys.executable}</string>
        <string>{os.path.abspath(__file__)}</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>{SITE_DIR}/update-catalog.log</string>
    <key>StandardErrorPath</key>
    <string>{SITE_DIR}/update-catalog.log</string>
</dict>
</plist>
"""
    with open(plist_path, "w", encoding="utf-8") as f:
        f.write(plist)
    print(f"plist создан: {plist_path}")
    os.system(f"launchctl load {plist_path}")
    os.system(f"launchctl start {label}")
    print("Планировщик запущен. Скрипт будет работать ежедневно в 6:00.")


if __name__ == "__main__":
    csv_file = find_latest_csv()
    data = parse_csv(csv_file)
    write_js(data)
    if "--setup" in sys.argv:
        setup_launchd()
    print("Готово.")
