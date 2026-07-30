#!/usr/bin/env python3
"""Пересборка catalog-data.js из CSV с правильной структурой."""

import csv, json, re, os

CSV_PATH = (
    "/Users/djsantik/Library/CloudStorage/GoogleDrive-alexweng86@gmail.com/"
    "Мой диск/Упаком Работа/Прайс лист/17.07.2026.csv"
)
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog-data.js")


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

        is_cat = bool(c1 and not c2)  # category header
        is_prod = bool(c2 and c4 and c6)  # product with name, unit, price

        if is_cat:
            if prev_was_cat:
                # SUBGROUP: add to current group
                current_sub = {"n": c1, "p": []}
                if current_group:
                    current_group["subs"].append(current_sub)
                prev_was_cat = True
            else:
                # NEW GROUP
                current_group = {"g": c1, "subs": []}
                groups.append(current_group)
                prev_was_cat = True

        elif is_prod:
            if current_group:
                if not current_group["subs"]:
                    current_group["subs"].append({"n": "Основной", "p": []})
                current_group["subs"][-1]["p"].append({
                    "n": c2,
                    "pr": c6,
                    "u": c4
                })
            prev_was_cat = False

        else:
            prev_was_cat = False

    return groups


def main():
    data = parse_csv(CSV_PATH)
    total_products = sum(len(p["p"]) for g in data for sub in g["subs"] for p in [sub])
    print(f"Групп: {len(data)}, подгрупп: {sum(len(g['subs']) for g in data)}, товаров: {total_products}")

    js = "const CATALOG_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"Записан: {OUTPUT} ({len(js) / 1024:.1f} КБ)")


if __name__ == "__main__":
    main()
